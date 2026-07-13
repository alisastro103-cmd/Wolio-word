// Wolio Word service worker — network-first for core files (HTML/CSS/JS)
// so updates always take effect, cache-first for fonts/icons that rarely change.
// Cache version: MUST bump this number every time a core file changes, so users
// automatically get the update (instead of an old version stuck in cache forever).
const CACHE_NAME = "wolio-word-v10";

// Files whose content changes OFTEN (app code) -> network-first
const NETWORK_FIRST = [
  "/", "/index.html", "/app.html", "/style.css", "/script.js", "/manifest.json"
];

// Core files that MUST exist when this build is created. If any of them
// fails to fetch, the SW install fails entirely -- so only include files that are guaranteed to exist.
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

  // Core files (HTML/CSS/JS): try the network first so updates always
  // take effect. If offline / failed, fall back to the old cache.
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

  // Static files (fonts, icons, etc.): cache-first, saves quota & is fast.
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
