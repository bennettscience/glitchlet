const VERSION = "v1";

// Download all app scripts
const cacheResources = [
  "/",
  "./index.html",
  "./assets/styles.css",
  "./assets/js/archive.js",
  "./assets/js/auth.js",
  "./assets/js/core.js",
  "./assets/js/dialogs.js",
  "./assets/js/editor.js",
  "./assets/js/files.js",
  "./assets/js/main.js",
  "./assets/js/paths.js",
  "./assets/js/preview.js",
  "./assets/js/projects.js",
  "./assets/js/storage.js",
  "./assets/js/theme.js",
  "./assets/js/tutorial.js",
  "./assets/js/ui.js",
  "./assets/img/icon.png",
  "./assets/version.js",
  "./fallback.html",
  "./manifest.json",
  "/admin/session.php",
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

/*
On first load, cache all of the assets. From there, intercept fetch calls and respond appropriately with a cached resource or by falling back to a different response if the resource isn't available.
*/
const putInCache = async (request, response) => {
  const cache = await caches.open("glitchlet-v1");
  await cache.put(request, response);
};

const cacheFirst = async ({ request, fallbackUrl }) => {
  // Try to get the resource from the cache
  const respondFromCache = await caches.match(request);
  if (respondFromCache) {
    return respondFromCache;
  }

  // If there is no response, use the network
  try {
    const responseFromHost = await fetch(request);

    // if the request succeeds, clone the response into the cache
    putInCache(request, responseFromHost.clone());
    return responseFromHost;
  } catch (err) {
    // Get the fallback response from the cache
    const fallback = await caches.match(fallbackUrl);
    if (fallback) {
      return fallback;
    }

    // Return a network error if there is no available fallback
    return new Response("Network error", {
      status: 408,
      headers: { "Content-Type": "text/plain" },
    });
  }
};

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
            console.warn("[SW: cache.add failure]", resource);
          }
        }
      }
      return ok;
    }),
  );
  self.skipWaiting();
  console.log("[SW: Installed].");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Break the cache if new assets are available
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
          return undefined;
        }),
      );
    })(),
    self.clients.claim(),
  );
  console.log("[SW: Activated]");
});

self.addEventListener("fetch", (event) => {
  // Use a network first approach to get all assets loaded.
  // Respond to fetches by checking the network first
  // If there is no response, send it from the cache.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        putInCache(event.request.url, response.clone());
        return response;
      } catch (error) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
      }
    })(),
  );
});
