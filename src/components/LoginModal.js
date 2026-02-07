// Login Modal Component
import { signInWithGoogle, logout, auth, onUserChanged } from '../services/firebase.js';
import { uploadLocalData, syncLots } from '../services/firebaseSync.js';
import { getLots, setLots } from '../services/storage.js';

let isOpen = false;

export function LoginModal() {
    if (!isOpen) return '';

    const user = auth.currentUser;

    return `
    <div class="modal-overlay" id="login-modal-overlay">
      <div class="modal-content login-modal">
        <div class="modal-header">
          <h2 class="modal-title">${user ? 'Account' : 'Cloud Sync'}</h2>
          <button class="modal-close" id="close-login-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="login-modal-body">
          ${user ? renderUserAccount(user) : renderLoginPrompt()}
        </div>
      </div>
    </div>
  `;
}

function renderLoginPrompt() {
    return `
    <div class="login-prompt">
      <div class="login-icon">☁️</div>
      <h3>Sync Across Devices</h3>
      <p>Sign in with Google to sync your inventory and sales data between your computer and phone automatically.</p>
      
      <button class="btn btn-primary btn-full" id="google-signin-btn" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 3.653 29.315 2 24 2 11.85 2 2 11.85 2 24s9.85 22 22 22c11.045 0 20-8.955 20-20 0-1.303-.115-2.583-.389-3.917z"/>
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 3.653 29.315 2 24 2 16.202 2 9.394 6.06 5.483 12.208z"/>
          <path fill="#4CAF50" d="M24 46c5.441 0 10.183-1.747 13.911-4.706l-6.398-5.33C29.28 37.103 26.743 38 24 38c-5.188 0-9.617-3.231-11.353-7.791l-6.502 5.03C10.08 40.913 16.517 46 24 46z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.398 5.33C42.345 35.318 46 30.136 46 24c0-1.459-.181-2.871-.52-4.226l-.001.002z"/>
        </svg>
        Sign in with Google
      </button>
      
      <p class="login-disclaimer">Your data will be stored securely in the cloud.</p>
    </div>
  `;
}

function renderUserAccount(user) {
    return `
    <div class="user-account">
      <div class="user-info">
        <img src="${user.photoURL}" class="user-avatar-large" alt="${user.displayName}">
        <div class="user-details">
          <h3>${user.displayName}</h3>
          <p>${user.email}</p>
        </div>
      </div>
      
      <div class="sync-status">
        <div class="status-indicator online"></div>
        <span>Cloud Sync Active</span>
      </div>
      
      <button class="btn btn-secondary btn-full" id="logout-btn">Sign Out</button>
    </div>
  `;
}

export function initLoginModalEvents() {
    window.addEventListener('open-login-modal', () => {
        isOpen = true;
        window.dispatchEvent(new CustomEvent('viewchange'));
    });

    document.addEventListener('click', async (e) => {
        if (e.target.id === 'google-signin-btn' || e.target.closest('#google-signin-btn')) {
            try {
                const user = await signInWithGoogle();
                if (user) {
                    // Trigger initial sync: upload local data if cloud is empty
                    // This is a simplified approach
                    const localLots = getLots();
                    if (localLots.length > 0) {
                        await uploadLocalData(localLots);
                    }
                    isOpen = false;
                    window.dispatchEvent(new CustomEvent('viewchange'));
                }
            } catch (error) {
                alert("Failed to sign in. Check project config.");
            }
        }

        if (e.target.id === 'logout-btn') {
            await logout();
            isOpen = false;
            window.dispatchEvent(new CustomEvent('viewchange'));
        }

        if (e.target.id === 'close-login-modal' || e.target.id === 'login-modal-overlay') {
            isOpen = false;
            window.dispatchEvent(new CustomEvent('viewchange'));
        }
    });

    // Listen for user changes to start sync listeners
    onUserChanged((user) => {
        if (user) {
            syncLots((cloudLots) => {
                // When cloud data changes, update local storage and re-render
                if (cloudLots.length > 0) {
                    setLots(cloudLots);
                    window.dispatchEvent(new CustomEvent('viewchange'));
                }
            });
        }
    });
}
