// Login Modal Component
import { signInWithGoogle, logout, auth, onUserChanged } from '../services/firebase.js';
import {
  syncLots,
  syncChurningOrders,
  syncChurnCards,
  uploadLocalData,
  uploadLocalChurningOrders,
  uploadLocalChurnCards
} from '../services/firebaseSync.js';
import {
  setLots,
  setChurningOrders,
  setChurnCards,
  clearAllData,
  getStorageSnapshot,
  backupCurrentDataForUser,
  getBackupDataForUser
} from '../services/storage.js';
import { showToast } from '../services/feedback.js';

let isOpen = false;

// LoginModal() returns empty string - modal is opened/closed via direct DOM manipulation
export function LoginModal() {
  return '';
}

function getModalHtml() {
  const user = auth.currentUser;

  return `
    <div class="modal-overlay bottom-sheet" id="login-modal-overlay">
      <div class="modal-content login-modal">
        <div class="modal-header">
          <h2 class="modal-title">${user ? 'Account' : 'Cloud Sync'}</h2>
          <button class="modal-close" id="close-login-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
      <p>Sign in with Google to sync your inventory, sales, and churning data between your computer and phone automatically.</p>
      
      <button class="btn btn-primary btn-full" id="google-signin-btn" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48">
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

/**
 * Open the login modal by inserting it into the DOM exactly once
 */
function openModal() {
  if (isOpen) return;
  isOpen = true;

  const container = document.getElementById('modal-container');
  if (!container) return;

  // If in demo mode, show a prompt to exit demo first
  if (localStorage.getItem('demoMode') === 'true') {
    container.innerHTML = `
      <div class="modal-overlay bottom-sheet" id="login-modal-overlay">
        <div class="modal-content login-modal">
          <div class="modal-header">
            <h2 class="modal-title">Demo Mode Active</h2>
            <button class="modal-close" id="close-login-modal">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="login-modal-body">
            <div class="login-prompt">
              <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">You're currently viewing demo data. Exit demo mode first to sign in and sync your real inventory.</p>
              <button class="btn btn-primary btn-full" onclick="window.exitDemoMode()">Exit Demo Mode</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = getModalHtml();
}

/**
 * Close the login modal with slide-down animation
 */
function closeModal() {
  if (!isOpen) return;
  isOpen = false;

  const overlay = document.getElementById('login-modal-overlay');
  if (overlay) {
    overlay.classList.add('closing');
    setTimeout(() => {
      const container = document.getElementById('modal-container');
      if (container) container.innerHTML = '';
    }, 250);
  } else {
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
  }
}

function dispatchViewChange() {
  window.dispatchEvent(new CustomEvent('viewchange'));
}

async function resolveInitialCollectionSync({
  key,
  cloudRecords,
  localRecords,
  backupRecords,
  applyLocal,
  uploadLocal,
  resolvedKeys,
  notifyBootstrap,
  label
}) {
  const normalizedCloudRecords = Array.isArray(cloudRecords) ? cloudRecords : [];

  if (resolvedKeys.has(key)) {
    applyLocal(normalizedCloudRecords);
    dispatchViewChange();
    return;
  }

  resolvedKeys.add(key);

  if (normalizedCloudRecords.length > 0) {
    applyLocal(normalizedCloudRecords);
    dispatchViewChange();
    return;
  }

  const fallbackRecords = localRecords.length > 0 ? localRecords : backupRecords;
  const fallbackSource = localRecords.length > 0 ? 'local' : 'backup';

  if (fallbackRecords.length > 0) {
    applyLocal(fallbackRecords);
    dispatchViewChange();

    notifyBootstrap(fallbackSource);

    try {
      await uploadLocal(fallbackRecords);
    } catch (error) {
      console.error(`Failed to bootstrap ${label} into cloud:`, error);
      showToast(`Couldn't sync ${label} to the cloud yet. Your data is still safe on this device.`, {
        variant: 'error',
        title: 'Cloud sync'
      });
    }
    return;
  }

  applyLocal([]);
  dispatchViewChange();
}

let eventsInitialized = false;

export function initLoginModalEvents() {
  // Prevent registering duplicate listeners
  if (eventsInitialized) return;
  eventsInitialized = true;

  // Open modal when profile icon is clicked
  window.addEventListener('open-login-modal', () => {
    openModal();
  });

  // Delegated click handler for modal buttons
  document.addEventListener('click', async (e) => {
    // Google sign-in
    if (e.target.id === 'google-signin-btn' || e.target.closest('#google-signin-btn')) {
      try {
        const user = await signInWithGoogle();
        if (user) {
          closeModal();
        }
      } catch (error) {
        console.error('Sign-in error:', error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
          showToast('Failed to sign in: ' + (error.message || 'Check project config.'), {
            variant: 'error',
            title: 'Cloud sync'
          });
        }
      }
    }

    // Sign out
    if (e.target.id === 'logout-btn') {
      backupCurrentDataForUser(auth.currentUser?.uid);
      await logout();
      closeModal();
    }

    // Close button or overlay click
    if (e.target.closest('#close-login-modal') || e.target.id === 'login-modal-overlay') {
      closeModal();
    }
  });

  // Listen for user changes to start sync listeners
  let syncInitialized = false;
  let syncUnsubscribes = [];

  onUserChanged((user) => {
    if (user && !syncInitialized) {
      syncInitialized = true;
      const localSnapshot = getStorageSnapshot();
      const backupSnapshot = getBackupDataForUser(user.uid);
      const resolvedKeys = new Set();
      let bootstrapNoticeShown = false;

      const notifyBootstrap = (source) => {
        if (bootstrapNoticeShown) return;
        bootstrapNoticeShown = true;
        showToast(
          source === 'backup'
            ? 'Recovered your last local backup and started syncing it to the cloud.'
            : 'Found local data on this device and started syncing it to the cloud.',
          { title: 'Cloud sync' }
        );
      };

      syncUnsubscribes = [
        syncLots(async (cloudLots) => {
          await resolveInitialCollectionSync({
            key: 'lots',
            cloudRecords: cloudLots,
            localRecords: localSnapshot.lots,
            backupRecords: backupSnapshot.lots,
            applyLocal: setLots,
            uploadLocal: uploadLocalData,
            resolvedKeys,
            notifyBootstrap,
            label: 'inventory'
          });
        }),
        syncChurningOrders(async (cloudOrders) => {
          await resolveInitialCollectionSync({
            key: 'churningOrders',
            cloudRecords: cloudOrders,
            localRecords: localSnapshot.churningOrders,
            backupRecords: backupSnapshot.churningOrders,
            applyLocal: setChurningOrders,
            uploadLocal: uploadLocalChurningOrders,
            resolvedKeys,
            notifyBootstrap,
            label: 'churning orders'
          });
        }),
        syncChurnCards(async (cloudCards) => {
          await resolveInitialCollectionSync({
            key: 'churnCards',
            cloudRecords: cloudCards,
            localRecords: localSnapshot.churnCards,
            backupRecords: backupSnapshot.churnCards,
            applyLocal: setChurnCards,
            uploadLocal: uploadLocalChurnCards,
            resolvedKeys,
            notifyBootstrap,
            label: 'cards'
          });
        })
      ].filter(Boolean);
    } else if (!user) {
      syncUnsubscribes.forEach((unsubscribe) => unsubscribe?.());
      syncUnsubscribes = [];
      syncInitialized = false;

      // Clear global data cache entirely when a user signs out to preserve privacy
      // Bypass this wipe if actively running the demo mode
      if (localStorage.getItem('demoMode') !== 'true') {
        clearAllData();
      }

      dispatchViewChange();
    }
  });
}
