// AddLot View - Restructured for Bento UI Picker and Specialized Flows

import { extractOrderData, fileToBase64, createThumbnail } from '../services/ocr.js';
import { saveLot } from '../services/storage.js';
import { navigate } from '../router.js';
import { importLotsFromCSV } from '../services/csvImport.js';
import { showToast } from '../services/feedback.js';

// State management for the new Bento UI
let currentActiveView = 'picker'; // 'picker', 'ocr', 'manual', 'csv'
let ocrState = 'idle'; // 'idle', 'parsing', 'reviewed'
let ocrProgress = 0;
let extractedData = { name: '', cost: 0, quantity: 1, platform: '', purchaseDate: new Date().toISOString().split('T')[0] };
let thumbnailData = null;

// Mobile state (original upload flow)
let mobileState = 'upload'; // 'upload', 'processing', 'preview'
let mobileImagePreview = null;
let mobileImageZoomed = false;

export function resetAddLotState() {
  currentActiveView = 'picker';
  ocrState = 'idle';
  ocrProgress = 0;
  extractedData = { name: '', cost: 0, quantity: 1, platform: '', purchaseDate: new Date().toISOString().split('T')[0] };
  thumbnailData = null;
  mobileState = 'upload';
  mobileImagePreview = null;
  mobileImageZoomed = false;
}

export function AddLotView() {
  const isDesktop = window.innerWidth >= 1024;

  if (!isDesktop) {
    // Mobile: original upload/manual entry flow
    if (mobileState === 'processing') {
      return renderMobileProcessing();
    }
    if (mobileState === 'preview') {
      return renderMobilePreview();
    }
    return renderMobileUpload();
  }

  return `
    <div class="add-inventory-view">
      ${renderHeader()}
      ${currentActiveView === 'picker' ? renderPicker() : renderFlow()}
    </div>
  `;
}

function renderHeader() {
  const methodLabels = {
    'picker': '',
    'ocr': 'Order Screenshot',
    'manual': 'Manual Entry',
    'csv': 'CSV Import'
  };

  const isPicker = currentActiveView === 'picker';

  return `
    <div class="add-inventory-header">
      <div class="add-header-content">
        ${!isPicker ? `
          <div class="add-header-breadcrumb">
            <span id="back-to-picker" class="breadcrumb-back">← Back</span>
            <span class="breadcrumb-sep">/</span>
          </div>
        ` : ''}
        <div class="add-header-title">ADD INVENTORY</div>
        ${!isPicker ? `
          <div class="add-header-breadcrumb">
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">${methodLabels[currentActiveView]}</span>
          </div>
        ` : ''}
        <div class="add-header-divider"></div>
      </div>
    </div>
  `;
}

function renderPicker() {
  return `
    <div class="add-inventory-picker">
      <!-- 01 Order Screenshot Parser (Featured) -->
      <div class="add-method-card featured add-method-card-delay-0" data-view="ocr">
        <div class="card-screenshot-collage card-screenshot-collage-bleed">
          <video autoplay loop muted playsinline class="card-screenshot-video">
            <source src="${import.meta.env.BASE_URL}demo-parser.mp4" type="video/mp4">
          </video>
        </div>
        <div class="add-card-badge">
          <div class="pulse-dot"></div>
          RECOMMENDED
        </div>
        <h2 class="add-card-title">Vision Lens</h2>
        <p class="add-card-desc">Drop in a screenshot of any order confirmation — Amazon, Walmart, Target, Woot, Best Buy. We extract item name, price, quantity, and date automatically.</p>
        <div class="add-card-cta">
          Get started
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>

      <!-- 02 Add Manually -->
      <div class="add-method-card add-method-card-delay-1" data-view="manual">
        <div class="add-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <h2 class="add-card-title">Add Manually</h2>
        <p class="add-card-desc">Fill in the details yourself. Best for single items or when you don't have an order screenshot.</p>
        <div class="add-card-cta">
          Fill form
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>

      <!-- 03 Import CSV -->
      <div class="add-method-card add-method-card-delay-2" data-view="csv">
        <div class="add-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <h2 class="add-card-title">Import CSV</h2>
        <p class="add-card-desc">Bulk import multiple items from a spreadsheet. Download the template to get started.</p>
        <div class="add-card-cta">
          Upload file
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>
    </div>
  `;
}

function renderFlow() {
  const titles = {
    ocr: 'Vision Lens',
    manual: 'Manual Entry',
    csv: 'CSV Import'
  };

  const subtitles = {
    ocr: 'Upload a confirmation screenshot from Amazon, Walmart, Target, Woot, or Best Buy.',
    manual: 'Enter your inventory details manually for single items.',
    csv: 'Bulk import items from a spreadsheet using our template.'
  };

  return `
    <div class="add-inventory-flow">
      <div class="add-flow-content">
        <h1 class="add-flow-title">${titles[currentActiveView]}</h1>
        <p class="add-flow-subtitle">${subtitles[currentActiveView]}</p>
        
        ${currentActiveView === 'ocr' ? renderOcrFlow() : ''}
        ${currentActiveView === 'manual' ? renderManualFlow() : ''}
        ${currentActiveView === 'csv' ? renderCsvFlow() : ''}
      </div>
      
      <div class="add-flow-sidebar">
        ${renderSidebarContent()}
      </div>
    </div>
  `;
}

function renderOcrFlow() {
  if (ocrState === 'idle' || ocrState === 'parsing') {
    return `
      <div class="add-drop-zone" id="ocr-drop-zone">
        <input type="file" id="ocr-file-input" class="file-input-hidden" accept="image/*" />
        <div class="add-drop-title">Drop your screenshot here</div>
        <div class="add-drop-hint">PNG, JPG, WEBP — works with Amazon, Walmart, Target, Woot, Best Buy, and most order confirmation pages</div>
        
        <button class="btn-secondary-add add-browse-btn" id="ocr-browse-btn">Browse file</button>
        
        ${ocrState === 'parsing' ? `
          <div class="add-progress-container">
            <div class="add-progress-bar">
              <div class="add-progress-fill"></div>
            </div>
            <div class="add-progress-text">
              PARSING SCREENSHOT... ${ocrProgress}%
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="teal-notice-bar">
      Fields extracted from screenshot automatically. Please review below.
    </div>
    ${renderInventoryForm(true)}
  `;
}

function renderManualFlow() {
  return renderInventoryForm(false);
}

function renderCsvFlow() {
  return `
    <div class="add-form-group">
      <label class="add-form-label">REQUIRED COLUMNS</label>
      <div class="csv-template-box">
        <div class="csv-template-tags">
          <code class="add-form-code featured">item_name</code>
          <code class="add-form-code featured">purchase_date</code>
          <code class="add-form-code featured">quantity</code>
          <code class="add-form-code featured">total_cost</code>
          <code class="add-form-code">notes</code>
        </div>
        <a href="#" class="csv-template-link">↓ Download template</a>
      </div>
    </div>

    <div class="add-drop-zone add-drop-zone-spaced" id="csv-drop-zone">
      <input type="file" id="csv-file-input" class="file-input-hidden" accept=".csv" />
      <div class="add-drop-title">Drop your CSV here</div>
      <div class="add-drop-hint">Max 500 rows per import &middot; .csv only</div>
      <button class="btn-secondary-add add-browse-btn" id="csv-browse-btn">Browse file</button>
    </div>
    
    <div class="add-form-actions">
      <button class="btn-secondary-add" id="cancel-flow">Cancel</button>
    </div>
  `;
}

function renderInventoryForm(isParsed = false) {
  const costPerUnit = extractedData.quantity > 0 ? (extractedData.cost / extractedData.quantity).toFixed(2) : '0.00';

  return `
    <div class="add-form">
      <div class="add-form-group">
        <label class="add-form-label">ITEM NAME</label>
        <input type="text" class="add-form-input" id="item-name" value="${extractedData.name}" placeholder="e.g. Nike Dunk Low Panda" />
      </div>
      
      <div class="add-form-row">
        <div class="add-form-group">
          <label class="add-form-label">PURCHASE DATE</label>
          <input type="date" class="add-form-input" id="purchase-date" value="${extractedData.purchaseDate}" />
        </div>
      </div>
      
      <div class="add-form-divider"></div>
      
      <div class="add-form-row row-3">
        <div class="add-form-group">
          <label class="add-form-label">QUANTITY</label>
          <div class="quantity-stepper">
            <button type="button" class="stepper-btn" id="add-qty-decrease">-</button>
            <input type="number" 
                   class="add-form-input stepper-input" 
                   id="quantity" 
                   value="${extractedData.quantity}" 
                   min="1" 
                   inputmode="numeric" />
            <button type="button" class="stepper-btn" id="add-qty-increase">+</button>
          </div>
        </div>
        <div class="add-form-group">
          <label class="add-form-label">TOTAL COST</label>
          <div class="input-with-prefix">
            <span class="input-prefix">$</span>
            <input type="number" class="add-form-input has-prefix" id="total-cost" value="${extractedData.cost}" step="0.01" />
          </div>
        </div>
        <div class="add-form-group">
          <label class="add-form-label">COST PER UNIT</label>
          <div class="add-form-input stats-value" id="cost-per-unit-display">
            $${costPerUnit}
          </div>
          <span class="add-form-hint">Auto-calculated</span>
        </div>
      </div>
      
      <div class="add-form-actions add-form-actions-split">
        <button class="btn btn-primary btn-full record-sale-drawer-btn add-form-action-primary" id="save-inventory-btn">Save to Inventory</button>
        <button class="btn btn-secondary-add add-form-action-secondary" id="cancel-flow">${isParsed ? 'Re-upload' : 'Cancel'}</button>
      </div>
    </div>
  `;
}

function renderSidebarContent() {
  if (currentActiveView === 'ocr') {
    return `
      <span class="sidebar-section-title">VISION LENS OCR</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">Drop in a screenshot of any order confirmation from Amazon, Walmart, Target, Woot, or Best Buy.</span>
        </div>
      </div>

      <span class="sidebar-section-title sidebar-section-spaced">TIPS</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Include the full order confirmation page, not just the header</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Make sure the price and quantity are visible in the screenshot</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• You can edit any field after parsing</span>
        </div>
      </div>
    `;
  }

  if (currentActiveView === 'manual') {
    return `
      <span class="sidebar-section-title">HOW IT WORKS</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Cost per unit is calculated automatically from total cost divided by quantity</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• The item will appear in your inventory immediately after saving</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• You can log sales against this item from the Inventory screen</span>
        </div>
      </div>
    `;
  }

  if (currentActiveView === 'csv') {
    return `
      <span class="sidebar-section-title">BEFORE YOU IMPORT</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Download the template first to ensure your columns match the required format</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Dates must be formatted as YYYY-MM-DD</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Cost should be a plain number — no $ signs or commas</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Maximum 500 rows per import</span>
        </div>
      </div>
    `;
  }

  return '';
}

// Event handlers
export function initAddLotEvents() {
  const isDesktop = window.innerWidth >= 1024;
  if (!isDesktop) return;

  // Picker navigation
  document.querySelectorAll('.add-method-card').forEach(card => {
    card.addEventListener('click', () => {
      currentActiveView = card.dataset.view;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Back to picker
  document.getElementById('back-to-picker')?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Flow specific events
  if (currentActiveView === 'ocr') initOcrEvents();
  if (currentActiveView === 'manual') initFormEvents();
  if (currentActiveView === 'csv') initCsvEvents();
}

function initOcrEvents() {
  const dropZone = document.getElementById('ocr-drop-zone');
  const fileInput = document.getElementById('ocr-file-input');
  const browseBtn = document.getElementById('ocr-browse-btn');

  if (ocrState === 'idle' || ocrState === 'parsing') {
    browseBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleOcrUpload(file);
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer?.files[0];
      if (file) handleOcrUpload(file);
    });
  } else {
    initFormEvents();
  }
}

async function handleOcrUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select a valid image file.', {
      variant: 'error',
      title: 'Upload failed'
    });
    return;
  }

  ocrState = 'parsing';
  ocrProgress = 0;
  window.dispatchEvent(new CustomEvent('viewchange'));

  // Simulated parsing delay for better UX (shimmer progress bar)
  // Instead of dispatching viewchange 50 times (causing full layout flashes),
  // we target DOM nodes directly for a perfectly smooth 60fps update progress.
  const interval = setInterval(() => {
    ocrProgress += 5;

    // Direct DOM updates
    const fillEl = document.querySelector('.add-progress-fill');
    const textEl = document.querySelector('.add-progress-text');

    if (fillEl) fillEl.style.width = `${ocrProgress}%`;
    if (textEl) textEl.textContent = `PARSING SCREENSHOT... ${ocrProgress}%`;

    if (ocrProgress >= 100) {
      clearInterval(interval);
      finishParsing(file);
    }
  }, 80);
}

async function finishParsing(file) {
  try {
    const base64 = await fileToBase64(file);
    thumbnailData = await createThumbnail(base64, 200);

    // Call real OCR service
    const result = await extractOrderData(file, (p) => {
      // We already simulated progress for the UI, but we could use the real one
    });

    extractedData = {
      name: result.name || 'Extracted Item Name',
      cost: result.cost || 0,
      quantity: result.quantity || 1,
      platform: result.platform || '',
      purchaseDate: result.purchaseDate || new Date().toISOString().split('T')[0]
    };

    ocrState = 'reviewed';
    window.dispatchEvent(new CustomEvent('viewchange'));
  } catch (error) {
    console.error('OCR failed:', error);
    showToast('Failed to parse image. Reverting to manual entry.', {
      variant: 'error',
      title: 'Screenshot parsing'
    });
    currentActiveView = 'manual';
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

function initFormEvents() {
  const qtyInput = document.getElementById('quantity');
  const costInput = document.getElementById('total-cost');
  const dspl = document.getElementById('cost-per-unit-display');
  const saveBtn = document.getElementById('save-inventory-btn');
  const cancelBtn = document.getElementById('cancel-flow');

  const qtyDec = document.getElementById('add-qty-decrease');
  const qtyInc = document.getElementById('add-qty-increase');

  const updateCalculated = () => {
    const q = parseInt(qtyInput?.value) || 0;
    const c = parseFloat(costInput?.value) || 0;
    const perUnit = q > 0 ? (c / q).toFixed(2) : '0.00';
    if (dspl) dspl.textContent = `$${perUnit}`;
  };

  qtyInput?.addEventListener('input', updateCalculated);
  costInput?.addEventListener('input', updateCalculated);

  qtyDec?.addEventListener('click', () => {
    if (qtyInput) {
      const val = parseInt(qtyInput.value) || 1;
      if (val > 1) {
        qtyInput.value = val - 1;
        updateCalculated();
      }
    }
  });

  qtyInc?.addEventListener('click', () => {
    if (qtyInput) {
      const val = parseInt(qtyInput.value) || 1;
      qtyInput.value = val + 1;
      updateCalculated();
    }
  });

  cancelBtn?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  saveBtn?.addEventListener('click', () => {
    const name = document.getElementById('item-name').value.trim();
    const cost = parseFloat(document.getElementById('total-cost').value) || 0;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const purchaseDate = document.getElementById('purchase-date').value;

    if (!name || cost <= 0) {
      showToast('Please enter a name and valid cost.', {
        variant: 'error',
        title: 'Lot details'
      });
      return;
    }

    saveLot({
      name,
      cost,
      quantity,
      purchaseDate,
      imageData: thumbnailData
    });

    setTimeout(() => {
      resetAddLotState();
      navigate('/inventory');
    }, 100);
  });
}

function initCsvEvents() {
  const browseBtn = document.getElementById('csv-browse-btn');
  const fileInput = document.getElementById('csv-file-input');
  const dropZone = document.getElementById('csv-drop-zone');
  const cancelBtn = document.getElementById('cancel-flow');

  browseBtn?.addEventListener('click', () => fileInput?.click());

  cancelBtn?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleCsvImport(file);
  });

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) handleCsvImport(file);
  });
}

async function handleCsvImport(file) {
  try {
    const result = await importLotsFromCSV(file);
    showToast(`Imported ${result.success} lots successfully.`, {
      variant: 'success',
      title: 'CSV import'
    });
    if (result.success > 0) {
      resetAddLotState();
      navigate('/inventory');
    }
  } catch (err) {
    showToast('Import failed: ' + err.message, {
      variant: 'error',
      title: 'CSV import'
    });
  }
}

// ========== MOBILE VIEW FUNCTIONS ==========

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMobileUpload() {
  return `
    <div class="page">
      <div class="container mobile-add-shell">
        
        <div class="upload-area" id="upload-area">
          <div class="upload-icon">📸</div>
          <div class="upload-text">Tap to upload order screenshot</div>
          <div class="upload-hint">Amazon, Target, Walmart, etc.</div>
        </div>
        
        <input type="file" id="file-input" class="file-input-hidden" accept="image/*" />
        
        <div class="mobile-add-actions">
          <p class="mobile-add-divider-copy text-muted">or</p>
          <button class="btn btn-secondary btn-full" id="manual-entry-btn">
            Enter Manually
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMobileProcessing() {
  return `
    <div class="page">
      <div class="container mobile-add-shell">
        <h1 class="page-title">Add Lot</h1>
        
        <div class="card mobile-processing-card">
          <div class="ocr-progress">
            <div class="progress-spinner"></div>
            <div class="progress-text">Scanning image... ${ocrProgress}%</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMobilePreview() {
  const zoomClass = mobileImageZoomed ? 'zoomed' : '';
  const qty = extractedData.quantity || 1;
  const cost = extractedData.cost || 0;
  const costPerUnit = qty > 0 ? (cost / qty).toFixed(2) : '0.00';
  const today = new Date().toISOString().split('T')[0];

  return `
    <div class="page">
      <div class="container mobile-add-shell mobile-add-preview-shell">
        
        ${mobileImagePreview ? `
          <div class="image-preview-container ${zoomClass}" id="image-preview-container">
            <img src="${mobileImagePreview}" class="image-preview ${zoomClass}" alt="Order screenshot" id="preview-image" />
            <div class="image-hint">${mobileImageZoomed ? 'Tap to shrink' : 'Tap to zoom'}</div>
          </div>
        ` : ''}
        
        <div class="mobile-add-form-card">
          <div class="mobile-add-form-head">
            <h2 class="mobile-add-form-title">Add Inventory</h2>
          </div>

          <div class="form-group mobile-add-form-group">
            <label class="transactional-label">Item Name</label>
            <input type="text" class="form-input form-input-compact" id="lot-name" value="${escapeHtml(extractedData.name)}" placeholder="Enter item name" />
          </div>

          <div class="transaction-grid mobile-add-transaction-grid">
            <div class="form-group mobile-add-grid-field">
              <label class="transactional-label">Quantity</label>
              <div class="quantity-stepper">
                <button type="button" class="stepper-btn" id="decrease-qty">-</button>
                <input type="number" class="form-input form-input-compact stepper-input transactional-input-emphasized" id="lot-quantity" placeholder="1" min="1" value="${qty}" inputmode="numeric" readonly />
                <button type="button" class="stepper-btn" id="increase-qty">+</button>
              </div>
            </div>
            <div class="form-group mobile-add-grid-field">
              <label class="transactional-label">Total Cost ($)</label>
              <input type="number" class="form-input form-input-compact transactional-input-emphasized" id="lot-cost" value="${cost || ''}" placeholder="0.00" step="0.01" min="0" inputmode="decimal" />
            </div>
          </div>

          <div class="form-group mobile-add-form-group">
            <label class="transactional-label">Cost Per Unit</label>
            <div class="form-input form-input-compact mobile-add-readonly" id="cost-per-unit-display">
              $${costPerUnit}
            </div>
            <span class="mobile-add-inline-help">Auto-calculated</span>
          </div>

          <div class="form-group date-group mobile-add-grid-field">
            <label class="transactional-label">Purchase Date</label>
            <input type="date" class="form-input form-input-compact" id="lot-purchase-date" value="${today}" />
          </div>

          <button class="btn btn-transactional-primary btn-full mobile-add-primary-btn" id="save-lot-btn">
            Save to Inventory
          </button>
          <button id="cancel-btn" class="mobile-add-cancel-btn" type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}

async function handleMobileFileUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select a valid image file.', {
      variant: 'error',
      title: 'Upload failed'
    });
    return;
  }

  mobileState = 'processing';
  ocrProgress = 0;
  window.dispatchEvent(new CustomEvent('viewchange'));

  try {
    const base64 = await fileToBase64(file);
    mobileImagePreview = base64;
    thumbnailData = await createThumbnail(base64, 200);

    const result = await extractOrderData(file, (progress) => {
      ocrProgress = progress;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });

    extractedData = {
      name: result.name || '',
      cost: result.cost || 0,
      quantity: result.quantity || 1,
      platform: '',
      purchaseDate: new Date().toISOString().split('T')[0]
    };

    mobileState = 'preview';
    window.dispatchEvent(new CustomEvent('viewchange'));
  } catch (error) {
    console.error('OCR failed:', error);
    showToast('Failed to process image. Please try again or enter manually.', {
      variant: 'error',
      title: 'Screenshot parsing'
    });
    mobileState = 'upload';
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

function mobileSaveLotAndNavigate() {
  const nameInput = document.getElementById('lot-name');
  const costInput = document.getElementById('lot-cost');
  const qtyInput = document.getElementById('lot-quantity');
  const purchaseDateInput = document.getElementById('lot-purchase-date');

  const name = nameInput?.value.trim() || 'Unnamed Item';
  const cost = parseFloat(costInput?.value) || 0;
  const quantity = parseInt(qtyInput?.value) || 1;
  const purchaseDate = purchaseDateInput?.value || new Date().toISOString().split('T')[0];

  if (cost <= 0) {
    showToast('Please enter a valid cost.', {
      variant: 'error',
      title: 'Lot details'
    });
    return;
  }

  saveLot({
    name,
    cost,
    quantity,
    purchaseDate,
    imageData: thumbnailData
  });

  resetAddLotState();
  navigate('/inventory');
}

export function initMobileAddLotEvents() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const manualBtn = document.getElementById('manual-entry-btn');
  const saveBtn = document.getElementById('save-lot-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const nameInput = document.getElementById('lot-name');
  const clearNameBtn = document.getElementById('clear-name-btn');
  const imageContainer = document.getElementById('image-preview-container');
  const decreaseBtn = document.getElementById('decrease-qty');
  const increaseBtn = document.getElementById('increase-qty');
  const qtyInput = document.getElementById('lot-quantity');

  // Upload area click
  uploadArea?.addEventListener('click', () => {
    fileInput?.click();
  });

  // Drag and drop
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('active');
  });

  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('active');
  });

  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('active');
    const file = e.dataTransfer?.files[0];
    if (file) handleMobileFileUpload(file);
  });

  // File input change
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleMobileFileUpload(file);
  });

  // Manual entry
  manualBtn?.addEventListener('click', () => {
    extractedData = { name: '', cost: 0, quantity: 1, platform: '', purchaseDate: new Date().toISOString().split('T')[0] };
    mobileImagePreview = null;
    thumbnailData = null;
    mobileState = 'preview';
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Auto-select item name on load for quick replacement
  if (nameInput && nameInput.value) {
    nameInput.focus();
    nameInput.select();
  }

  // Clear name button
  clearNameBtn?.addEventListener('click', () => {
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
  });

  // Image zoom toggle
  imageContainer?.addEventListener('click', () => {
    mobileImageZoomed = !mobileImageZoomed;
    window.dispatchEvent(new CustomEvent('viewchange'));
    setTimeout(() => {
      const newNameInput = document.getElementById('lot-name');
      if (newNameInput && newNameInput.value) {
        newNameInput.focus();
        newNameInput.select();
      }
    }, 100);
  });

  // Save lot
  saveBtn?.addEventListener('click', mobileSaveLotAndNavigate);

  // Cost per unit auto-calculation
  const costInput = document.getElementById('lot-cost');
  const cpuDisplay = document.getElementById('cost-per-unit-display');
  function updateCostPerUnit() {
    const q = parseInt(qtyInput?.value) || 1;
    const c = parseFloat(costInput?.value) || 0;
    const cpu = q > 0 ? (c / q).toFixed(2) : '0.00';
    if (cpuDisplay) cpuDisplay.textContent = `$${cpu}`;
  }

  costInput?.addEventListener('input', updateCostPerUnit);

  // Quantity stepper
  decreaseBtn?.addEventListener('click', () => {
    const current = parseInt(qtyInput?.value) || 1;
    if (current > 1) {
      qtyInput.value = current - 1;
      updateCostPerUnit();
    }
  });
  increaseBtn?.addEventListener('click', () => {
    const current = parseInt(qtyInput?.value) || 1;
    qtyInput.value = current + 1;
    updateCostPerUnit();
  });

  // Cancel
  cancelBtn?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });
}
