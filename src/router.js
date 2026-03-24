// Simple hash-based router with directional transitions

const routes = {};
let currentView = null;
let onRouteChange = null;
let currentPath = '/';
let isTransitioning = false;

// Define route order for direction calculation
const routeOrder = ['/', '/inventory', '/churning', '/add', '/sales'];

/**
 * Register a route
 * @param {string} path - Route path (e.g., '/', '/inventory')
 * @param {Function} handler - View render function
 */
export function route(path, handler) {
    routes[path] = handler;
}

/**
 * Navigate to a path with directional transition
 * @param {string} path - Path to navigate to
 */
export function navigate(path, direction = null) {
    // Prevent navigation during transition
    if (isTransitioning) return;

    // Calculate direction if not provided
    if (direction === null) {
        direction = getNavigationDirection(currentPath, path);
    }

    // Store direction for transition handler
    window._navigationDirection = direction;

    window.location.hash = path;
}

/**
 * Get current path from hash
 */
function getPath() {
    let hash = window.location.hash.slice(1);
    // Strip query parameters for route matching
    if (hash.includes('?')) {
        hash = hash.split('?')[0];
    }
    return hash || '/';
}

/**
 * Calculate navigation direction based on route order
 * @param {string} from - Current path
 * @param {string} to - Target path
 * @returns {string} 'forward' or 'reverse'
 */
function getNavigationDirection(from, to) {
    const fromIndex = routeOrder.indexOf(from);
    const toIndex = routeOrder.indexOf(to);

    if (fromIndex === -1 || toIndex === -1) {
        return 'forward';
    }

    return toIndex > fromIndex ? 'forward' : 'reverse';
}

/**
 * Handle route changes with transitions
 */
function handleRoute() {
    const path = getPath();
    const handler = routes[path] || routes['/'];
    const direction = window._navigationDirection || 'forward';

    if (handler) {
        currentView = handler;
        const pageContent = document.getElementById('page-content');

        if (pageContent) {
            // Get the new content
            const newContent = handler();

            // Apply transition only to page-content
            applyPageTransition(pageContent, newContent, direction);

            // Update current path
            currentPath = path;

            // Update bottom nav active state without re-rendering
            updateBottomNavActiveState(path);

            // Call the route change callback to init events immediately
            // This starts animations during the slide-in for smoother experience
            if (onRouteChange) {
                onRouteChange();
            }
        }
    }
}

/**
 * Update bottom nav active state
 * @param {string} activeRoute - Current active route
 */
function updateBottomNavActiveState(activeRoute) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const route = item.dataset.route;
        if (route) {
            item.classList.toggle('active', route === activeRoute);
        }
    });
}

/**
 * Apply page transition animation
 * @param {HTMLElement} pageContent - Page content container
 * @param {string} newContent - New HTML content
 * @param {string} direction - 'forward' or 'reverse'
 */
function applyPageTransition(pageContent, newContent, direction) {
    if (isTransitioning) return;
    isTransitioning = true;

    // Store reference to old content
    const oldContent = pageContent.firstElementChild;

    // Create new content container
    const newContentEl = document.createElement('div');
    newContentEl.className = 'page-view page-enter' + (direction === 'reverse' ? '-reverse' : '');
    newContentEl.innerHTML = newContent;

    // Add new content to page
    pageContent.appendChild(newContentEl);

    // Animate old content out if it exists
    if (oldContent) {
        oldContent.className = 'page-view page-exit' + (direction === 'reverse' ? '-reverse' : '');
    }

    // Clean up after animation
    // Desktop CSS uses instant cut (0ms), Mobile uses sliding animation (~400ms)
    const isDesktop = window.innerWidth >= 1024;
    const transitionDuration = isDesktop ? 0 : 400;

    setTimeout(() => {
        // Remove old content
        if (oldContent && oldContent.parentNode) {
            oldContent.remove();
        }

        // Remove animation classes from new content
        newContentEl.className = 'page-view';

        isTransitioning = false;
    }, transitionDuration);
}

/**
 * Initialize the router
 * @param {Function} callback - Called after each route render
 */
export function initRouter(callback) {
    onRouteChange = callback;
    currentPath = getPath();

    window.addEventListener('hashchange', handleRoute);
}

/**
 * Re-render current view
 */
export function refresh() {
    if (currentView) {
        const pageContent = document.getElementById('page-content');
        if (pageContent) {
            pageContent.innerHTML = currentView();
            if (onRouteChange) {
                onRouteChange();
            }
        }
    }
}

/**
 * Get current route
 */
export function getCurrentRoute() {
    return currentPath;
}
