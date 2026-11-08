// Offline support. Try the network first so updates show right away, but if it is
// offline or takes longer than TIMEOUT (weak signal at a raid), use the saved copy.
// Bump VERSION when adding or renaming files.
const VERSION = "v5";
const TIMEOUT = 2500;
const FILES = [
  "./", "index.html", "type-chart.html", "boss.html", "dual-type.html", "search.html", "my-pokemon.html",
  "styles.css", "types.js", "gamedata.js", "battle.js", "collection.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cachedP = cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request, { cache: "no-cache" }).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    const slow = new Promise(r => setTimeout(r, TIMEOUT)).then(() => cachedP);
    // Whichever comes first: the network, or (after TIMEOUT) the cache if it has a copy.
    const first = await Promise.race([fresh.catch(() => null), slow]);
    return first || (await cachedP) || fresh;
  }));
});
