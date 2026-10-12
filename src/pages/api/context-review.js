import { contextStore } from '../../lib/context-store.js';
export const prerender = false;
export async function POST({ request }) {
  const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Use the SiteSage app.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Send JSON.' }, 415);
  try {
    const raw = await request.text(); if (raw.length > 2048) return json({ error: 'Request too large.' }, 413);
    const { id, confirmed } = JSON.parse(raw);
    if (!/^INC-[A-Za-z0-9-]{1,40}$/.test(id || '') || confirmed !== true) return json({ error: 'Confirm advisory applicability before accepting.' }, 400);
    const context = await contextStore.get(`incident:${id}`);
    if (!context || context.severity.original === context.severity.recommended || context.status === 'unavailable') return json({ error: 'No escalation available for this incident.' }, 409);
    context.review = { acceptedAt: new Date().toISOString(), severity: context.severity.recommended, confirmedApplicability: true };
    await contextStore.put(`incident:${id}`, context);
    return json({ review: context.review });
  } catch { return json({ error: 'Could not save review. Original severity is unchanged.' }, 503); }
}
