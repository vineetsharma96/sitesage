import { RESEARCH_TOPICS } from './research-topics.js';
import { contextStore } from './context-store.js';
import { pageHash, CONTEXT_SITE, safeOfficialUrl } from './incident-context.js';
export const MONITOR_SOURCES = {
  ...Object.fromEntries(Object.entries(RESEARCH_TOPICS).map(([topic, source]) => [topic, { ...source, type: 'fetch', config: { url: source.url, format: 'markdown' } }])),
  weather: { title: 'New Delhi weather advisories', url: 'https://mausam.imd.gov.in/', type: 'search', config: { query: 'New Delhi heat heavy rain thunderstorm advisory site:mausam.imd.gov.in', recency_minutes: 1440, result_limit: 5 } },
};
export async function recordMonitorRun(topic, run, store = contextStore) {
  const source = MONITOR_SOURCES[topic];
  if (topic === 'weather') {
    if (!Array.isArray(run?.results) || (run.status_code && run.status_code !== 200)) throw new Error('Weather monitor result unavailable.');
    const results = run.results.filter(item => safeOfficialUrl(item.url, 'mausam.imd.gov.in'));
    const previous = await store.get('monitor:weather');
    const hash = pageHash(JSON.stringify(results.map(item => ({ url: item.url, title: item.title, snippet: item.snippet })).sort((a,b) => a.url.localeCompare(b.url))));
    const changed = Boolean(previous?.hash && previous.hash !== hash); const checkedAt = new Date().toISOString();
    const state = { ...previous, sourceUrl: source.url, title: source.title, hash, changed, checkedAt, lastRunId: run.id, results, changes: [...(changed ? [{ at: checkedAt, previousHash: previous.hash, hash }] : []), ...(previous?.changes || [])].slice(0,20) };
    await store.put('monitor:weather', state);
    if (changed) await store.put(`weather:${CONTEXT_SITE.id}`, null);
    return state;
  }
  const page = run?.results?.find(item => item.url === source.url);
  if (!page || typeof page.text !== 'string' || !page.text.trim()) throw new Error('Monitor did not return the configured source.');
  const previous = await store.get(`monitor:${topic}`);
  const hash = pageHash(page.text);
  const changed = Boolean(previous?.hash && previous.hash !== hash);
  const checkedAt = new Date().toISOString();
  const state = { ...previous, sourceUrl: source.url, title: source.title, hash, checkedAt, lastRunId: run.id, changed, changes: [...(changed ? [{ at: checkedAt, previousHash: previous.hash, hash }] : []), ...(previous?.changes || [])].slice(0, 20) };
  await store.put(`monitor:${topic}`, state);
  await store.put(`rule:${topic}`, { title: source.title, sourceUrl: source.url, text: page.text.slice(0, 12000), hash, fetchedAt: checkedAt, jurisdiction: 'US OSHA reference; local applicability requires review.' });
  return state;
}
