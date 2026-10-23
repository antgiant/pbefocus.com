// Temporary sharing lab for the unified-storage plan (docs/unified-storage-plan.md, Phase 0 item 5).
// Plain ES module, no build step. Public identifiers only (client IDs, a referrer-restricted API key);
// access tokens live in memory (Google) or MSAL's localStorage cache (Microsoft) and are never logged.

const CFG = {
  google: {
    clientId: "332648473500-9b047fgob7vmt7j0nm3ut6gguumsqlur.apps.googleusercontent.com",
    apiKey: "AIzaSyAXzux3Lbfd_fHp2efZTH7E-m5EKLZCxdg",
    appId: "332648473500",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata",
  },
  microsoft: {
    clientId: "86d550b4-029b-4b45-abf0-c8a56aa5bffe",
    authority: "https://login.microsoftonline.com/common",
    scopes: ["Files.ReadWrite.All", "User.Read"],
  },
};

const LAB_VERSION = "5 (folder names without colons)";
const $ = (id) => document.getElementById(id);
// Always the folder's address with a trailing slash, whether the page was opened as .../storage-lab, .../storage-lab/ or .../index.html.
const REDIRECT_URI = location.origin + location.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");
const DEVICE = (() => {
  try {
    let d = sessionStorage.getItem("lab.device");
    if (!d) { d = Math.random().toString(36).slice(2, 6); sessionStorage.setItem("lab.device", d); }
    return d;
  } catch { return "xxxx"; }
})();
const PREFIX = "pbe-lab-";

// ---- log -------------------------------------------------------------------------------------------------------
const logEl = $("log");
function log(msg, data) {
  const t = new Date().toISOString().slice(11, 23);
  const extra = data === undefined ? "" : "\n" + (typeof data === "string" ? data : JSON.stringify(data, null, 2));
  const line = document.createElement("div");
  line.textContent = `${t} ${msg}${extra}`;
  logEl.append(line);
  logEl.scrollTop = logEl.scrollHeight;
}
$("log-clear").onclick = () => { logEl.textContent = ""; };
$("log-copy").onclick = async () => {
  const text = `PBE storage lab log\n${location.href}\n${navigator.userAgent}\n\n${logEl.innerText}`;
  try { await navigator.clipboard.writeText(text); log("Log copied to the clipboard."); }
  catch { log("Could not copy automatically; select the log text and copy it by hand."); }
};
function on(id, fn) {
  $(id).onclick = async () => {
    try { await fn(); } catch (e) { log(`ERROR in ${id}: ${e && e.message ? e.message : e}`); }
  };
}
const stamp = () => Date.now();
const testName = () => `${PREFIX}${DEVICE}-${stamp()}.json`;
const epochOf = (name) => { const m = /-(\d{13})\.json$/.exec(name); return m ? Number(m[1]) : undefined; };

$("info").textContent =
  `Origin to register (Google "Authorized JavaScript origins" and the API key's referrer list):\n  ${location.origin}\n` +
  `Redirect URI to register (Microsoft, platform "Single-page application"):\n  ${REDIRECT_URI}\n` +
  `Lab version: ${LAB_VERSION}\nBrowser: ${navigator.userAgent}\nDevice tag for test files: ${DEVICE}`;

// ---- polling helper --------------------------------------------------------------------------------------------
function makePoller(label, listNames) {
  let timer, stopAt, seen = null, ticks = 0;
  return {
    start(intervalMs = 15000, totalMs = 180000) {
      this.stop();
      seen = null; ticks = 0; stopAt = Date.now() + totalMs;
      const tick = async () => {
        ticks++;
        const t0 = performance.now();
        try {
          const entries = await listNames();
          const ms = Math.round(performance.now() - t0);
          const names = new Set(entries.map((e) => e.name));
          if (seen === null) log(`${label} poll #${ticks}: baseline ${names.size} entries (${ms} ms)`);
          else {
            const added = [...names].filter((n) => !seen.has(n));
            const lag = added.map((n) => ({ name: n, lagSeconds: epochOf(n) ? Math.round((Date.now() - epochOf(n)) / 100) / 10 : "n/a" }));
            log(`${label} poll #${ticks}: ${names.size} entries (${ms} ms), new: ${added.length}`, added.length ? lag : undefined);
          }
          seen = names;
        } catch (e) { log(`${label} poll #${ticks} FAILED: ${e.message}`); }
        if (Date.now() >= stopAt) { this.stop(); log(`${label} polling finished.`); }
      };
      timer = setInterval(tick, intervalMs);
      tick();
    },
    stop() { if (timer) { clearInterval(timer); timer = undefined; log(`${label} polling stopped.`); } },
  };
}

// ====================================================================================================================
// Google
// ====================================================================================================================
const G = { token: null, expiresAt: 0, email: null, folder: null, file: null, files: null, tokenClient: null };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), { src, async: true });
    s.onload = resolve; s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
}
let gisReady, pickerReady;
const loadGis = () => (gisReady ??= loadScript("https://accounts.google.com/gsi/client"));
const loadPicker = () => (pickerReady ??= loadScript("https://apis.google.com/js/api.js").then(() => new Promise((res, rej) => window.gapi.load("picker", { callback: res, onerror: () => rej(new Error("Picker failed to load")) }))));

async function gRequestToken(prompt, hint) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CFG.google.clientId,
      scope: CFG.google.scope,
      callback: (r) => (r.access_token ? resolve(r) : reject(new Error(r.error_description || r.error || "no token"))),
      error_callback: (e) => reject(new Error(e.message || e.type || "cancelled")),
    });
    client.requestAccessToken({ prompt, ...(hint ? { hint } : {}) });
  });
}
async function gSignIn(prompt, hint) {
  const r = await gRequestToken(prompt, hint);
  G.token = r.access_token;
  G.expiresAt = Date.now() + (r.expires_in || 3600) * 1000;
  const about = await gApi("/drive/v3/about?fields=user(emailAddress,displayName)");
  G.email = about.user && about.user.emailAddress;
  $("g-state").textContent = `yes: ${G.email}`;
  log(`Google signed in as ${G.email}; token valid about ${Math.round((G.expiresAt - Date.now()) / 60000)} min.`);
  await gShowScopes();
}
async function gShowScopes() {
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(G.token));
    const j = await r.json();
    log("Scopes actually carried by this token:", (j.scope || "unknown").split(" "));
  } catch (e) { log(`Could not read token scopes: ${e.message}`); }
}
async function gTok() {
  if (!G.token || Date.now() > G.expiresAt - 60000) throw new Error("Google token missing or expired; use Sign in or Silent token.");
  return G.token;
}
async function gApi(path, opts = {}, quiet = false) {
  const base = path.startsWith("http") ? "" : "https://www.googleapis.com";
  const token = G.token && Date.now() < G.expiresAt - 60000 ? G.token : await gTok();
  const res = await fetch(base + path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (!res.ok) {
    let body = ""; try { body = await res.text(); } catch { /* ignore */ }
    let msg = body.slice(0, 300); try { const j = JSON.parse(body); msg = `${j.error.message} (${(j.error.errors || [{}])[0].reason || j.error.status})`; } catch { /* keep raw */ }
    if (!quiet) log(`Google ${opts.method || "GET"} ${path.split("?")[0]} -> HTTP ${res.status}: ${msg}`);
    const err = new Error(`HTTP ${res.status}: ${msg}`); err.status = res.status; throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}
const gNeedFolder = () => { if (!G.folder) throw new Error("Choose a Google folder first."); return G.folder; };
const gSetFolder = (f) => { G.folder = f; $("g-folder").textContent = f ? `${f.name} (${f.id})` : "none"; };

async function gListChildren(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,owners(emailAddress),ownedByMe,capabilities(canEdit))");
  const r = await gApi(`/drive/v3/files?q=${q}&pageSize=200&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return r.files;
}
async function gUpload(meta, content, existingId) {
  if (existingId) {
    return gApi(`/upload/drive/v3/files/${existingId}?uploadType=media&fields=id,name,modifiedTime`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: content });
  }
  const b = "pbe" + Math.random().toString(16).slice(2);
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${b}--`;
  return gApi("/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,parents,modifiedTime", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body });
}

on("g-scopes", async () => { await gTok(); await gShowScopes(); });
on("g-signin", () => gSignIn(G.email ? "" : "select_account", G.email || undefined));
on("g-switch", () => gSignIn("select_account"));
on("g-silent", () => gSignIn("none", G.email || undefined));
on("g-signout", async () => {
  if (G.token && window.google) await new Promise((r) => window.google.accounts.oauth2.revoke(G.token, r));
  Object.assign(G, { token: null, expiresAt: 0, email: null });
  gSetFolder(null);
  $("g-state").textContent = "no";
  log("Google token revoked and cleared.");
});

on("g-pick", async () => {
  const token = await gTok();
  await loadPicker();
  const p = window.google.picker;
  const mine = new p.DocsView(p.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder");
  const shared = new p.DocsView(p.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setOwnedByMe(false).setMimeTypes("application/vnd.google-apps.folder");
  const picked = await new Promise((resolve) => {
    new p.PickerBuilder().addView(mine).addView(shared).setOAuthToken(token).setDeveloperKey(CFG.google.apiKey).setAppId(CFG.google.appId)
      .setTitle("Choose a folder for PBE data")
      .setCallback((d) => {
        if (d.action === p.Action.PICKED && d.docs && d.docs[0]) resolve({ id: d.docs[0].id, name: d.docs[0].name });
        else if (d.action === p.Action.CANCEL) resolve(null);
      }).build().setVisible(true);
  });
  if (!picked) return log("Picker cancelled.");
  gSetFolder(picked);
  log("Picked folder.", picked);
});
on("g-create", async () => {
  const name = `PBE lab ${DEVICE} ${new Date().toISOString().slice(0, 16).replace(":", "-")}`;
  const f = await gApi("/drive/v3/files?fields=id,name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }) });
  gSetFolder({ id: f.id, name: f.name });
  log("Created folder in My Drive and chose it.", f);
});
const gSetFile = (f) => { G.file = f; $("g-file").textContent = f ? `${f.name} (${f.id})` : "none"; };
on("g-pickfile", async () => {
  const token = await gTok();
  await loadPicker();
  const p = window.google.picker;
  const mine = new p.DocsView(p.ViewId.DOCS).setIncludeFolders(true).setMimeTypes("application/json");
  const shared = new p.DocsView(p.ViewId.DOCS).setIncludeFolders(true).setOwnedByMe(false).setMimeTypes("application/json");
  const picked = await new Promise((resolve) => {
    new p.PickerBuilder().addView(mine).addView(shared).setOAuthToken(token).setDeveloperKey(CFG.google.apiKey).setAppId(CFG.google.appId)
      .setTitle("Choose a test file")
      .setCallback((d) => {
        if (d.action === p.Action.PICKED && d.docs && d.docs[0]) resolve({ id: d.docs[0].id, name: d.docs[0].name });
        else if (d.action === p.Action.CANCEL) resolve(null);
      }).build().setVisible(true);
  });
  if (!picked) return log("Picker cancelled.");
  gSetFile(picked);
  log("Picked file.", picked);
});
on("g-readfile", async () => {
  if (!G.file) throw new Error("Pick a file first.");
  const meta = await gApi(`/drive/v3/files/${G.file.id}?fields=id,name,modifiedTime,ownedByMe,owners(emailAddress),capabilities(canEdit)&supportsAllDrives=true`);
  const text = await gApi(`/drive/v3/files/${G.file.id}?alt=media&supportsAllDrives=true`);
  log("Read the picked file (compare with the owner's latest update).", { meta, content: text });
});
on("g-updatefile", async () => {
  if (!G.file) throw new Error("Pick a file first.");
  const r = await gUpload(null, JSON.stringify({ updatedBy: G.email, device: DEVICE, at: new Date().toISOString() }), G.file.id);
  log("Updated the picked file's content.", r);
});
on("g-pickmulti", async () => {
  const f = gNeedFolder();
  const token = await gTok();
  await loadPicker();
  const p = window.google.picker;
  const view = new p.DocsView(p.ViewId.DOCS).setParent(f.id).setIncludeFolders(false).setMimeTypes("application/json");
  const picked = await new Promise((resolve) => {
    new p.PickerBuilder().addView(view).enableFeature(p.Feature.MULTISELECT_ENABLED).setOAuthToken(token).setDeveloperKey(CFG.google.apiKey).setAppId(CFG.google.appId)
      .setTitle("Select the files in this folder")
      .setCallback((d) => {
        if (d.action === p.Action.PICKED && d.docs) resolve(d.docs.map((x) => ({ id: x.id, name: x.name })));
        else if (d.action === p.Action.CANCEL) resolve(null);
      }).build().setVisible(true);
  });
  if (!picked) return log("Picker cancelled.");
  G.files = picked;
  $("g-files").textContent = `${picked.length} files`;
  log(`Picked ${picked.length} files from the folder.`, picked);
});
on("g-readall", async () => {
  if (!G.files || !G.files.length) throw new Error("Pick files first.");
  const out = [];
  for (const x of G.files) {
    try {
      const meta = await gApi(`/drive/v3/files/${x.id}?fields=name,modifiedTime,ownedByMe,owners(emailAddress)&supportsAllDrives=true`, {}, true);
      const content = await gApi(`/drive/v3/files/${x.id}?alt=media&supportsAllDrives=true`, {}, true);
      out.push({ name: meta.name, owner: (meta.owners || [{}])[0].emailAddress, modified: meta.modifiedTime, content });
    } catch (e) { out.push({ name: x.name, error: e.message }); }
  }
  log("Read every picked file.", out);
});
on("g-useid", async () => {
  const id = $("g-id").value.trim();
  if (!id) throw new Error("Paste a folder ID first.");
  const f = await gApi(`/drive/v3/files/${id}?fields=id,name,mimeType,ownedByMe,capabilities(canEdit,canAddChildren,canListChildren)&supportsAllDrives=true`);
  gSetFolder({ id: f.id, name: f.name });
  log("This account/app can open that folder without picking.", f);
});
on("g-caps", async () => {
  const f = gNeedFolder();
  const r = await gApi(`/drive/v3/files/${f.id}?fields=id,name,ownedByMe,owners(emailAddress),shared,capabilities(canEdit,canAddChildren,canListChildren,canShare)&supportsAllDrives=true`);
  log("Folder details as seen by this account/app.", r);
});
on("g-list", async () => {
  const f = gNeedFolder();
  const files = await gListChildren(f.id);
  log(`Listed ${files.length} entries in "${f.name}".`, files.map((x) => ({ name: x.name, owner: (x.owners || [{}])[0].emailAddress, ownedByMe: x.ownedByMe, modified: x.modifiedTime })));
});
on("g-write", async () => {
  const f = gNeedFolder();
  const name = testName();
  const r = await gUpload({ name, parents: [f.id], mimeType: "application/json" }, JSON.stringify({ by: G.email, device: DEVICE, at: new Date().toISOString() }));
  log(`Wrote ${name}.`, r);
});
on("g-read", async () => {
  const f = gNeedFolder();
  const files = (await gListChildren(f.id)).filter((x) => x.name.startsWith(PREFIX)).sort((a, b) => (epochOf(b.name) || 0) - (epochOf(a.name) || 0));
  if (!files.length) return log("No test files visible in the folder.");
  const text = await gApi(`/drive/v3/files/${files[0].id}?alt=media&supportsAllDrives=true`);
  log(`Read ${files[0].name} (written by another account if the owner differs).`, text);
});
on("g-cleanup", async () => {
  const f = gNeedFolder();
  const files = (await gListChildren(f.id)).filter((x) => x.name.startsWith(PREFIX));
  for (const x of files) {
    try { await gApi(`/drive/v3/files/${x.id}?supportsAllDrives=true`, { method: "DELETE" }, true); log(`Deleted ${x.name}.`); }
    catch (e) { log(`Could not delete ${x.name}: ${e.message}`); }
  }
  log(`Cleanup done (${files.length} candidates).`);
});
on("g-share", async () => {
  const f = gNeedFolder();
  const email = $("g-email").value.trim();
  if (!email) throw new Error("Enter the other account's email.");
  const role = $("g-role").value;
  const r = await gApi(`/drive/v3/files/${f.id}/permissions?sendNotificationEmail=true&supportsAllDrives=true&fields=id,role,type,emailAddress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "user", role, emailAddress: email }) });
  log(`Shared "${f.name}" with ${email} as ${role}. Folder ID for reference: ${f.id}`, r);
});
on("g-app-write", async () => {
  const content = JSON.stringify({ folder: G.folder, at: new Date().toISOString(), device: DEVICE });
  const existing = await gApi(`/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent("name='pbe-lab-pointer.json'")}&fields=files(id,name)`);
  const r = await gUpload({ name: "pbe-lab-pointer.json", parents: ["appDataFolder"] }, content, existing.files[0] && existing.files[0].id);
  log(existing.files[0] ? "Updated the appdata pointer." : "Created the appdata pointer.", r);
});
on("g-app-read", async () => {
  const existing = await gApi(`/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent("name='pbe-lab-pointer.json'")}&fields=files(id,name,modifiedTime)`);
  if (!existing.files.length) return log("No appdata pointer found (expected on a brand-new device).");
  const text = await gApi(`/drive/v3/files/${existing.files[0].id}?alt=media`);
  log("Read the appdata pointer.", text);
});
const gPoll = makePoller("Google", () => gListChildren(gNeedFolder().id));
on("g-poll", async () => gPoll.start());
on("g-poll-stop", async () => gPoll.stop());

// ====================================================================================================================
// Microsoft
// ====================================================================================================================
const M = { pca: null, account: null, folder: null, stack: [] };
const GRAPH = "https://graph.microsoft.com/v1.0";

async function mInit() {
  if (!window.msal) { log("Microsoft sign-in library did not load."); return; }
  M.pca = new window.msal.PublicClientApplication({
    auth: { clientId: CFG.microsoft.clientId, authority: CFG.microsoft.authority, redirectUri: REDIRECT_URI },
    cache: { cacheLocation: "localStorage" },
  });
  await M.pca.initialize();
  const result = await M.pca.handleRedirectPromise();
  M.account = (result && result.account) || M.pca.getAllAccounts()[0] || null;
  if (M.account) { M.pca.setActiveAccount(M.account); $("m-state").textContent = `yes: ${M.account.username}`; log(`Microsoft signed in as ${M.account.username}${result ? " (just returned from sign-in)" : " (restored session)"}.`); }
  try { const saved = sessionStorage.getItem("lab.msFolder"); if (saved) mSetFolder(JSON.parse(saved)); } catch { /* ignore */ }
}
async function mTok(interactiveFallback = false) {
  if (!M.account) throw new Error("Not signed in to Microsoft.");
  try { return (await M.pca.acquireTokenSilent({ scopes: CFG.microsoft.scopes, account: M.account })).accessToken; }
  catch (e) {
    log(`Silent Microsoft token failed (${e.errorCode || e.message}).`);
    if (interactiveFallback) { await M.pca.acquireTokenRedirect({ scopes: CFG.microsoft.scopes, account: M.account }); return new Promise(() => {}); }
    throw new Error("Microsoft token needs interactive sign-in; use Sign in.");
  }
}
async function mApi(path, opts = {}, quiet = false) {
  const token = await mTok();
  const url = path.startsWith("http") ? path : GRAPH + path;
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (!res.ok) {
    let body = ""; try { body = await res.text(); } catch { /* ignore */ }
    let msg = body.slice(0, 300); try { const j = JSON.parse(body); msg = `${j.error.message} (${j.error.code})`; } catch { /* keep raw */ }
    if (!quiet) log(`Graph ${opts.method || "GET"} ${path.split("?")[0]} -> HTTP ${res.status}: ${msg}`);
    const err = new Error(`HTTP ${res.status}: ${msg}`); err.status = res.status; throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}
const mNeedFolder = () => { if (!M.folder) throw new Error("Choose a OneDrive folder first."); return M.folder; };
function mSetFolder(f) {
  M.folder = f;
  $("m-folder").textContent = f ? `${f.name} (drive ${String(f.driveId).slice(0, 12)}…, item ${String(f.id).slice(0, 12)}…)` : "none";
  try { if (f) sessionStorage.setItem("lab.msFolder", JSON.stringify(f)); else sessionStorage.removeItem("lab.msFolder"); } catch { /* ignore */ }
}
// A listing entry may be a shortcut or a "shared with me" stub (remoteItem) that lives on another drive.
function mRef(item) {
  const r = item.remoteItem || item;
  return { driveId: (r.parentReference && r.parentReference.driveId) || (item.parentReference && item.parentReference.driveId), id: r.id, name: item.name || r.name, isFolder: !!(r.folder || item.folder), shortcut: !!item.remoteItem };
}
const M_SELECT = "$select=id,name,folder,file,remoteItem,parentReference,size,eTag,lastModifiedDateTime&$top=200";
async function mChildren(ref) {
  const path = ref && ref.driveId ? `/drives/${ref.driveId}/items/${ref.id}/children?${M_SELECT}` : `/me/drive/root/children?${M_SELECT}`;
  const out = [];
  let r = await mApi(path);
  out.push(...r.value);
  while (r["@odata.nextLink"]) { r = await mApi(r["@odata.nextLink"]); out.push(...r.value); }
  return out;
}
function mRender(items, crumbs) {
  const box = $("m-browser");
  box.textContent = "";
  const head = document.createElement("div");
  head.className = "note";
  head.textContent = "Browsing: " + (crumbs.length ? crumbs.map((c) => c.name).join(" / ") : "My files");
  box.append(head);
  if (crumbs.length) {
    const up = document.createElement("button"); up.textContent = "⬆ Up"; up.onclick = () => { M.stack.pop(); mBrowse(M.stack[M.stack.length - 1]); }; box.append(up);
    const choose = document.createElement("button"); choose.textContent = "✔ Choose this folder"; choose.onclick = () => { const c = crumbs[crumbs.length - 1]; mSetFolder({ driveId: c.driveId, id: c.id, name: c.name }); log("Chose folder.", { name: c.name }); }; box.append(choose);
  }
  for (const it of items.filter((x) => mRef(x).isFolder)) {
    const ref = mRef(it);
    const b = document.createElement("button");
    b.textContent = `📁 ${ref.name}${ref.shortcut ? " (shared/shortcut)" : ""}`;
    b.onclick = () => { M.stack.push(ref); mBrowse(ref); };
    box.append(b);
  }
}
async function mBrowse(ref) {
  const items = await mChildren(ref);
  mRender(items, M.stack);
  log(`Listed ${items.length} entries (${items.filter((x) => mRef(x).isFolder).length} folders).`);
}

on("m-signin", async () => { await M.pca.loginRedirect({ scopes: CFG.microsoft.scopes, prompt: "select_account" }); });
on("m-signout", async () => { try { sessionStorage.removeItem("lab.msFolder"); } catch { /* ignore */ } await M.pca.logoutRedirect({ account: M.account || undefined }); });
on("m-silent", async () => { await mTok(); log("Silent Microsoft token OK."); });
on("m-browse", async () => { M.stack = []; await mBrowse(null); });
on("m-shared", async () => {
  const r = await mApi("/me/drive/sharedWithMe");
  log(`sharedWithMe returned ${r.value.length} items (StepUp notes this list can be unreliable).`, r.value.map((x) => ({ name: x.name, folder: !!(x.remoteItem && x.remoteItem.folder), owner: x.remoteItem && x.remoteItem.shared && x.remoteItem.shared.owner && x.remoteItem.shared.owner.user && x.remoteItem.shared.owner.user.displayName })));
  const box = $("m-browser"); box.textContent = "";
  for (const it of r.value.filter((x) => mRef(x).isFolder)) {
    const ref = mRef(it); const b = document.createElement("button");
    b.textContent = `📁 ${ref.name} (shared with me)`; b.onclick = () => { M.stack = [ref]; mBrowse(ref); }; box.append(b);
  }
});
on("m-create", async () => {
  const name = `PBE lab ${DEVICE} ${new Date().toISOString().slice(0, 16).replace(":", "-")}`;
  const f = await mApi("/me/drive/root/children", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }) });
  mSetFolder({ driveId: f.parentReference.driveId, id: f.id, name: f.name });
  log("Created folder and chose it.", { name: f.name });
});
on("m-resolve", async () => {
  const link = $("m-link").value.trim();
  if (!link) throw new Error("Paste a sharing link first.");
  const enc = "u!" + btoa(link).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  const it = await mApi(`/shares/${enc}/driveItem?$select=id,name,folder,parentReference,remoteItem`);
  const ref = mRef(it);
  if (!ref.isFolder) throw new Error("That link is not a folder.");
  mSetFolder({ driveId: ref.driveId, id: ref.id, name: ref.name });
  log("Resolved the sharing link to a folder and chose it.", { name: ref.name });
});
on("m-list", async () => {
  const f = mNeedFolder();
  const items = await mChildren(f);
  log(`Listed ${items.length} entries in "${f.name}".`, items.map((x) => ({ name: x.name, modified: x.lastModifiedDateTime, size: x.size })));
});
on("m-write", async () => {
  const f = mNeedFolder();
  const name = testName();
  const r = await mApi(`/drives/${f.driveId}/items/${f.id}:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=rename`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ by: M.account && M.account.username, device: DEVICE, at: new Date().toISOString() }) });
  log(`Wrote ${name}.`, { id: r.id, eTag: r.eTag });
});
on("m-read", async () => {
  const f = mNeedFolder();
  const files = (await mChildren(f)).filter((x) => x.name.startsWith(PREFIX)).sort((a, b) => (epochOf(b.name) || 0) - (epochOf(a.name) || 0));
  if (!files.length) return log("No test files visible in the folder.");
  const item = await mApi(`/drives/${f.driveId}/items/${files[0].id}?$select=id,name,@microsoft.graph.downloadUrl`);
  const res = await fetch(item["@microsoft.graph.downloadUrl"]);
  log(`Read ${files[0].name}.`, await res.text());
});
on("m-cleanup", async () => {
  const f = mNeedFolder();
  const files = (await mChildren(f)).filter((x) => x.name.startsWith(PREFIX));
  for (const x of files) {
    try { await mApi(`/drives/${f.driveId}/items/${x.id}`, { method: "DELETE" }, true); log(`Deleted ${x.name}.`); }
    catch (e) { log(`Could not delete ${x.name}: ${e.message}`); }
  }
  log(`Cleanup done (${files.length} candidates).`);
});
on("m-invite", async () => {
  const f = mNeedFolder();
  const email = $("m-email").value.trim();
  if (!email) throw new Error("Enter the other account's email.");
  const role = $("m-role").value;
  const r = await mApi(`/drives/${f.driveId}/items/${f.id}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requireSignIn: true, sendInvitation: true, roles: [role], recipients: [{ email }], message: "PBE storage lab test" }) });
  log(`Invited ${email} as ${role}.`, r);
});
on("m-createlink", async () => {
  const f = mNeedFolder();
  const r = await mApi(`/drives/${f.driveId}/items/${f.id}/createLink`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: $("m-linktype").value, scope: $("m-linkscope").value }) });
  log("Created a sharing link (paste it into the other account's lab page).", r.link && r.link.webUrl);
});
on("m-app-write", async () => {
  const r = await mApi("/me/drive/special/approot:/pbe-lab-pointer.json:/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: M.folder, at: new Date().toISOString(), device: DEVICE }) });
  log("Wrote the app-folder pointer.", { id: r.id, path: r.parentReference && r.parentReference.path });
});
on("m-app-read", async () => {
  try { log("Read the app-folder pointer.", await mApi("/me/drive/special/approot:/pbe-lab-pointer.json:/content")); }
  catch (e) { if (e.status === 404) log("No app-folder pointer found (expected on a brand-new device)."); else throw e; }
});
const mPoll = makePoller("Microsoft", async () => (await mChildren(mNeedFolder())).map((x) => ({ name: x.name })));
on("m-poll", async () => mPoll.start());
on("m-poll-stop", async () => mPoll.stop());

mInit().catch((e) => log(`Microsoft init error: ${e.message}`));
log("Lab ready. Sign in on the side you are testing.");
