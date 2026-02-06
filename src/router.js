// Simple hash-based router

const routes = {};
let currentView = null;
let onRouteChange = null;

/**
 * Register a route
 * @param {string} path - Route path (e.g., '/', '/inventory')
 * @param {Function} handler - View render function
 */
export function route(path, handler) {
    routes[path] = handler;
}

/**
 * Navigate to a path
 * @param {string} path - Path to navigate to
 */
export function navigate(path) {
    window.location.hash = path;
}

/**
 * Get current path from hash
 */
function getPath() {
    const hash = window.location.hash.slice(1);
    return hash || '/';
}

/**
 * Handle route changes
 */
function handleRoute() {
    const path = getPath();
    const handler = routes[path] || routes['/'];

    if (handler) {
        currentView = handler;
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = handler();
            // Call the route change callback to init events
            if (onRouteChange) {
                onRouteChange();
            }
        }
    }
}

/**
 * Initialize the router
 * @param {Function} callback - Called after each route render
 */
export function initRouter(callback) {
    onRouteChange = callback;

    window.addEventListener('hashchange', handleRoute);

    // Initial route on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.location.hash) {
                window.location.hash = '/';
            } else {
                handleRoute();
            }
        });
    } else {
        if (!window.location.hash) {
            window.location.hash = '/';
        } else {
            handleRoute();
        }
    }
}

/**
 * Re-render current view
 */
export function refresh() {
    if (currentView) {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = currentView();
            if (onRouteChange) {
                onRouteChange();
            }
        }
    }
}
