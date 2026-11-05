// Network-only by design: no HTML, API, location, credentials or provider data
// enters Cache Storage. An offline navigation fails instead of showing old data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
