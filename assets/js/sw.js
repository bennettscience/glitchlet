const VERSION = "v1";
const APP_STATIC_RESOUCES = [
  "/",
  "../../index.html",
  "../styles.css",
  "./auth.js",
  "./core.js",
  "./dialogs.js",
  "./editor.js",
  "./files.js",
  "./main.js",
  "./paths.js",
  "./preview.js",
  "./projects.js",
  "./storage.js",
  "./theme.js",
  "./tutorial.js",
  "./ui.js",
  "./worker.js",
  "../img/icon.png",
  "../version.js",
  "../../fallback.html",
];

const CACHE_NAME = `glitchlet-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      cache.addAll(APP_STATIC_RESOUCES);
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
          return undefined;
        }),
      );
      await clients.claim();
    })(),
  );
});
