import test from 'node:test';
import assert from 'node:assert/strict';
import { createContextService, validateIncident, safeOfficialUrl } from '../src/lib/incident-context.js';
import { recordMonitorRun } from '../src/lib/context-monitors.js';
import { RESEARCH_TOPICS } from '../src/lib/research-topics.js';
import { contextStore } from '../src/lib/context-store.js';
import { POST as review } from '../src/pages/api/context-review.js';
import { POST as webhook } from '../src/pages/api/tinyfish-monitor-webhook.js';
const store = () => { const values = new Map(); return { get: async key => values.get(key), put: async (key, value) => { values.set(key, structuredClone(value)); }, values }; };
const incident = { id: 'INC-test-1', topic: 'zones', severity: 'medium' };
const weatherUrl = 'https://mausam.imd.gov.in/warnings';
function mockProvider(calls) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith('https://api.search.tinyfish.ai')) return Response.json({ results: [{ title: 'Heavy rain warning', url: weatherUrl, snippet: 'New Delhi heavy rain advisory', date: '2026-10-12' }, { title: 'Untrusted site', url: 'https://mausam.imd.gov.in.attacker.example', snippet: 'heatwave' }] });
    const body = JSON.parse(options.body);
    return Response.json({ results: body.urls.map(url => ({ url, text: url === weatherUrl ? 'Heavy rain warning for New Delhi. Verify validity on the source.' : 'Construction safety rule text.', published_date: '2026-10-12' })), errors: [] });
  };
}
test('incident enrichment attaches weather, rule, timestamps and review-only escalation without exporting private data', async () => {
  const calls = []; const storage = store();
  const service = createContextService({ store: storage, fetcher: mockProvider(calls), key: () => 'server-key' });
  const result = await service.enrich({ ...incident, worker: 'PRIVATE-WORKER', cameraFrame: 'PRIVATE-FRAME', url: 'http://localhost' });
  assert.equal(result.status, 'ready'); assert.equal(result.severity.original, 'medium'); assert.equal(result.severity.recommended, 'high'); assert.equal(result.severity.requiresReview, true);
  assert.equal(result.weather.advisories.length, 1); assert.equal(result.rule.sourceUrl, RESEARCH_TOPICS.zones.url);
  assert.ok(result.fetchedAt && result.weather.fetchedAt && result.rule.fetchedAt);
  assert.ok(!JSON.stringify(calls).includes('PRIVATE-')); assert.ok(!JSON.stringify(calls).includes('INC-test-1'));
  assert.equal(storage.values.get('incident:INC-test-1').severity.original, 'medium');
});
test('concurrent incidents share site weather and rule calls, and reuse durable cache until expiry', async () => {
  const calls = []; let now = Date.parse('2026-10-12T10:00:00Z');
  const storage = store(); const service = createContextService({ store: storage, fetcher: mockProvider(calls), key: () => 'key', clock: () => now });
  await Promise.all([service.enrich(incident), service.enrich({ ...incident, id: 'INC-test-2' })]);
  assert.equal(calls.length, 3);
  const cached = await service.enrich({ ...incident, id: 'INC-test-3' }); assert.equal(calls.length, 3); assert.equal(cached.weather.cached, true);
  now += 16 * 60000; await service.enrich(incident); assert.equal(calls.length, 5, 'only weather search/fetch expire after fifteen minutes');
});
test('missing keys and provider timeouts preserve original alerts; partial rule results remain usable', async () => {
  const storage = store();
  const missing = await createContextService({ store: storage, key: () => '', fetcher: () => { throw Error('must not fetch'); } }).enrich(incident);
  assert.equal(missing.status, 'unavailable'); assert.equal(missing.severity.recommended, 'medium');
  const service = createContextService({ store: storage, key: () => 'key', fetcher: async (url, options) => {
    if (url.includes('search')) throw new DOMException('Timed out', 'TimeoutError');
    return Response.json({ results: [{ url: JSON.parse(options.body).urls[0], text: 'Rule survives weather failure' }] });
  } });
  const partial = await service.enrich(incident); assert.equal(partial.status, 'partial'); assert.ok(partial.rule); assert.equal(partial.severity.recommended, 'medium');
});
test('no advisory result never claims safe conditions or downgrades a critical alert', async () => {
  const service = createContextService({ store: store(), key: () => 'key', fetcher: async (url, options) => url.includes('search') ? Response.json({ results: [] }) : Response.json({ results: [{ url: JSON.parse(options.body).urls[0], text: 'Official rule' }] }) });
  const result = await service.enrich({ ...incident, severity: 'critical' });
  assert.equal(result.severity.recommended, 'critical'); assert.match(result.weather.note, /does not confirm/);
});
test('daily monitor callbacks identify changes, update rule cache and keep a bounded history', async () => {
  const storage = store(); const source = RESEARCH_TOPICS.zones;
  await storage.put('monitor:zones', { id: 'monitor-1' });
  const first = await recordMonitorRun('zones', { id: 'run-1', results: [{ url: source.url, text: 'baseline rule' }] }, storage); assert.equal(first.changed, false);
  const second = await recordMonitorRun('zones', { id: 'run-2', results: [{ url: source.url, text: 'revised rule' }] }, storage); assert.equal(second.changed, true); assert.equal(second.changes.length, 1);
  assert.equal(storage.values.get('rule:zones').text, 'revised rule');
  await assert.rejects(recordMonitorRun('zones', { results: [{ url: 'https://attacker.example', text: 'fake rule' }] }, storage));
});
test('review persists a human-approved priority while rejecting unconfirmed and cross-origin changes', async t => {
  const saved = { incident, status: 'ready', severity: { original: 'medium', recommended: 'high' } };
  t.mock.method(contextStore, 'get', async () => saved); let persisted;
  t.mock.method(contextStore, 'put', async (_, value) => { persisted = value; });
  const request = (confirmed, origin = 'http://localhost:4321') => new Request('http://localhost:4321/api/context-review', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: incident.id, confirmed }) });
  assert.equal((await review({ request: request(false) })).status, 400);
  assert.equal((await review({ request: request(true, 'https://attacker.example') })).status, 403);
  assert.equal((await review({ request: request(true) })).status, 200); assert.equal(persisted.review.severity, 'high'); assert.equal(persisted.severity.original, 'medium');
});
test('weather monitor changes invalidate cached site advisories for the next incident', async () => {
  const storage = store();
  await storage.put('monitor:weather', { id: 'weather-monitor' });
  const first = { id: 'weather-1', results: [{ url: weatherUrl, title: 'No advisory', snippet: 'Baseline' }] };
  await recordMonitorRun('weather', first, storage);
  await storage.put('weather:north-tower-demo', { advisories: [], fetchedAt: new Date().toISOString() });
  const changed = await recordMonitorRun('weather', { id: 'weather-2', results: [{ url: weatherUrl, title: 'Heavy rain advisory', snippet: 'New warning' }] }, storage);
  assert.equal(changed.changed, true); assert.equal(changed.changes.length, 1); assert.equal(storage.values.get('weather:north-tower-demo'), null);
});
test('untrusted webhook and arbitrary topics cannot enter the context service', async () => {
  assert.throws(() => validateIncident({ ...incident, topic: '__proto__' }));
  assert.equal(safeOfficialUrl('https://mausam.imd.gov.in.attacker.example', 'mausam.imd.gov.in'), false);
  assert.equal(safeOfficialUrl('https://user@mausam.imd.gov.in', 'mausam.imd.gov.in'), false);
  const request = new Request('http://localhost:4321/api/tinyfish-monitor-webhook', { method: 'POST', body: '{}' });
  assert.equal((await webhook({ request, url: new URL(request.url) })).status, 401);
});
