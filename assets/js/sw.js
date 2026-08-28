const VERSION = "v1";

// Download all app scripts
const cacheResources = [
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
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/xml/xml.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/javascript/javascript.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/css/css.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/htmlmixed/htmlmixed.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/matchbrackets.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/closebrackets.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/closetag.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/foldcode.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/foldgutter.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/brace-fold.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/indent-fold.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/comment-fold.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/xml-fold.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/fold/markdown-fold.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/search/searchcursor.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/search/search.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/dialog/dialog.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/show-hint.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/html-hint.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/css-hint.js",
  "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/xml-hint.js",
  "https://unpkg.com/prettier@3.8.0/standalone.js",
  "https://unpkg.com/prettier@3.8.0/plugins/babel.js",
  "https://unpkg.com/prettier@3.8.0/plugins/estree.js",
  "https://unpkg.com/prettier@3.8.0/plugins/html.js",
  "https://unpkg.com/prettier@3.8.0/plugins/postcss.js",
  "https://unpkg.com/lucide@0.454.0/dist/umd/lucide.min.js",
];

const CACHE_NAME = `glitchlet-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      let ok;
      console.log("[SW: Caching files]:", cacheResources.length);
      try {
        ok = await cache.addAll(cacheResources);
      } catch (err) {
        console.error("[SW: cache.addAll]");
        for (let resource of cacheResources) {
          try {
            ok = await cache.add(resource);
          } catch (err) {
            console.warn("[SW: cache.add]", resource);
          }
        }
      }
      return ok;
    }),
  );
  console.log("ServiceWorker installed.");
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
