// Service Worker to add COOP/COEP headers for SharedArrayBuffer support
// This enables FFmpeg.wasm to work on GitHub Pages

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle same-origin requests
	if (request.mode === 'navigate' ||
		(request.mode === 'same-origin' && request.destination === 'document')) {
		event.respondWith(
			fetch(request).then((response) => {
				// Clone the response to modify headers
				const newHeaders = new Headers(response.headers);
				newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
				newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: newHeaders
				});
			}).catch(() => fetch(request))
		);
	} else if (request.destination === 'script' ||
			   request.destination === 'worker' ||
			   request.destination === 'style' ||
			   request.destination === 'image' ||
			   request.destination === 'font') {
		// For cross-origin resources, add crossorigin attribute handling
		event.respondWith(
			fetch(request, { mode: 'cors' }).catch(() => fetch(request))
		);
	}
});
