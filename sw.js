// Service worker Wolio Word — cache-first, biar bisa dipakai offline penuh.
// Versi cache: naikkan angka ini tiap kali file inti berubah, biar user
// otomatis dapat update (bukan versi lama yang nyangkut di cache).
const CACHE_NAME = "wolio-word-v1";

// File inti yang WAJIB ada saat build ini dibuat. Kalau salah satu gagal
// di-fetch, instalasi SW gagal total -- makanya cuma isi file yang pasti ada.
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./wolio-logo.svg",
  "./fonts/fraunces-600.woff2",
  "./fonts/atkinson-hyperlegible-400.woff2",
  "./fonts/atkinson-hyperlegible-700.woff2"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Strategi: cache-first, lalu simpan hasil network ke cache secara diam-diam
// (berguna buat file yang belum ada saat SW pertama diinstal, misalnya
// icons/og-image.png yang ditambahkan belakangan).
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        if (response && response.ok && response.type === "basic") {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function () {
        // Offline dan gak ada di cache: kalau ini navigasi halaman,
        // fallback ke index.html biar app tetap kebuka.
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
