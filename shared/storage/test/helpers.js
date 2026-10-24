// A scriptable fake `fetch`: routes are matched in order by method and a URL substring or regex; every call is recorded.
export function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const headers = new Headers(init.headers || {});
    calls.push({ url: String(url), method, headers, body: init.body });
    for (const r of routes) {
      if (r.method && r.method !== method) continue;
      const hit = r.match instanceof RegExp ? r.match.test(String(url)) : String(url).includes(r.match);
      if (!hit) continue;
      if (r.once && r.used) continue;
      r.used = true;
      const out = typeof r.reply === "function" ? r.reply({ url: String(url), method, headers, body: init.body }, calls) : r.reply;
      if (out instanceof Response) return out;
      const { status = 200, json, text, bytes, headers: h = {} } = out;
      const body = bytes !== undefined ? bytes : json !== undefined ? JSON.stringify(json) : text ?? "";
      return new Response(status === 204 ? null : body, { status, headers: h });
    }
    return new Response(JSON.stringify({ error: { message: `no route for ${method} ${url}` } }), { status: 599 });
  };
  fn.calls = calls;
  return fn;
}

export const noSleep = async () => {};
export const text = (bytes) => new TextDecoder().decode(bytes);
export const bytes = (s) => new TextEncoder().encode(s);
