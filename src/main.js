// ResellTracker - Main Application Entry Point

import './styles/main.css';
import { route, initRouter } from './router.js';
import { DashboardView, initDashboardEvents } from './views/DashboardView.js';
import { InventoryView, initInventoryEvents } from './views/InventoryView.js';
import { AddLotView, initAddLotEvents } from './views/AddLotView.js';
import { BottomNav, initBottomNavEvents } from './components/BottomNav.js';
import { LoginModal, initLoginModalEvents } from './components/LoginModal.js';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase.js';

// Get current route from hash
function getCurrentRoute() {
  const hash = window.location.hash.slice(1);
  return hash || '/';
}

// Render the full app layout
function renderApp(viewContent, activeRoute) {
  return viewContent + BottomNav(activeRoute) + LoginModal();
}

// Initialize event handlers for current view
function initEvents() {
  const currentRoute = getCurrentRoute();

  // Always init global components
  initBottomNavEvents();
  initLoginModalEvents();

  // Route-specific events
  switch (currentRoute) {
    case '/':
      initDashboardEvents();
      break;
    case '/inventory':
      initInventoryEvents();
      break;
    case '/add':
      initAddLotEvents();
      break;
  }
}

// Register routes
route('/', () => renderApp(DashboardView(), '/'));
route('/inventory', () => renderApp(InventoryView(), '/inventory'));
route('/add', () => renderApp(AddLotView(), '/add'));

// Initialize router with event callback
initRouter(initEvents);

// Handle custom view change events (for modals, state updates, etc.)
window.addEventListener('viewchange', () => {
  const currentRoute = getCurrentRoute();
  const app = document.getElementById('app');

  let content;
  switch (currentRoute) {
    case '/':
      content = DashboardView();
      break;
    case '/inventory':
      content = InventoryView();
      break;
    case '/add':
      content = AddLotView();
      break;
    default:
      content = DashboardView();
  }

  if (app) {
    app.innerHTML = renderApp(content, currentRoute);
    initEvents();
  }
});

// Handle Firebase Auth state changes globally to re-render
onAuthStateChanged(auth, () => {
  window.dispatchEvent(new CustomEvent('viewchange'));
});

// Register service worker (handled by vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, but app still works
    });
  });
}

console.log('🚀 ResellTracker initialized');
