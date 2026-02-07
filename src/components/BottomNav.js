// Bottom Navigation Component

import { navigate } from '../router.js';
import { resetAddLotState } from '../views/AddLotView.js';
import { auth } from '../services/firebase.js';

export function BottomNav(activeRoute = '/') {
  const user = auth.currentUser;
  const userAvatar = user ? `<img src="${user.photoURL}" class="nav-avatar" alt="Profile">` : `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  `;

  return `
    <nav class="bottom-nav">
      <button class="nav-item ${activeRoute === '/' ? 'active' : ''}" data-route="/">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="9"></rect>
          <rect x="14" y="3" width="7" height="5"></rect>
          <rect x="14" y="12" width="7" height="9"></rect>
          <rect x="3" y="16" width="7" height="5"></rect>
        </svg>
        <span>Dashboard</span>
      </button>

      <button class="nav-item ${activeRoute === '/inventory' ? 'active' : ''}" data-route="/inventory">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span>Inventory</span>
      </button>
      
      <button class="nav-item add-btn" data-route="/add">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <button class="nav-item" id="account-btn">
        ${userAvatar}
        <span>${user ? 'Account' : 'Login'}</span>
      </button>
    </nav>
  `;
}

export function initBottomNavEvents() {
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      if (route === '/add') {
        resetAddLotState();
      }
      navigate(route);
    });
  });

  document.getElementById('account-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-login-modal'));
  });
}
