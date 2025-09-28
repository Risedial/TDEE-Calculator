/**
 * Service Worker for Offline Calorie Calculator PWA
 * Provides offline functionality and app-like experience
 */

const CACHE_NAME = 'calorie-calculator-v1';
const STATIC_CACHE_NAME = 'static-resources-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-resources-v1';

// Static resources to cache immediately
const STATIC_RESOURCES = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './icons/icon-16x16.png',
    './icons/icon-32x32.png',
    './icons/icon-180x180.png',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// Resources to cache on demand
const CACHEABLE_RESPONSES = [
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'image/webp'
];

/**
 * Install event - cache static resources
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static resources');
                return cache.addAll(STATIC_RESOURCES);
            })
            .then(() => {
                console.log('Service Worker: Static resources cached successfully');
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Failed to cache static resources', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old cache versions
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                // Take control of all pages immediately
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('Service Worker: Activation failed', error);
            })
    );
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle different types of requests
    if (isStaticResource(request)) {
        // Static resources: Cache First strategy
        event.respondWith(cacheFirst(request));
    } else if (isAPIRequest(request)) {
        // API requests: Network First strategy (though we don't have external APIs)
        event.respondWith(networkFirst(request));
    } else {
        // Other resources: Stale While Revalidate strategy
        event.respondWith(staleWhileRevalidate(request));
    }
});

/**
 * Check if request is for a static resource
 */
function isStaticResource(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    return pathname.endsWith('.html') ||
           pathname.endsWith('.css') ||
           pathname.endsWith('.js') ||
           pathname.endsWith('.png') ||
           pathname.endsWith('.jpg') ||
           pathname.endsWith('.jpeg') ||
           pathname.endsWith('.gif') ||
           pathname.endsWith('.svg') ||
           pathname.endsWith('.webp') ||
           pathname.endsWith('.ico') ||
           pathname.endsWith('.json') ||
           pathname === '/' ||
           pathname === '/index.html';
}

/**
 * Check if request is for an API endpoint
 */
function isAPIRequest(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/api/') || 
           url.pathname.includes('api');
}

/**
 * Check if response is cacheable
 */
function isCacheableResponse(response) {
    return response.status === 200 && 
           CACHEABLE_RESPONSES.some(type => 
               response.headers.get('content-type')?.includes(type)
           );
}

/**
 * Cache First strategy - serve from cache, fallback to network
 */
async function cacheFirst(request) {
    try {
        // Try to get from cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('Service Worker: Serving from cache', request.url);
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        console.log('Service Worker: Fetching from network', request.url);
        const networkResponse = await fetch(request);
        
        // Cache the response if it's successful
        if (isCacheableResponse(networkResponse)) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Cache First failed', error);
        
        // If both cache and network fail, return offline page or fallback
        if (request.headers.get('accept')?.includes('text/html')) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            return cache.match('./index.html') || 
                   new Response('Application is offline', {
                       status: 503,
                       statusText: 'Service Unavailable'
                   });
        }
        
        throw error;
    }
}

/**
 * Network First strategy - try network first, fallback to cache
 */
async function networkFirst(request) {
    try {
        console.log('Service Worker: Trying network first', request.url);
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (isCacheableResponse(networkResponse)) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache', request.url);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        console.error('Service Worker: Network First failed completely', error);
        throw error;
    }
}

/**
 * Stale While Revalidate strategy - serve from cache, update in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await caches.match(request);
    
    // Fetch fresh version in background
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (isCacheableResponse(networkResponse)) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.error('Service Worker: Background fetch failed', error);
        });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        console.log('Service Worker: Serving stale from cache', request.url);
        return cachedResponse;
    }
    
    // If no cached version, wait for network
    console.log('Service Worker: No cache, waiting for network', request.url);
    return fetchPromise;
}

/**
 * Handle background sync (for future offline form submissions)
 */
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'background-calculation') {
        event.waitUntil(handleBackgroundCalculation());
    }
});

/**
 * Handle background calculation sync
 */
async function handleBackgroundCalculation() {
    try {
        // This could be used for syncing calculation history or preferences
        console.log('Service Worker: Handling background calculation sync');
        
        // For now, just log that we're ready for background sync
        // In a real app, this might sync calculation history to a server
        return Promise.resolve();
    } catch (error) {
        console.error('Service Worker: Background calculation sync failed', error);
        throw error;
    }
}

/**
 * Handle push notifications (for future features)
 */
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New notification from Calorie Calculator',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-32x32.png',
        vibrate: [200, 100, 200],
        tag: 'calorie-calculator',
        actions: [
            {
                action: 'open',
                title: 'Open Calculator',
                icon: './icons/icon-32x32.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Calorie Calculator', options)
    );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('./index.html')
        );
    }
});

/**
 * Handle messages from main app
 */
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(DYNAMIC_CACHE_NAME)
                .then(cache => cache.addAll(event.data.payload))
        );
    }
});

/**
 * Periodic background sync (for browsers that support it)
 */
self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync triggered', event.tag);
    
    if (event.tag === 'daily-tips') {
        event.waitUntil(handleDailyTipsSync());
    }
});

/**
 * Handle daily tips sync
 */
async function handleDailyTipsSync() {
    try {
        console.log('Service Worker: Handling daily tips sync');
        // This could fetch daily health tips or reminders
        // For now, just log the capability
        return Promise.resolve();
    } catch (error) {
        console.error('Service Worker: Daily tips sync failed', error);
        throw error;
    }
}

console.log('Service Worker: Script loaded successfully'); 