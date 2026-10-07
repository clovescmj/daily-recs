// In-memory implementation of the `store` interface used by the recommender, for tests.
export function createMemoryStore(initialState = null) {
  let state = initialState;
  let status = null;
  const statusLog = [];
  return {
    load: async () => (state ? JSON.parse(JSON.stringify(state)) : null),
    save: async (next) => { state = JSON.parse(JSON.stringify(next)); },
    setStatus: async (next) => { status = { ...next, updatedAt: Date.now() }; statusLog.push(status); },
    getStatus: () => status,
    statusLog,
    peek: () => state,
  };
}

/** A fetch that pretends `profileUrl` belongs to the signed-in fan and sends everything else to the real network. */
export function createFetchAs(profileUrl = 'https://bandcamp.com/sumof', fanId = 1881602) {
  return (url, options) => (String(url).includes('collection_summary')
    ? Promise.resolve({ json: async () => ({ fan_id: fanId, collection_summary: { url: profileUrl } }) })
    : fetch(url, { ...options, headers: { 'User-Agent': 'Mozilla/5.0' } }));
}

export function createChecker() {
  let failures = 0;
  const ok = (name, condition, detail = '') => {
    console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!condition) failures++;
  };
  const finish = () => { console.log(failures ? `\n${failures} failure(s)` : '\nall passed'); process.exit(failures ? 1 : 0); };
  return { ok, finish };
}
