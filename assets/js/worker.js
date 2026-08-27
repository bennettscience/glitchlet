/* Use a service worker to manage offline behaviors. */

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

self.addEventListener("online", handleConnection);
self.addEventListener("offline", handleConnection);

async function handleConnection() {
  if (navigator.onLine) {
    let status = await isReachable("https://example.com");
    if (status) {
      console.log("There is an active connection");
    } else {
      console.log("No connection");
    }
  } else {
    console.log("Internet is disconnected");
  }
}

async function isReachable(url) {
  console.log("Trying to reach an address");
  try {
    let req = await fetch(url, { method: "HEAD", mode: "no-cors" });
    console.log(req);
    return req && (req.ok || req.type === "opaque");
  } catch (err) {
    console.warn("[connection test failure]: ", err);
    return err;
  }
}

self.navigation.addEventListener("navigate", (event) => {
  console.log("Navigated: ", event);
  event.preventDefault();
  event.respondWith(
    cacheFirst({
      request: event.request,
      fallbackUrl: "../../fallback.html",
    }),
  );
});

self.addEventListener("fetch", (event) => {
  console.log("Fetch requested: ", event);
  event.respondWith(
    cacheFirst({
      request: event.request,
      fallbackUrl: "../../fallback.html",
    }),
  );
});
