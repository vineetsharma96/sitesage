import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSSE } from '../src/lib/sse.js';
import { POST, GET } from '../src/pages/api/tinyfish.js';

function streamChunks(chunks) {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } });
}
const request = (body, origin = 'http://localhost:4321') => new Request('http://localhost:4321/api/tinyfish', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('SSE parses fragmented CRLF events, multiline data and a final unterminated event', async () => {
  const events = [];
  await consumeSSE(streamChunks([': heartbeat\r\n\r\ndata: {"type":"PRO', 'GRESS",\r\ndata: "purpose":"Reading"}\r', '\n\r\ndata: invalid\n\ndata: {"type":"COMPLETE","result":{"summary":"done"}}']), event => events.push(event));
  assert.equal(events.length, 2);
  assert.equal(events[0].purpose, 'Reading');
  assert.equal(events[1].result.summary, 'done');
});

test('SSE propagates consumer errors', async () => {
  await assert.rejects(consumeSSE(streamChunks(['data: {"type":"ERROR"}\n\n']), () => { throw new Error('provider failed'); }), /provider failed/);
});

test('endpoint rejects cross-origin and arbitrary source requests before making a provider call', async () => {
  assert.equal((await POST({ request: request({ topic: 'ppe' }, 'https://other.example') })).status, 403);
  assert.equal((await POST({ request: request({ topic: 'unknown', url: 'http://localhost' }) })).status, 400);
  assert.equal((await POST({ request: request({ topic: '__proto__' }) })).status, 400);
});

test('missing credentials produce a clear configuration state without leaking keys', async () => {
  const previous = process.env.TINYFISH_API_KEY;
  delete process.env.TINYFISH_API_KEY;
  try {
    assert.equal((await GET().json()).configured, false);
    const response = await POST({ request: request({ topic: 'ppe' }) });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'NOT_CONFIGURED');
  } finally { if (previous) process.env.TINYFISH_API_KEY = previous; }
});

test('endpoint streams upstream SSE and only sends the selected public topic', async t => {
  process.env.TINYFISH_API_KEY = 'test-server-key';
  const providerEvents = 'data: {"type":"COMPLETE","status":"COMPLETED","result":{"summary":"Verified"}}\n\n';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://agent.tinyfish.ai/v1/automation/run-sse');
    assert.equal(options.headers['X-API-Key'], 'test-server-key');
    const body = JSON.parse(options.body);
    assert.ok(body.url.startsWith('https://www.osha.gov/'));
    assert.ok(!body.goal.includes('PRIVATE-WORKER'));
    assert.ok(!body.goal.includes('INC-PRIVATE'));
    return new Response(providerEvents, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const response = await POST({ request: request({ topic: 'ppe', worker: 'PRIVATE-WORKER', incident: 'INC-PRIVATE', url: 'https://attacker.example' }), clientAddress: 'stream-test' });
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(await response.text(), providerEvents);
  delete process.env.TINYFISH_API_KEY;
});

test('provider authentication errors are returned as actionable errors', async t => {
  process.env.TINYFISH_API_KEY = 'test-server-key';
  t.mock.method(globalThis, 'fetch', async () => new Response('secret provider details', { status: 401 }));
  const response = await POST({ request: request({ topic: 'ppe' }), clientAddress: 'auth-test' });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.providerStatus, 401);
  assert.ok(!JSON.stringify(body).includes('secret provider details'));
  delete process.env.TINYFISH_API_KEY;
});
