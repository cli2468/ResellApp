// Bottom Navigation Component

import { navigate } from '../router.js';
import { resetAddLotState } from '../views/AddLotView.js';

export function BottomNav(activeRoute = '/') {
  return `
    <nav class="bottom-nav" aria-label="Primary">
      <button class="nav-item nav-dashboard ${activeRoute === '/' ? 'active' : ''}" type="button" data-route="/" data-anim="dashboard" aria-label="Dashboard" ${activeRoute === '/' ? 'aria-current="page"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="9" fill="currentColor" fill-opacity="0"></rect>
          <rect x="14" y="3" width="7" height="5" fill="currentColor" fill-opacity="0"></rect>
          <rect x="14" y="12" width="7" height="9" fill="currentColor" fill-opacity="0"></rect>
          <rect x="3" y="16" width="7" height="5" fill="currentColor" fill-opacity="0"></rect>
        </svg>
      </button>

      <button class="nav-item nav-inventory ${activeRoute === '/inventory' ? 'active' : ''}" type="button" data-route="/inventory" data-anim="inventory" aria-label="Inventory" ${activeRoute === '/inventory' ? 'aria-current="page"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </button>

      <button class="nav-item nav-churning ${activeRoute === '/churning' ? 'active' : ''}" type="button" data-route="/churning" data-anim="churning" aria-label="Churning" ${activeRoute === '/churning' ? 'aria-current="page"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="3"></rect>
          <path d="M2 10h20"></path>
          <path d="M16 15h2"></path>
        </svg>
      </button>
      
      <button class="nav-item nav-add ${activeRoute === '/add' ? 'active' : ''}" type="button" data-route="/add" data-anim="add" aria-label="Add inventory" ${activeRoute === '/add' ? 'aria-current="page"' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <button class="nav-item nav-account" id="account-btn" type="button" data-anim="account" aria-label="Account">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </button>
    </nav>
  `;
}

let eventsInitialized = false;

export function initBottomNavEvents() {
  if (eventsInitialized) return;
  eventsInitialized = true;

  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      const route = item.dataset.route;
      const animType = item.dataset.anim;

      if (animType) {
        item.classList.add(`${animType}-animating`);
        const duration = animType === 'dashboard' ? 700 : 650;
        setTimeout(() => item.classList.remove(`${animType}-animating`), duration);
      }

      if (route === '/add') {
        resetAddLotState();
      }
      navigate(route);
    });
  });

  // Account button opens login modal
  document.getElementById('account-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.add('account-animating');
    setTimeout(() => btn.classList.remove('account-animating'), 500);
    window.dispatchEvent(new CustomEvent('open-login-modal'));
  });
}
