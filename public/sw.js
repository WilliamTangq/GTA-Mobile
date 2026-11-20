const CACHE = "island-drive-v1.3.0";
const ASSETS = [
  "./",
  "./style.css",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest",
  "./src/game.js",
  "./src/interactions.js",
  "./src/controls.js",
  "./src/performance.js",
  "./src/session.js",
  "./src/input.js",
  "./src/physics.js",
  "./src/vehicles.js",
  "./src/world.js",
  "./src/software-renderer.js",
  "./src/traffic-ai.js",
  "./src/traffic.js",
  "./src/asset-vehicles.js",
  "./src/effects.js",
  "./vendor/yuka.module.js",
  "./assets/kenney/sport.json",
  "./assets/kenney/suv.json",
  "./assets/kenney/taxi.json",
  "./assets/kenney/police.json",
  "./assets/kenney/truck.json",
  "./vendor/three.module.js",
  "./vendor/three.core.js",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("island-drive-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./", copy));
          }
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
