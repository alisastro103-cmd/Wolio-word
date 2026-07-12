// Service worker Wolio Word — network-first untuk file inti (HTML/CSS/JS)
// biar update selalu kepakai, cache-first untuk font/icon yang jarang berubah.
// Versi cache: WAJIB naikkan angka ini tiap kali file inti berubah, biar user
// otomatis dapat update (bukan versi lama yang nyangkut di cache selamanya).
const CACHE_NAME = "wolio-word-v4";

// File yang isinya SERING berubah (kode aplikasi) -> network-first
const NETWORK_FIRST = [
  "/", "/index.html", "/app.html", "/style.css", "/script.js", "/manifest.json"
];

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

function isNetworkFirst(request) {
  if (request.mode === "navigate") return true;
  try {
    var path = new URL(request.url).pathname;
    return NETWORK_FIRST.some(function (p) {
      return path === p || path.endsWith(p.replace("/", ""));
    });
  } catch (e) {
    return false;
  }
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  // File inti (HTML/CSS/JS): coba jaringan dulu supaya update selalu
  // kepakai. Kalau offline / gagal, baru jatuh ke cache lama.
  if (isNetworkFirst(event.request)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.ok && response.type === "basic") {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // File statis (font, ikon, dll): cache-first, hemat kuota & cepat.
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
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
