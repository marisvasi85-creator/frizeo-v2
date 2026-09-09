self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler required for PWA installability. Leave requests to the
// browser: proxying every fetch on iOS WebKit rejects with TypeError
// "Load failed" (unhandledrejection on /admin/bookings after cancel/reload).
self.addEventListener("fetch", () => {});
