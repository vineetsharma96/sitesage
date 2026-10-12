import { RESEARCH_TOPICS, buildResearchGoal } from '../../lib/research-topics.js';
export const prerender = false;

const rateWindows = new Map();
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const getKey = () => import.meta.env?.TINYFISH_API_KEY || process.env.TINYFISH_API_KEY;

export function GET() {
  return json({ configured: Boolean(getKey()), provider: 'TinyFish', mode: 'official-source-research' });
}

export async function POST({ request, clientAddress }) {
  // Require same-origin browser requests. The API key stays on the server.
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return json({ error: 'Research requests must come from this SiteSage app.' }, 403);
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Send a JSON research request.' }, 415);
  }
  if (Number(request.headers.get('content-length') || 0) > 2048) {
    return json({ error: 'Research request is too large.' }, 413);
  }
  let body;
  try { body = JSON.parse((await request.text()).slice(0, 2049)); }
  catch { return json({ error: 'Invalid JSON research request.' }, 400); }
  const topic = Object.hasOwn(RESEARCH_TOPICS, body?.topic) && RESEARCH_TOPICS[body.topic];
  if (!topic) return json({ error: 'Choose head protection, restricted zones, or fall protection.' }, 400);
  const apiKey = getKey();
  if (!apiKey) return json({ error: 'Live research needs a server-side TINYFISH_API_KEY. Sample mode remains available.', code: 'NOT_CONFIGURED' }, 503);

  const now = Date.now();
  for (const [ip, entry] of rateWindows) if (entry.until < now) rateWindows.delete(ip);
  const id = clientAddress || 'local';
  const entry = rateWindows.get(id) || { count: 0, until: now + 600_000 };
  if (entry.count >= 5) return json({ error: 'Research limit reached. Try again in ten minutes.' }, 429);
  entry.count++;
  rateWindows.set(id, entry);

  try {
    const response = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: topic.url, goal: buildResearchGoal(topic) }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]),
    });
    if (!response.ok) {
      const error = response.status === 401 || response.status === 403 ? 'TinyFish could not authenticate. Check the server API key.'
        : response.status === 402 ? 'TinyFish requires available credits. Check your TinyFish wallet.'
        : response.status === 429 ? 'TinyFish is busy or rate limited. Try again shortly.'
        : 'TinyFish could not start this research run. Try again shortly.';
      return json({ error, providerStatus: response.status }, response.status === 429 ? 429 : 502);
    }
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      return json({ error: 'TinyFish returned an unexpected response instead of an event stream.' }, 502);
    }
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store', 'X-Accel-Buffering': 'no' },
    });
  } catch (error) {
    return json({ error: error.name === 'TimeoutError' ? 'Research timed out. Check the TinyFish run before starting another.' : 'Could not connect to TinyFish. Check the connection and try again.' }, 502);
  }
}
