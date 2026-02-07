// Inventory View - List all lots with sale recording

import { getLots, recordSale, deleteLot, isFullySold, hasSales, getLotTotalProfit, deleteSale, getReturnDeadline, getDaysUntilReturn } from '../services/storage.js';
import { formatCurrency, formatDate, PLATFORM_FEES, calculateSaleProfit } from '../services/calculations.js';

let activeTab = 'all';
let selectedLotId = null;
let salePrice = '';
let unitsSold = '1';
let selectedPlatform = 'facebook';
let expandedLots = new Set();
let shippingCost = '';

export function setActiveTab(tab) {
  activeTab = tab;
}

export function InventoryView() {
  const allLots = getLots();

  let filteredLots = allLots;
  if (activeTab === 'unsold') {
    filteredLots = allLots.filter(lot => lot.remaining > 0);
  } else if (activeTab === 'sold') {
    filteredLots = allLots.filter(lot => isFullySold(lot));
  }

  const modalHtml = selectedLotId ? renderSaleModal() : '';

  return `
    <div class="page">
      <div class="container">
        <h1 class="page-title">Inventory</h1>
        
        <div class="tabs">
          <button class="tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
          <button class="tab ${activeTab === 'unsold' ? 'active' : ''}" data-tab="unsold">Available</button>
          <button class="tab ${activeTab === 'sold' ? 'active' : ''}" data-tab="sold">Sold Out</button>
        </div>
        
        ${filteredLots.length === 0 ? renderEmptyState() : ''}
        
        <div class="lot-list">
          ${filteredLots.map(lot => renderLotCard(lot)).join('')}
        </div>
      </div>
    </div>
    ${modalHtml}
  `;
}


function renderLotCard(lot) {
  const fullySold = isFullySold(lot);
  const hasAnySales = hasSales(lot);
  const totalProfit = getLotTotalProfit(lot);
  const unitsSold = lot.quantity - lot.remaining;
  const soldPercent = Math.round((unitsSold / lot.quantity) * 100);
  const isExpanded = expandedLots.has(lot.id);

  // Return deadline calculation
  const returnDeadline = getReturnDeadline(lot);
  const daysUntilReturn = getDaysUntilReturn(lot);
  const returnDateStr = returnDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const showReturnWarning = !fullySold && daysUntilReturn <= 3 && daysUntilReturn >= 0;

  const thumbnailContent = lot.imageData
    ? `<img src="${lot.imageData}" alt="${lot.name}" />`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      </svg>`;

  const profitHtml = hasAnySales
    ? `<div class="lot-profit ${totalProfit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(totalProfit, true)}</div>`
    : '';

  const progressBar = lot.quantity > 1 ? `
    <div class="lot-progress">
      <div class="lot-progress-bar" style="width: ${soldPercent}%"></div>
    </div>
    <div class="lot-progress-text">${unitsSold} of ${lot.quantity} sold</div>
  ` : '';

  const returnDeadlineHtml = (!fullySold && lot.remaining > 0) ? `
    <div class="lot-return-deadline ${showReturnWarning ? 'urgent' : ''}">
      Return by ${returnDateStr}
    </div>
  ` : '';

  const salesListHtml = (isExpanded && hasAnySales) ? renderSalesList(lot) : '';
  const viewSalesBtn = hasAnySales ? `
    <button class="btn btn-secondary btn-sm toggle-sales" data-lot-id="${lot.id}" style="margin-top: var(--spacing-sm); padding: 4px 8px; font-size: 0.75rem; min-height: 28px;">
      ${isExpanded ? 'Hide Sales' : 'View Sales'}
    </button>
  ` : '';

  return `
    <div class="lot-card ${fullySold ? 'sold' : ''}" data-lot-id="${lot.id}">
      <button class="delete-lot-card-btn" data-lot-id="${lot.id}" title="Delete Lot">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
      <div class="lot-thumbnail">${thumbnailContent}</div>
      <div class="lot-info">
        <div class="lot-name">${lot.name}</div>
        <div class="lot-meta">${formatCurrency(lot.unitCost)}/unit • ${lot.remaining} available</div>
        ${returnDeadlineHtml}
        ${progressBar}
        ${viewSalesBtn}
        ${salesListHtml}
      </div>

      <div class="lot-cost" style="position: relative;">
        ${formatCurrency(lot.totalCost)}
        ${profitHtml}
        ${!fullySold ? `
          <button class="btn btn-primary add-sale-btn" data-lot-id="${lot.id}" style="padding: 4px; min-height: 32px; width: 32px; border-radius: 50%; margin-top: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSalesList(lot) {
  return `
    <div class="sales-list" style="margin-top: var(--spacing-md); border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: var(--spacing-sm);">
      ${lot.sales.map(sale => `
        <div class="sale-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 0.875rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
          <div>
            <div style="font-weight: 500;">Sold ${sale.unitsSold} on ${sale.platform === 'ebay' ? 'eBay' : 'Facebook'}</div>
            <div class="text-muted" style="font-size: 0.75rem;">${formatDate(sale.dateSold, 'short')} • @ ${formatCurrency(sale.pricePerUnit)}</div>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
            <div class="${sale.profit >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: 600;">
              ${formatCurrency(sale.profit, true)}
            </div>
            <button class="delete-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No items yet</div>
      <div class="empty-text">Add your first inventory lot by taking a screenshot of your Amazon order</div>
    </div>
  `;
}

function renderSaleModal() {
  const lot = getLots().find(l => l.id === selectedLotId);
  if (!lot) return '';

  const price = parseFloat(salePrice) || 0;
  const units = Math.min(parseInt(unitsSold) || 1, lot.remaining);
  const priceInCents = Math.round(price * 100);
  const shipping = parseFloat(shippingCost) || 0;
  const shippingCents = Math.round(shipping * 100);

  const { costBasis, totalSalePrice, fees, shippingCost: shippingCalc, profit } = calculateSaleProfit(
    lot.unitCost,
    units,
    priceInCents,
    selectedPlatform,
    selectedPlatform === 'ebay' ? shippingCents : 0
  );

  const isEbay = selectedPlatform === 'ebay';
  const shippingFieldHtml = isEbay ? `
    <div class="form-group shipping-field">
      <label class="form-label">Shipping Cost ($)</label>
      <input type="number" class="form-input" id="shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingCost}" inputmode="decimal" />
    </div>
  ` : '';

  const shippingRowHtml = isEbay ? `
    <div class="summary-row">
      <span class="text-secondary">Shipping Cost</span>
      <span>-${formatCurrency(shippingCalc)}</span>
    </div>
  ` : '';

  // Validation: eBay requires shipping
  const isValid = price > 0 && units > 0 && (!isEbay || shipping >= 0);

  return `
    <div class="modal-overlay" id="sale-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Record Sale</h2>
          <button class="modal-close" id="close-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <p class="text-secondary" style="margin-bottom: var(--spacing-sm);">${lot.name}</p>
        <p class="text-muted" style="margin-bottom: var(--spacing-lg);">
          ${lot.remaining} of ${lot.quantity} available • ${formatCurrency(lot.unitCost)}/unit cost
        </p>
        
        <div class="form-group">
          <label class="form-label">Units to Sell (max ${lot.remaining})</label>
          <input type="number" class="form-input" id="units-sold" placeholder="1" min="1" max="${lot.remaining}" value="${unitsSold}" inputmode="numeric" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Price Per Unit ($)</label>
          <input type="number" class="form-input" id="sale-price" placeholder="0.00" step="0.01" min="0" value="${salePrice}" inputmode="decimal" />
        </div>
        
        <div class="form-group">
          <label class="form-label">Platform</label>
          <div class="platform-grid">
            ${Object.entries(PLATFORM_FEES).map(([key, platform]) => `
              <div class="platform-option ${selectedPlatform === key ? 'selected' : ''}" data-platform="${key}">
                <div class="platform-name">${platform.name}</div>
                <div class="platform-fee">${platform.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        ${shippingFieldHtml}
        
        <div class="summary-box">
          <div class="summary-row">
            <span class="text-secondary">Revenue (${units} × ${formatCurrency(priceInCents)})</span>
            <span>${formatCurrency(totalSalePrice)}</span>
          </div>
          <div class="summary-row">
            <span class="text-secondary">Platform Fees</span>
            <span>-${formatCurrency(fees)}</span>
          </div>
          ${shippingRowHtml}
          <div class="summary-row">
            <span class="text-secondary">Cost Basis</span>
            <span>-${formatCurrency(costBasis)}</span>
          </div>
          <div class="summary-row ${profit >= 0 ? 'profit' : 'loss'}">
            <span>Net Profit</span>
            <span class="summary-value">${formatCurrency(profit)}</span>
          </div>
        </div>
        
        <button class="btn btn-success btn-full" id="confirm-sale" ${!isValid ? 'disabled' : ''}>
          Confirm Sale
        </button>
        
        <button class="btn btn-danger btn-full" id="delete-lot" style="margin-top: var(--spacing-md);">
          Delete Lot
        </button>
      </div>
    </div>
  `;
}

// Update just the lot list content without re-rendering the entire page
function updateLotList() {
  const allLots = getLots();
  let filteredLots = allLots;
  if (activeTab === 'unsold') {
    filteredLots = allLots.filter(lot => lot.remaining > 0);
  } else if (activeTab === 'sold') {
    filteredLots = allLots.filter(lot => isFullySold(lot));
  }

  // Update tab active states
  document.querySelectorAll('.tab').forEach(tab => {
    if (tab.dataset.tab === activeTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update lot list content
  const lotList = document.querySelector('.lot-list');
  const container = document.querySelector('.container');
  if (lotList) {
    lotList.innerHTML = filteredLots.map(lot => renderLotCard(lot)).join('');
  }

  // Handle empty state
  const existingEmptyState = document.querySelector('.empty-state');
  if (filteredLots.length === 0) {
    if (!existingEmptyState && container) {
      const emptyDiv = document.createElement('div');
      emptyDiv.innerHTML = renderEmptyState();
      const lotListEl = document.querySelector('.lot-list');
      if (lotListEl) {
        lotListEl.before(emptyDiv.firstElementChild);
      }
    }
  } else if (existingEmptyState) {
    existingEmptyState.remove();
  }

  // Re-attach event listeners for the new lot cards
  initLotCardEvents();
}

// Update platform selection without full re-render
function updatePlatformSelection(newPlatform) {
  const oldPlatform = selectedPlatform;
  selectedPlatform = newPlatform;

  // Update platform option visual states
  document.querySelectorAll('.platform-option').forEach(opt => {
    if (opt.dataset.platform === newPlatform) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });

  // Handle shipping field visibility
  const modalContent = document.querySelector('.modal-content');
  const existingShippingField = document.querySelector('.shipping-field');
  const summaryBox = document.querySelector('.modal-content .summary-box');

  if (newPlatform === 'ebay' && !existingShippingField && summaryBox) {
    // Add shipping field before summary box
    const shippingDiv = document.createElement('div');
    shippingDiv.className = 'form-group shipping-field';
    shippingDiv.innerHTML = `
      <label class="form-label">Shipping Cost ($)</label>
      <input type="number" class="form-input" id="shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingCost}" inputmode="decimal" />
    `;
    summaryBox.before(shippingDiv);

    // Attach event listener to new shipping input
    document.getElementById('shipping-cost')?.addEventListener('input', (e) => {
      shippingCost = e.target.value;
      updateSummaryBox();
    });
  } else if (newPlatform !== 'ebay' && existingShippingField) {
    // Remove shipping field
    existingShippingField.remove();
    shippingCost = '';
  }

  // Update summary calculations
  updateSummaryBox();
}

// Update just the summary box without re-rendering the entire page
function updateSummaryBox() {
  const lot = getLots().find(l => l.id === selectedLotId);
  if (!lot) return;

  const price = parseFloat(salePrice) || 0;
  const units = Math.min(parseInt(unitsSold) || 1, lot.remaining);
  const priceInCents = Math.round(price * 100);
  const shipping = parseFloat(shippingCost) || 0;
  const shippingCents = Math.round(shipping * 100);
  const isEbay = selectedPlatform === 'ebay';

  const { costBasis, totalSalePrice, fees, shippingCost: shippingCalc, profit } = calculateSaleProfit(
    lot.unitCost,
    units,
    priceInCents,
    selectedPlatform,
    isEbay ? shippingCents : 0
  );

  const isValid = price > 0 && units > 0 && (!isEbay || shipping >= 0);

  // Update summary box
  const summaryBox = document.querySelector('.modal-content .summary-box');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="summary-row">
        <span class="text-secondary">Revenue (${units} × ${formatCurrency(priceInCents)})</span>
        <span>${formatCurrency(totalSalePrice)}</span>
      </div>
      <div class="summary-row">
        <span class="text-secondary">Platform Fees</span>
        <span>-${formatCurrency(fees)}</span>
      </div>
      ${isEbay ? `
      <div class="summary-row">
        <span class="text-secondary">Shipping Cost</span>
        <span>-${formatCurrency(shippingCalc)}</span>
      </div>
      ` : ''}
      <div class="summary-row">
        <span class="text-secondary">Cost Basis</span>
        <span>-${formatCurrency(costBasis)}</span>
      </div>
      <div class="summary-row ${profit >= 0 ? 'profit' : 'loss'}">
        <span>Net Profit</span>
        <span class="summary-value">${formatCurrency(profit)}</span>
      </div>
    `;
  }

  // Update confirm button state
  const confirmBtn = document.getElementById('confirm-sale');
  if (confirmBtn) {
    confirmBtn.disabled = !isValid;
  }
}

export function openSaleModal(lotId) {
  selectedLotId = lotId;
  salePrice = '';
  unitsSold = '1';
  selectedPlatform = 'facebook';
  shippingCost = '';
  window.dispatchEvent(new CustomEvent('viewchange'));
}

export function closeSaleModal() {
  selectedLotId = null;
  salePrice = '';
  unitsSold = '1';
  shippingCost = '';
  window.dispatchEvent(new CustomEvent('viewchange'));
}


// Event handlers specific to lot cards (called after lot list updates)
function initLotCardEvents() {
  // Toggle sales list
  document.querySelectorAll('.toggle-sales').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      if (expandedLots.has(lotId)) {
        expandedLots.delete(lotId);
      } else {
        expandedLots.add(lotId);
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Open sale modal via plus button
  document.querySelectorAll('.add-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSaleModal(btn.dataset.lotId);
    });
  });

  // Delete individual sale
  document.querySelectorAll('.delete-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { lotId, saleId } = btn.dataset;
      if (confirm('Delete this sale record and restore units to inventory?')) {
        deleteSale(lotId, saleId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  });

  // Delete lot shortcut
  document.querySelectorAll('.delete-lot-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      if (confirm('Delete this lot and all its sales history?')) {
        deleteLot(lotId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  });
}

export function initInventoryEvents() {
  // Tab switching - targeted update only
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      activeTab = e.target.dataset.tab;
      updateLotList();
    });
  });

  // Initialize lot card specific events
  initLotCardEvents();

  // Modal events
  document.getElementById('close-modal')?.addEventListener('click', closeSaleModal);
  document.getElementById('sale-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'sale-modal') closeSaleModal();
  });

  // Units sold input - targeted update only
  document.getElementById('units-sold')?.addEventListener('input', (e) => {
    unitsSold = e.target.value;
    updateSummaryBox();
  });

  // Sale price input - targeted update only
  document.getElementById('sale-price')?.addEventListener('input', (e) => {
    salePrice = e.target.value;
    updateSummaryBox();
  });

  // Shipping cost input - targeted update only
  document.getElementById('shipping-cost')?.addEventListener('input', (e) => {
    shippingCost = e.target.value;
    updateSummaryBox();
  });

  // Platform selection - targeted update only
  document.querySelectorAll('.platform-option').forEach(option => {
    option.addEventListener('click', () => {
      updatePlatformSelection(option.dataset.platform);
    });
  });

  // Confirm sale
  document.getElementById('confirm-sale')?.addEventListener('click', () => {
    const price = parseFloat(salePrice);
    const units = parseInt(unitsSold) || 1;
    const shipping = selectedPlatform === 'ebay' ? (parseFloat(shippingCost) || 0) : 0;
    if (price > 0 && units > 0 && selectedLotId) {
      recordSale(selectedLotId, price, units, selectedPlatform, shipping);
      closeSaleModal();
    }
  });

  // Delete lot
  document.getElementById('delete-lot')?.addEventListener('click', () => {
    if (selectedLotId && confirm('Are you sure you want to delete this ENTIRE lot and all its sales?')) {
      deleteLot(selectedLotId);
      closeSaleModal();
    }
  });
}

