// Guarda os arquivos do app para funcionar sem internet dentro do galpão.
const CACHE = "lastro-contagem-v2";
const ARQUIVOS = ["./", "./index.html", "./app.css", "./app.js", "./planilha.js", "./manifest.webmanifest", "../assets/logo.svg", "../assets/instrument-sans.woff"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // rede primeiro (pega versão nova), cache se estiver sem internet
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
