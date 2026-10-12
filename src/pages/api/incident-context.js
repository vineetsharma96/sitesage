import { incidentContext, validateIncident, getTinyfishKey, CONTEXT_SITE } from '../../lib/incident-context.js';
import { contextStore } from '../../lib/context-store.js';
export const prerender = false;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const windows = new Map();
export async function GET({ url }) {
  const id = url.searchParams.get('incident');
  if (!id) return json({ configured: Boolean(getTinyfishKey()), site: CONTEXT_SITE });
  if (!/^INC-[A-Za-z0-9-]{1,40}$/.test(id)) return json({ error: 'Invalid incident ID.' }, 400);
  try { return json({ context: await contextStore.get(`incident:${id}`) }); } catch { return json({ context: null, error: 'Context storage is unavailable.' }, 503); }
}
export async function POST({ request, clientAddress }) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Use the SiteSage app to request context.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Send JSON.' }, 415);
  let incident;
  try { const raw = await request.text(); if (raw.length > 2048) return json({ error: 'Request too large.' }, 413); incident = validateIncident(JSON.parse(raw)); } catch (error) { return json({ error: error.message }, 400); }
  const now = Date.now();
  for (const [id, entry] of windows) if (entry.until < now) windows.delete(id);
  const id = clientAddress || 'local'; const entry = windows.get(id) || { count: 0, until: now + 600000 };
  if (entry.count >= 30) return json({ error: 'Context request limit reached. Original alerts remain available.' }, 429);
  entry.count++; windows.set(id, entry);
  return json(await incidentContext.enrich(incident));
}
