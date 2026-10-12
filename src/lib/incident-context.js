import { createHash } from 'node:crypto';
import { RESEARCH_TOPICS } from './research-topics.js';
import { contextStore } from './context-store.js';
export const CONTEXT_SITE = { id: 'north-tower-demo', name: 'North Tower / demo', city: 'New Delhi', country: 'IN' };
export const getTinyfishKey = () => import.meta.env?.TINYFISH_API_KEY || process.env.TINYFISH_API_KEY;
export const topicForDetection = detection => /fall|tether|height/i.test(detection) ? 'fall' : /zone|buffer|gate|breach/i.test(detection) ? 'zones' : 'ppe';
export function validateIncident(value) {
  if (!value || typeof value.id !== 'string' || !/^INC-[A-Za-z0-9-]{1,40}$/.test(value.id)) throw new Error('Choose a valid incident ID.');
  if (!Object.hasOwn(RESEARCH_TOPICS, value.topic)) throw new Error('Choose a supported safety topic.');
  if (!['low', 'medium', 'high', 'critical'].includes(value.severity)) throw new Error('Choose a valid severity.');
  return { id: value.id, topic: value.topic, severity: value.severity, siteId: CONTEXT_SITE.id };
}
export function safeOfficialUrl(value, domain) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === domain || url.hostname.endsWith(`.${domain}`)); } catch { return false; }
}
export const pageHash = text => createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
export function createContextService({ store = contextStore, fetcher = fetch, clock = () => Date.now(), key = getTinyfishKey, timeout = 12000 } = {}) {
  const inFlight = new Map();
  async function provider(url, options = {}) {
    const response = await fetcher(url, { ...options, headers: { 'X-API-Key': key(), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'TinyFish credentials were rejected.' : response.status === 402 ? 'TinyFish credits are unavailable.' : 'TinyFish context is temporarily unavailable.');
    return response.json();
  }
  async function cached(cacheKey, ttl, loader) {
    const saved = await store.get(cacheKey);
    if (saved && clock() - Date.parse(saved.fetchedAt) < ttl) return { ...saved, cached: true };
    if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
    const task = (async () => { const value = { ...await loader(), fetchedAt: new Date(clock()).toISOString(), cached: false }; await store.put(cacheKey, value); return value; })();
    inFlight.set(cacheKey, task);
    try { return await task; } finally { inFlight.delete(cacheKey); }
  }
  function weather() {
    return cached(`weather:${CONTEXT_SITE.id}`, 15 * 60_000, async () => {
      const url = new URL('https://api.search.tinyfish.ai');
      url.search = new URLSearchParams({ query: `${CONTEXT_SITE.city} weather heat heavy rain thunderstorm warning advisory ${new Date(clock()).toISOString().slice(0, 10)}`, location: CONTEXT_SITE.country, language: 'en', include_domains: 'mausam.imd.gov.in', recency_minutes: '1440', purpose: 'Find official construction-site advisories; a human will confirm validity and location.' }).toString();
      const search = await provider(url.toString());
      const candidates = (search.results || []).filter(item => safeOfficialUrl(item.url, 'mausam.imd.gov.in')).slice(0, 3);
      const pages = candidates.length ? await provider('https://api.fetch.tinyfish.ai', { method: 'POST', body: JSON.stringify({ urls: candidates.map(item => item.url), format: 'markdown', ttl: 900, per_url_timeout_ms: 9000 }) }) : { results: [] };
      const advisories = candidates.map(item => {
        const page = pages.results?.find(page => page.url === item.url);
        const excerpt = typeof page?.text === 'string' ? page.text.slice(0, 1800) : String(item.snippet || '').slice(0, 1000);
        const text = `${item.title || ''} ${excerpt}`;
        const types = [['heat', /heat\s*wave|extreme heat/i], ['rain', /heavy rain|rainfall warning/i], ['storm', /thunderstorm|strong wind|lightning/i]].filter(([, pattern]) => pattern.test(text)).map(([type]) => type);
        return { advisoryTypes: types, title: String(item.title || 'Official weather source').slice(0, 200), excerpt, sourceUrl: item.url, publishedAt: page?.published_date || item.date || null, fetched: Boolean(page), verification: 'review-required' };
      });
      return { advisories, note: advisories.length ? 'Candidates only. Confirm location, issue date and validity on the source before changing an alert.' : 'No matching advisory returned. This does not confirm that conditions are safe.' };
    });
  }
  function rule(topic) {
    return cached(`rule:${topic}`, 24 * 60 * 60_000, async () => {
      const source = RESEARCH_TOPICS[topic];
      const data = await provider('https://api.fetch.tinyfish.ai', { method: 'POST', body: JSON.stringify({ urls: [source.url], format: 'markdown', ttl: 86400, per_url_timeout_ms: 9000 }) });
      const page = data.results?.find(page => page.url === source.url);
      if (!page || typeof page.text !== 'string' || !page.text.trim()) throw new Error('The safety rule could not be read.');
      return { title: source.title, sourceUrl: source.url, text: page.text.slice(0, 12000), hash: pageHash(page.text), jurisdiction: 'US OSHA reference; local applicability requires review.' };
    });
  }
  async function enrich(rawIncident) {
    const incident = validateIncident(rawIncident);
    const result = { incident, site: CONTEXT_SITE, fetchedAt: new Date(clock()).toISOString(), status: 'unavailable', weather: null, rule: null, errors: [], severity: { original: incident.severity, recommended: incident.severity, requiresReview: true, reason: 'Original alert preserved.' } };
    if (!key()) result.errors.push('Live context needs a server-side TINYFISH_API_KEY.');
    else {
      const parts = await Promise.allSettled([weather(), rule(incident.topic)]);
      parts.forEach((part, index) => { if (part.status === 'fulfilled') result[index ? 'rule' : 'weather'] = part.value; else result.errors.push(part.reason?.message || 'Context source unavailable.'); });
      result.status = parts.every(part => part.status === 'fulfilled') ? 'ready' : parts.some(part => part.status === 'fulfilled') ? 'partial' : 'unavailable';
      const relevant = result.weather?.advisories.some(item => item.advisoryTypes.some(type => incident.topic === 'zones' || incident.topic === 'fall' ? ['rain', 'storm'].includes(type) : type === 'heat'));
      if (relevant) result.severity = { original: incident.severity, recommended: ['low', 'medium'].includes(incident.severity) ? 'high' : incident.severity, requiresReview: true, reason: 'Potential weather risk found. Verify this advisory applies to the site and incident before accepting escalation.' };
    }
    try {
      const previous = await store.get(`incident:${incident.id}`);
      if (previous?.review && previous.incident.topic === incident.topic && previous.incident.severity === incident.severity && previous.review.severity === result.severity.recommended) result.review = previous.review;
      await store.put(`incident:${incident.id}`, result);
    } catch { result.errors.push('Context could not be saved. The original alert remains available.'); result.persistence = 'unavailable'; }
    return result;
  }
  return { enrich, provider, rule, weather };
}
export const incidentContext = createContextService();
