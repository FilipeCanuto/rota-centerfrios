// Service worker mínimo: só mostra a página "sem conexão" quando a navegação falha.
// Não guarda dados da carteira no aparelho (dados comerciais ficam sempre no servidor).
const CACHE = "rota-offline-v2"; // troque a versão quando offline.html mudar
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add(new Request("/offline.html", { cache: "reload" }))),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()),
  );
});
