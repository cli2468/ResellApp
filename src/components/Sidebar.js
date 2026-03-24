// Desktop Sidebar Navigation Component

import { navigate } from '../router.js';
import { resetAddLotState } from '../views/AddLotView.js';
import { auth, logout } from '../services/firebase.js';

let isCollapsed = false;

export function Sidebar(activeRoute = '/') {
  const user = auth.currentUser;

  const menuItems = [
    { route: '/', label: 'Dashboard', icon: 'dashboard' },
    { route: '/inventory', label: 'Inventory', icon: 'inventory' },
    { route: '/churning', label: 'Churning', icon: 'churning' },
    { route: '/sales', label: 'Sales', icon: 'sales' },
    { route: '/add', label: 'Add', icon: 'add' }
  ];

  const iconSvgs = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    inventory: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    churning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"></rect><path d="M2 10h20"></path><path d="M16 15h2"></path></svg>`,
    sales: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    login: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`,
    add: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
    chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
  };

  const menuHtml = menuItems.map(item => `
    <button 
      class="sidebar-nav-item ${activeRoute === item.route ? 'active' : ''}" 
      data-route="${item.route}"
    >
      <div class="sidebar-nav-icon">${iconSvgs[item.icon]}</div>
      <div class="collapsible-content sidebar-nav-label">${item.label}</div>
      <div class="sidebar-tooltip">${item.label}</div>
    </button>
  `).join('');

  // The Profile Footer replaces the basic Auth buttons
  const authHtml = user ? `
    <div class="sidebar-profile-wrapper">
      <button class="sidebar-profile-btn" id="sidebar-profile-btn">
        <div class="profile-avatar">CH</div>
        <div class="collapsible-content profile-info">
          <div class="profile-name">Chris</div>
          <div class="profile-role">Admin</div>
        </div>
      </button>
      <div class="profile-popover" id="profile-popover">
        <button class="popover-item"><span class="popover-icon">${iconSvgs.settings}</span> Settings</button>
        <button class="popover-item logout-trigger" id="sidebar-logout-btn"><span class="popover-icon">${iconSvgs.logout}</span> Log out</button>
      </div>
    </div>
  ` : `
    <button class="sidebar-nav-item sidebar-login-btn" id="sidebar-login-btn" onclick="window.dispatchEvent(new CustomEvent('open-login-modal'))">
      <div class="sidebar-nav-icon">${iconSvgs.login}</div>
      <div class="collapsible-content sidebar-nav-label">Log in / Sync</div>
      <div class="sidebar-tooltip">Log in / Sync</div>
    </button>
  `;

  const isDemo = localStorage.getItem('demoMode') === 'true';
  const demoButtonHtml = (!isDemo && !user) ? `
    <button class="sidebar-nav-item sidebar-demo-btn" id="sidebar-demo-btn" onclick="window.loadDemoMode()">
      <div class="sidebar-nav-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </div>
      <div class="collapsible-content sidebar-nav-label">Try Demo</div>
      <div class="sidebar-tooltip">Try Demo</div>
    </button>
  ` : '';

  return `
    <aside class="desktop-sidebar ${isCollapsed ? 'collapsed' : ''}" data-collapsed="${isCollapsed}">
      <div class="sidebar-header">
        <div class="sidebar-brand-group">
          <div class="brand-logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green, #2dd4bf)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div class="collapsible-content brand-name">Vision</div>
        </div>
        <!-- Toggle button is hidden in CSS when collapsed -->
        <button
          class="sidebar-toggle"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          ${iconSvgs.chevron}
        </button>
      </div>
      <div class="sidebar-header-divider"></div>
      
      <div class="sidebar-section">
        <div class="collapsible-content sidebar-section-label">MENU</div>
        <nav class="sidebar-nav">
           ${menuHtml}
        </nav>
      </div>

      <div class="sidebar-footer">
        ${demoButtonHtml}
        ${authHtml}
      </div>
    </aside>
  `;
}

export function toggleSidebar() {
  isCollapsed = !isCollapsed;
  const app = document.getElementById('app');
  const sidebar = document.querySelector('.desktop-sidebar');

  if (app) {
    app.classList.toggle('sidebar-collapsed', isCollapsed);
  }

  if (sidebar) {
    sidebar.classList.toggle('collapsed', isCollapsed);
    sidebar.setAttribute('data-collapsed', isCollapsed);

    // Update toggle aria
    const toggleBtn = sidebar.querySelector('.sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.title = (isCollapsed ? 'Expand' : 'Collapse') + ' sidebar';
      toggleBtn.setAttribute('aria-label', (isCollapsed ? 'Expand' : 'Collapse') + ' sidebar');
    }
  }
}

export function isSidebarCollapsed() {
  return isCollapsed;
}

let eventsInitialized = false;

export function initSidebarEvents() {
  if (eventsInitialized) return;
  eventsInitialized = true;

  // Navigation item clicks
  document.querySelectorAll('.sidebar-nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;

      if (route === '/add') {
        resetAddLotState();
      }

      // Auto-expand if clicking nav while collapsed
      if (isCollapsed) {
        toggleSidebar(); // Trigger expansion unconditionally
      }

      document.querySelectorAll('.sidebar-nav-item[data-route]').forEach(navItem => {
        navItem.classList.toggle('active', navItem.dataset.route === route);
      });
      navigate(route);
    });
  });

  // Keep sidebar active state in sync with hash navigation from other controls
  window.addEventListener('hashchange', () => {
    const currentRoute = window.location.hash.slice(1) || '/';
    document.querySelectorAll('.sidebar-nav-item[data-route]').forEach(item => {
      item.classList.toggle('active', item.dataset.route === currentRoute);
    });
  });

  // Sidebar toggle button
  const toggleBtn = document.querySelector('.sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  bindAuthEvents();

  // Tooltip handling for collapsed mode
  const sidebar = document.querySelector('.desktop-sidebar');
  if (sidebar) {
    sidebar.addEventListener('mouseenter', (e) => {
      if (sidebar.classList.contains('collapsed') && e.target.classList.contains('sidebar-nav-item')) {
        showTooltip(e.target);
      }
    }, true);

    sidebar.addEventListener('mouseleave', (e) => {
      if (e.target.classList.contains('sidebar-nav-item')) {
        hideTooltip(e.target);
      }
    }, true);
  }
}

function bindAuthEvents() {
  const profileBtn = document.getElementById('sidebar-profile-btn');
  const profilePopover = document.getElementById('profile-popover');
  const logoutBtn = document.getElementById('sidebar-logout-btn');

  // Popover toggle
  if (profileBtn && profilePopover) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profilePopover.classList.toggle('visible');
    });

    // Close popover on outside click
    document.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !profilePopover.contains(e.target)) {
        profilePopover.classList.remove('visible');
      }
    });
  }

  // Logout trigger
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (profilePopover) profilePopover.classList.remove('visible');
      await logout();
    });
  }
}

function showTooltip(element) {
  const tooltip = element.querySelector('.sidebar-tooltip');
  if (tooltip) {
    tooltip.classList.add('visible');
  }
}

function hideTooltip(element) {
  const tooltip = element.querySelector('.sidebar-tooltip');
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

/**
 * Updates the authentication button region in the Sidebar dynamically.
 */
export function updateSidebarAuthState() {
  const sidebar = document.querySelector('.desktop-sidebar');
  if (!sidebar) return;

  const user = auth.currentUser;
  const footerNode = sidebar.querySelector('.sidebar-footer');
  if (!footerNode) return;

  const iconSvgs = {
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    login: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
  };

  const authHtml = user ? `
    <div class="sidebar-profile-wrapper">
      <button class="sidebar-profile-btn" id="sidebar-profile-btn">
        <div class="profile-avatar">CH</div>
        <div class="collapsible-content profile-info">
          <div class="profile-name">Chris</div>
          <div class="profile-role">Admin</div>
        </div>
      </button>
      <div class="profile-popover" id="profile-popover">
        <button class="popover-item"><span class="popover-icon">${iconSvgs.settings}</span> Settings</button>
        <button class="popover-item logout-trigger" id="sidebar-logout-btn"><span class="popover-icon">${iconSvgs.logout}</span> Log out</button>
      </div>
    </div>
  ` : `
    <button class="sidebar-nav-item sidebar-login-btn" id="sidebar-login-btn" onclick="window.dispatchEvent(new CustomEvent('open-login-modal'))">
      <div class="sidebar-nav-icon">${iconSvgs.login}</div>
      <div class="collapsible-content sidebar-nav-label">Log in / Sync</div>
      <div class="sidebar-tooltip">Log in / Sync</div>
    </button>
  `;

  footerNode.innerHTML = (localStorage.getItem('demoMode') !== 'true' && !user ? `
    <button class="sidebar-nav-item sidebar-demo-btn" id="sidebar-demo-btn" onclick="window.loadDemoMode()">
      <div class="sidebar-nav-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </div>
      <div class="collapsible-content sidebar-nav-label">Try Demo</div>
      <div class="sidebar-tooltip">Try Demo</div>
    </button>
  ` : '') + authHtml;

  // Bind events only to the newly injected auth elements
  bindAuthEvents();
}
