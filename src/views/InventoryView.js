// Inventory View - List all lots with sale recording

import { getLots, recordSale, deleteLot, updateLot, isFullySold, hasSales, getLotTotalProfit, deleteSale, updateSale, getReturnDeadline, getDaysUntilReturn, markSaleReturned } from '../services/storage.js';
import { formatCurrency, formatDate, PLATFORM_FEES, calculateSaleProfit } from '../services/calculations.js';
import { importLotsFromCSV, generateCSVTemplate } from '../services/csvImport.js';
import { celebrateSuccess } from '../utils/animations.js';
import { DesktopInventoryView, initDesktopInventoryEvents } from './DesktopInventoryView.js';
import { confirmAction, showToast } from '../services/feedback.js';

let activeTab = 'unsold';
let searchQuery = '';
let sortOrder = 'newest';
let selectedLotId = null;
let salePrice = '';
let unitsSold = '1';
let selectedPlatform = 'facebook';
let expandedLots = new Set();
let shippingCost = '';
let saleDate = new Date().toISOString().split('T')[0]; // Default to today

// Edit sale state
let editSaleData = null; // { lotId, saleId, sale }
let editSalePrice = '';
let editShippingCost = '';
let editSaleDate = '';

// Edit lot state
let editLotData = null; // { lot }
let editLotName = '';
let editLotUnitCost = '';
let editLotQuantity = '';
let editLotPurchaseDate = '';
let editLotEventsAttached = false;

export function setActiveTab(tab) {
  activeTab = tab;
}

export function getActiveTab() {
  return activeTab;
}

export function setSearchQuery(query) {
  searchQuery = query;
}

export function getSearchQuery() {
  return searchQuery;
}

function getFilteredAndSortedLots() {
  const allLots = getLots();
  let filteredLots = allLots;
  if (activeTab === 'unsold') {
    filteredLots = allLots.filter(lot => lot.remaining > 0);
  } else if (activeTab === 'sold') {
    filteredLots = allLots.filter(lot => isFullySold(lot));
  }

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredLots = filteredLots.filter(lot => lot.name.toLowerCase().includes(q));
  }

  // Sort
  filteredLots = [...filteredLots];
  switch (sortOrder) {
    case 'newest':
      filteredLots.sort((a, b) => new Date(b.purchaseDate || b.dateAdded || 0) - new Date(a.purchaseDate || a.dateAdded || 0));
      break;
    case 'oldest':
      filteredLots.sort((a, b) => new Date(a.purchaseDate || a.dateAdded || 0) - new Date(b.purchaseDate || b.dateAdded || 0));
      break;
    case 'highest':
      filteredLots.sort((a, b) => b.totalCost - a.totalCost);
      break;
    case 'lowest':
      filteredLots.sort((a, b) => a.totalCost - b.totalCost);
      break;
  }
  return filteredLots;
}

function isDesktopViewport() {
  return window.innerWidth >= 1280;
}

export function InventoryView() {
  // Use desktop layout on large screens
  if (isDesktopViewport()) {
    return DesktopInventoryView();
  }

  const filteredLots = getFilteredAndSortedLots();

  const modalHtml = selectedLotId ? renderSaleModal() : '';
  const editSaleModalHtml = editSaleData ? renderEditSaleModal() : '';
  const editLotModalHtml = editLotData ? renderEditLotModal() : '';

  return `
    <div class="page">
      <div class="container">
        <div class="tabs">
          <button class="tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">All</button>
          <button class="tab ${activeTab === 'unsold' ? 'active' : ''}" data-tab="unsold">Available</button>
          <button class="tab ${activeTab === 'sold' ? 'active' : ''}" data-tab="sold">Sold Out</button>
        </div>

        <div class="inventory-controls">
          <div class="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" class="search-input" id="inventory-search" placeholder="Search items..." value="${searchQuery}" />
          </div>
          <select class="sort-dropdown" id="inventory-sort">
            <option value="newest" ${sortOrder === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="oldest" ${sortOrder === 'oldest' ? 'selected' : ''}>Oldest</option>
            <option value="highest" ${sortOrder === 'highest' ? 'selected' : ''}>Highest $</option>
            <option value="lowest" ${sortOrder === 'lowest' ? 'selected' : ''}>Lowest $</option>
          </select>
        </div>
        
        ${filteredLots.length === 0 ? renderEmptyState() : ''}
         
        <div class="lot-list">
          ${filteredLots.map((lot, index) => renderLotCard(lot, index)).join('')}
        </div>
      </div>
    </div>
    ${modalHtml}
    ${editSaleModalHtml}
    ${editLotModalHtml}
  `;
}


function renderLotCard(lot, index = 0) {
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

  // Profit display with restrained emphasis
  const profitDisplay = hasAnySales ? (() => {
    const isPositive = totalProfit >= 0;
    const profitClass = isPositive ? 'profit-positive' : 'profit-negative';
    return `<div class="lot-profit ${profitClass}" data-profit="${totalProfit}">${formatCurrency(totalProfit, true)}</div>`;
  })() : '';

  // Progress bar with sell-through label
  const progressBar = lot.quantity > 1 ? `
    <div class="lot-progress-container">
      <div class="lot-progress-header">
        <span class="lot-progress-label">Sell-through</span>
        <span class="lot-progress-percent">${soldPercent}%</span>
      </div>
      <div class="lot-progress">
        <div class="lot-progress-bar" data-width="${soldPercent}"></div>
      </div>
      <div class="lot-progress-text">${unitsSold} of ${lot.quantity} sold</div>
    </div>
  ` : '';

  // Return deadline warning
  const returnDeadlineHtml = (!fullySold && lot.remaining > 0) ? `
    <div class="lot-return-deadline ${showReturnWarning ? 'urgent' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      ${showReturnWarning ? `Return by ${returnDateStr}` : `Returns ${returnDateStr}`}
    </div>
  ` : '';

  // Expandable sales section
  const salesListHtml = hasAnySales ? `
    <div class="sales-list-accordion ${isExpanded ? 'expanded' : ''}" id="sales-list-${lot.id}">
      ${renderSalesList(lot)}
    </div>
  ` : '';

  const viewSalesBtn = hasAnySales ? `
    <button class="btn btn-text toggle-sales ${isExpanded ? 'active' : ''}" data-lot-id="${lot.id}">
      ${isExpanded ? 'Hide Sales' : `View ${lot.sales.length} Sale${lot.sales.length > 1 ? 's' : ''}`}
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="toggle-arrow">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  ` : '';

  // Sold out badge
  const soldOutBadge = fullySold ? `
    <div class="sold-out-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Sold Out
    </div>
  ` : '';

  // Record Sale button (only if not fully sold)
  const recordSaleBtn = !fullySold ? `
    <button class="btn btn-primary btn-sale add-sale-btn" data-lot-id="${lot.id}">
      Record Sale
    </button>
  ` : '';

  return `
    <div class="lot-card-swipe-wrapper lot-card-entering lot-card-delay-${Math.min(index, 7)} ${isExpanded ? 'card-expanded' : ''}" data-lot-id="${lot.id}">
      <!-- Background Actions -->
      <div class="swipe-actions-bg">
        <div class="swipe-bg-action edit-bg" data-lot-id="${lot.id}">
          <div class="swipe-bg-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </div>
          <span>Edit</span>
        </div>
        
        <div class="swipe-bg-action delete-bg" data-lot-id="${lot.id}">
          <div class="swipe-bg-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </div>
          <span>Delete</span>
        </div>
      </div>
      
      <!-- Main Card Content -->
      <div class="lot-card ${fullySold ? 'sold' : ''}" data-lot-id="${lot.id}">
        
        <!-- Row 1: Name + Badge + Profit -->
        <div class="lot-card-row lot-card-header">
          <div class="lot-name-wrapper">
            <div class="lot-name">${lot.name}</div>
            ${soldOutBadge}
          </div>
          ${profitDisplay}
        </div>
        
        <!-- Row 2: Bought info -->
        <div class="lot-card-row">
          <div class="lot-bought">
            <span class="lot-bought-label">Bought</span>
            <span class="lot-bought-value">${formatCurrency(lot.unitCost)}/unit</span>
          </div>
        </div>
        
        <!-- Row 3: Progress (if applicable) -->
        ${progressBar}
        
        <!-- Row 4: Return deadline & View Sales -->
        <div class="lot-card-row lot-card-footer">
          ${returnDeadlineHtml}
          ${viewSalesBtn}
        </div>
        
        <!-- Expandable Sales -->
        ${salesListHtml}
        
        <!-- CTA -->
        ${recordSaleBtn}
      </div>
    </div>
  `;
}

function renderSalesList(lot) {
  return `
    <div class="sales-list">
      ${lot.sales.map(sale => {
    const saleDateFormatted = formatDate(sale.dateSold);
    const platformName = sale.platform === 'ebay' ? 'eBay' : 'Facebook';
    const shippingDisplay = sale.shippingCost ? `${formatCurrency(sale.shippingCost)} ship` : '';
    const returnedBadge = sale.returned ? `<span class="sale-badge returned">RETURNED</span>` : '';
    const isPositive = sale.profit >= 0;
    const profitClass = sale.returned ? 'profit-negative' : (isPositive ? 'profit-positive' : 'profit-negative');
    const profitDisplay = sale.returned
      ? `<span class="sale-profit ${profitClass} crossed">${formatCurrency(sale.profit, true)}</span>`
      : `<span class="sale-profit ${profitClass}">${formatCurrency(sale.profit, true)}</span>`;

    return `
        <div class="sale-item ${sale.returned ? 'returned' : ''}">
          <div class="sale-item-left">
            <div class="sale-platform">${platformName}</div>
            <div class="sale-date">${saleDateFormatted}</div>
            ${returnedBadge}
          </div>
          <div class="sale-item-right">
            ${profitDisplay}
            <div class="sale-details">
              ${sale.unitsSold > 1 ? `${sale.unitsSold} × ` : ''}${formatCurrency(sale.pricePerUnit)}${shippingDisplay ? ` + ${shippingDisplay}` : ''}
            </div>
          </div>
          <div class="sale-actions">
            ${!sale.returned ? `
            <button class="sale-action-btn return-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" title="Mark as Returned">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 10h18"></path>
                <path d="M3 14h18"></path>
                <path d="M10 3v18"></path>
                <path d="M14 3v18"></path>
              </svg>
            </button>
            ` : ''}
            <button class="sale-action-btn edit-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" title="Edit Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="sale-action-btn delete-sale-btn" data-lot-id="${lot.id}" data-sale-id="${sale.id}" title="Delete Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
  }).join('')}
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <div class="empty-state-title">Your first win is coming.</div>
      <div class="empty-state-text">Add inventory by scanning a receipt or entering manually</div>
    </div>
  `;
}

function renderEditSaleModal() {
  if (!editSaleData) return '';

  const { sale, lotId } = editSaleData;
  const priceValue = editSalePrice || (sale.pricePerUnit / 100).toFixed(2);
  // Shipping is stored as total cents, convert to per-unit dollars for display
  const shippingPerUnitCents = (sale.shippingCost != null && sale.unitsSold > 0 && !isNaN(sale.shippingCost)) ? sale.shippingCost / sale.unitsSold : 0;
  // shippingPerUnitCents is in cents, divide by 100 once to get dollars
  const shippingDollars = isNaN(shippingPerUnitCents) ? 0 : shippingPerUnitCents / 100;
  const shippingValue = editShippingCost !== '' ? editShippingCost : shippingDollars.toFixed(2);
  const dateValue = editSaleDate || new Date(sale.dateSold).toISOString().split('T')[0];

  return `
    <div class="modal-overlay bottom-sheet" id="edit-sale-modal">
      <div class="modal-content transactional">
        <div class="modal-header">
          <h2 class="modal-title">Edit Sale</h2>
          <button class="modal-close" id="close-edit-sale-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="transaction-context">
            <div class="item-name">Sold ${sale.unitsSold} unit${sale.unitsSold > 1 ? 's' : ''} on ${sale.platform === 'ebay' ? 'eBay' : 'Facebook'}</div>
            <div class="item-meta">Original sale date: ${formatDate(sale.dateSold)}</div>
          </div>
          
          <div class="transaction-grid">
            <div class="form-group form-group-tight">
              <label class="transactional-label">Quantity</label>
              <div class="quantity-stepper">
                <button type="button" class="stepper-btn" id="edit-sale-decrease-qty" disabled>-</button>
                <input type="number" class="form-input form-input-compact stepper-input transactional-input-emphasized" id="edit-sale-units" value="${sale.unitsSold}" readonly />
                <button type="button" class="stepper-btn" id="edit-sale-increase-qty" disabled>+</button>
              </div>
            </div>
            <div class="form-group form-group-tight">
              <label class="transactional-label">Unit Price ($)</label>
              <input type="number" class="form-input form-input-compact transactional-input-emphasized" id="edit-sale-price" placeholder="0.00" step="0.01" min="0" value="${priceValue}" inputmode="decimal" />
            </div>
          </div>
          
          ${sale.platform === 'ebay' ? `
            <div class="form-group form-group-spaced">
              <label class="transactional-label">Shipping per unit ($)</label>
              <input type="number" class="form-input form-input-compact transactional-input-emphasized" id="edit-shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingValue}" inputmode="decimal" />
            </div>
          ` : ''}
          
          <div class="form-group date-group">
            <label class="transactional-label">Sale Date</label>
            <input type="date" class="form-input form-input-compact" id="edit-sale-date" value="${dateValue}" />
          </div>
        </div>
        
        <div class="modal-footer modal-footer-flush">
          <button class="btn btn-transactional-primary btn-full" id="save-edit-sale">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderEditLotModal() {
  if (!editLotData) return '';

  const { lot } = editLotData;
  const nameValue = editLotName !== '' ? editLotName : lot.name;
  // Use total cost (unitCost * quantity) as the default value
  const totalCostValue = editLotUnitCost !== '' ? editLotUnitCost : ((lot.unitCost * lot.quantity) / 100).toFixed(2);
  const quantityValue = editLotQuantity !== '' ? editLotQuantity : lot.quantity;
  const purchaseDateValue = editLotPurchaseDate !== '' ? editLotPurchaseDate : (lot.purchaseDate ? lot.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0]);

  return `
    <div class="modal-overlay bottom-sheet" id="edit-lot-modal">
      <div class="modal-content transactional">
        <div class="modal-header">
          <h2 class="modal-title">Edit Lot</h2>
          <button class="modal-close" id="close-edit-lot-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="transactional-label">Item Name</label>
            <input type="text" class="form-input form-input-compact" id="edit-lot-name" placeholder="Enter item name" value="${nameValue}" />
          </div>

          <div class="transaction-grid">
            <div class="form-group form-group-tight">
              <label class="transactional-label">Total Quantity</label>
              <div class="quantity-stepper">
                <button type="button" class="stepper-btn" id="edit-decrease-qty">-</button>
                <input type="number" class="form-input form-input-compact stepper-input transactional-input-emphasized" id="edit-lot-quantity" placeholder="1" min="1" value="${quantityValue}" inputmode="numeric" readonly />
                <button type="button" class="stepper-btn" id="edit-increase-qty">+</button>
              </div>
            </div>
            <div class="form-group form-group-tight">
              <label class="transactional-label">Total Cost ($)</label>
              <input type="number" class="form-input form-input-compact transactional-input-emphasized" id="edit-lot-unit-cost" placeholder="0.00" step="0.01" min="0" value="${totalCostValue}" inputmode="decimal" />
            </div>
          </div>

          <div class="form-group date-group">
            <label class="transactional-label">Purchase Date</label>
            <input type="date" class="form-input form-input-compact" id="edit-lot-purchase-date" value="${purchaseDateValue}" />
          </div>
        </div>

        <div class="modal-footer modal-footer-flush">
          <button class="btn btn-transactional-primary btn-full" id="save-edit-lot">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderImportModal() {
  return `
    <div class="modal-overlay bottom-sheet" id="import-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">Import from CSV</h2>
          <button class="modal-close" id="close-import-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="import-drop-zone" id="import-drop-zone">
          <svg class="import-drop-icon" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p class="import-drop-copy">Drop CSV file here or click to browse</p>
          <p class="import-drop-note">Columns: name, cost, quantity, purchase_date</p>
          <input type="file" id="csv-file-input" class="file-input-hidden" accept=".csv">
        </div>
        
        <div id="import-result" class="import-result" hidden></div>
        
        <div class="import-modal-actions">
          <button class="btn btn-secondary btn-sm" id="download-template">Download Template</button>
        </div>
      </div>
    </div>
  `;
}

function renderSaleModal() {
  const lot = getLots().find(l => l.id === selectedLotId);
  if (!lot) return '';

  const price = parseFloat(salePrice) || 0;
  const units = Math.min(parseInt(unitsSold) || 1, lot.remaining);
  const priceInCents = Math.round(price * 100);
  const shippingPerUnit = parseFloat(shippingCost) || 0;
  const shippingPerUnitCents = Math.round(shippingPerUnit * 100);
  const totalShippingCents = shippingPerUnitCents * units;

  const { costBasis, totalSalePrice, fees, shippingCost: shippingCalc, profit } = calculateSaleProfit(
    lot.unitCost,
    units,
    priceInCents,
    selectedPlatform,
    selectedPlatform === 'ebay' ? totalShippingCents : 0
  );

  const isEbay = selectedPlatform === 'ebay';

  // Platform icons as SVG
  const platformIcons = {
    facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`,
    ebay: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`
  };

  const shippingFieldHtml = isEbay ? `
    <div class="form-group shipping-field form-group-spaced">
      <label class="transactional-label">Shipping per unit ($)</label>
      <input type="number" class="form-input form-input-compact" id="shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingCost}" inputmode="decimal" />
    </div>
  ` : '';

  // Valid if price >= 0 (since we allow 0 now)
  const isValid = price >= 0 && units > 0 && (!isEbay || shippingPerUnit >= 0);

  return `
    <div class="modal-overlay bottom-sheet" id="sale-modal">
      <div class="modal-content transactional">
        <div class="modal-header">
          <h2 class="modal-title">Record Sale</h2>
          <button class="modal-close" id="close-modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Zone 1: Context -->
          <div class="transaction-context">
            <div class="item-name">${lot.name}</div>
            <div class="item-meta">${lot.remaining} in stock • ${formatCurrency(lot.unitCost)} unit cost</div>
          </div>
          
          <!-- Zone 2: Core Transaction -->
          <div class="transaction-grid">
            <div class="form-group form-group-tight">
              <label class="transactional-label">Quantity</label>
              <div class="quantity-stepper">
                <button type="button" class="stepper-btn" id="decrease-qty">-</button>
                <input type="number" class="form-input form-input-compact stepper-input transactional-input-emphasized" id="units-sold" placeholder="1" min="1" max="${lot.remaining}" value="${unitsSold}" inputmode="numeric" readonly />
                <button type="button" class="stepper-btn" id="increase-qty">+</button>
              </div>
            </div>
            <div class="form-group form-group-tight">
              <label class="transactional-label">Unit Price ($)</label>
              <input type="number" class="form-input form-input-compact transactional-input-emphasized" id="sale-price" placeholder="0.00" step="0.01" min="0" value="${salePrice}" inputmode="decimal" />
            </div>
          </div>
          
          <div class="form-group form-group-compact">
            <label class="transactional-label">Platform</label>
            <div class="platform-segmented">
              ${Object.entries(PLATFORM_FEES).map(([key, platform]) => `
                <div class="segmented-option ${selectedPlatform === key ? 'selected' : ''}" data-platform="${key}">
                  <div class="platform-icon">${platformIcons[key] || platformIcons.other}</div>
                  <span>${platform.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          ${shippingFieldHtml}
          
          <!-- Sale Date: Matches Edit Lot Date Code -->
          <div class="form-group date-group">
            <label class="transactional-label">Sale Date</label>
            <input type="date" class="form-input form-input-compact" id="sale-date" value="${saleDate}" />
          </div>
          
          <div class="breakdown-toggle breakdown-toggle-compact" id="breakdown-toggle">
            <span class="breakdown-toggle-label">View detailed breakdown</span>
            <svg class="breakdown-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" id="breakdown-arrow">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          
          <div class="breakdown-wrapper" id="breakdown-wrapper">
            <div class="breakdown-content" id="breakdown-content">
              <div class="breakdown-row">
                <span class="text-secondary">Revenue (${units} × ${formatCurrency(priceInCents)})</span>
                <span>${formatCurrency(totalSalePrice)}</span>
              </div>
              <div class="breakdown-row">
                <span class="text-secondary">Platform Fees</span>
                <span>-${formatCurrency(fees)}</span>
              </div>
              ${isEbay ? `
                <div class="breakdown-row">
                  <span class="text-secondary">Shipping (${units} × ${formatCurrency(totalShippingCents / units)})</span>
                  <span>-${formatCurrency(shippingCalc)}</span>
                </div>
              ` : ''}
              <div class="breakdown-row">
                <span class="text-secondary">Cost Basis (COGS)</span>
                <span>-${formatCurrency(costBasis)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Zone 3: Sticky Footer -->
        <div class="modal-footer">
          <div class="footer-summary">
            <span class="footer-sum-label">NET PROFIT</span>
            <span class="footer-sum-value ${profit >= 0 ? 'profit' : 'loss'}" id="footer-profit-display">${formatCurrency(profit)}</span>
          </div>
          <button class="btn btn-transactional-primary btn-full" id="confirm-sale" ${!isValid ? 'disabled' : ''}>
            Record Sale
          </button>
        </div>
      </div>
    </div>
  `;
}

// Update just the lot list content without re-rendering the entire page
function updateLotList() {
  const filteredLots = getFilteredAndSortedLots();

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

  // Update platform option visual states (segmented style)
  document.querySelectorAll('.segmented-option').forEach(opt => {
    if (opt.dataset.platform === newPlatform) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });

  // Handle shipping field visibility
  const modalBody = document.querySelector('.modal-body');
  const existingShippingField = document.querySelector('.shipping-field');

  if (newPlatform === 'ebay' && !existingShippingField) {
    // Add shipping field before the date picker wrapper
    const dateGroup = document.getElementById('sale-date')?.closest('.date-group');
    if (dateGroup) {
      const shippingDiv = document.createElement('div');
      shippingDiv.className = 'form-group shipping-field';
      shippingDiv.style.marginBottom = '16px';
      shippingDiv.innerHTML = `
        <label class="form-label">Shipping per unit ($)</label>
        <input type="number" class="form-input form-input-compact" id="shipping-cost" placeholder="0.00" step="0.01" min="0" value="${shippingCost}" inputmode="decimal" />
      `;
      dateGroup.before(shippingDiv);

      // Attach event listener to new shipping input
      document.getElementById('shipping-cost')?.addEventListener('input', (e) => {
        shippingCost = e.target.value;
        updateSummaryBox();
      });
    }
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
  const shippingPerUnitCents = Math.round(shipping * 100);
  const totalShippingCents = shippingPerUnitCents * units;
  const isEbay = selectedPlatform === 'ebay';

  const { costBasis, totalSalePrice, fees, shippingCost: shippingCalc, profit } = calculateSaleProfit(
    lot.unitCost,
    units,
    priceInCents,
    selectedPlatform,
    isEbay ? totalShippingCents : 0
  );

  // Valid even if price is 0
  const isValid = price >= 0 && units > 0 && (!isEbay || shipping >= 0);

  // Update dynamic profit displays with color shift
  const profitDisplay = document.getElementById('profit-display');
  const footerProfitDisplay = document.getElementById('footer-profit-display');

  if (profitDisplay) {
    profitDisplay.textContent = formatCurrency(profit);
    profitDisplay.className = `dynamic-profit-value ${profit >= 0 ? 'profit' : 'loss'}`;
  }

  if (footerProfitDisplay) {
    footerProfitDisplay.textContent = formatCurrency(profit);
    footerProfitDisplay.className = `footer-sum-value ${profit >= 0 ? 'profit' : 'loss'}`;
  }

  // Update breakdown content (Always works, even for $0.00 sales)
  const breakdownContent = document.getElementById('breakdown-content');
  if (breakdownContent) {
    breakdownContent.innerHTML = `
      <div class="breakdown-row">
        <span class="text-secondary">Revenue (${units} × ${formatCurrency(priceInCents || 0)})</span>
        <span>${formatCurrency(totalSalePrice || 0)}</span>
      </div>
      <div class="breakdown-row">
        <span class="text-secondary">Platform Fees</span>
        <span>-${formatCurrency(fees || 0)}</span>
      </div>
      ${isEbay ? `
        <div class="breakdown-row">
          <span class="text-secondary">Shipping (${units} × ${formatCurrency(shippingPerUnitCents || 0)})</span>
          <span>-${formatCurrency(shippingCalc || 0)}</span>
        </div>
      ` : ''}
      <div class="breakdown-row">
        <span class="text-secondary">Cost Basis (COGS)</span>
        <span>-${formatCurrency(costBasis || 0)}</span>
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
  saleDate = new Date().toISOString().split('T')[0];
  window.dispatchEvent(new CustomEvent('viewchange'));
}

export function closeSaleModal() {
  const modal = document.getElementById('sale-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      selectedLotId = null;
      salePrice = '';
      unitsSold = '1';
      shippingCost = '';
      saleDate = new Date().toISOString().split('T')[0];
    }, 200);
  } else {
    selectedLotId = null;
    salePrice = '';
    unitsSold = '1';
    shippingCost = '';
    saleDate = new Date().toISOString().split('T')[0];
  }
}

function closeEditSaleModal() {
  const modal = document.getElementById('edit-sale-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      editSaleData = null;
      editSalePrice = '';
      editShippingCost = '';
      editSaleDate = '';
    }, 200);
  } else {
    editSaleData = null;
    editSalePrice = '';
    editShippingCost = '';
    editSaleDate = '';
  }
}


// Event handlers specific to lot cards (called after lot list updates)
function initLotCardEvents() {
  // Animate progress bars on load
  setTimeout(() => {
    document.querySelectorAll('.lot-progress-bar').forEach(bar => {
      const width = bar.dataset.width;
      if (width) {
        setTimeout(() => {
          bar.style.width = width + '%';
        }, 100);
      }
    });
  }, 50);

  // Toggle sales list - accordion animation without page refresh
  document.querySelectorAll('.toggle-sales').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      const accordion = document.getElementById(`sales-list-${lotId}`);
      const isCurrentlyExpanded = accordion?.classList.contains('expanded');

      // Toggle accordion with animation
      if (accordion) {
        if (isCurrentlyExpanded) {
          accordion.classList.remove('expanded');
          expandedLots.delete(lotId);
        } else {
          accordion.classList.add('expanded');
          expandedLots.add(lotId);
        }
      }
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { lotId, saleId } = btn.dataset;
      const confirmed = await confirmAction({
        title: 'Delete sale',
        message: 'Delete this sale record and restore units to inventory?',
        confirmLabel: 'Delete sale',
        tone: 'danger'
      });
      if (!confirmed) return;

      deleteSale(lotId, saleId);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Delete lot shortcut
  document.querySelectorAll('.delete-lot-card-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      const confirmed = await confirmAction({
        title: 'Delete lot',
        message: 'Delete this lot and all its sales history?',
        confirmLabel: 'Delete lot',
        tone: 'danger'
      });
      if (!confirmed) return;

      deleteLot(lotId);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Edit sale button - opens edit modal without full page refresh
  document.querySelectorAll('.edit-sale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Remove any existing edit sale modal first
      const existingModal = document.getElementById('edit-sale-modal');
      if (existingModal) existingModal.remove();

      const { lotId, saleId } = btn.dataset;
      const lot = getLots().find(l => l.id === lotId);
      const sale = lot?.sales.find(s => s.id === saleId);
      if (sale) {
        editSaleData = { lotId, saleId, sale };
        editSalePrice = '';
        editShippingCost = '';
        editSaleDate = '';
        // Inject modal directly without full page re-render
        const modalHtml = renderEditSaleModal();
        if (modalHtml) {
          document.body.insertAdjacentHTML('beforeend', modalHtml);
          attachEditSaleModalEvents();
        }
      }
    });
  });

  // Return sale button - marks sale as returned with confirmation
  document.querySelectorAll('.return-sale-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { lotId, saleId } = btn.dataset;
      const lot = getLots().find(l => l.id === lotId);
      const sale = lot?.sales.find(s => s.id === saleId);

      if (!sale) return;

      const profit = formatCurrency(sale.profit);
      const message = sale.profit >= 0
        ? `This sale had a profit of ${profit}. Marking it as returned will:\n\n1. Remove this profit from your totals\n2. Restore ${sale.unitsSold} unit(s) to inventory\n\nAre you sure you want to mark this as returned?`
        : `This sale had a loss of ${profit}. Marking it as returned will:\n\n1. Remove this loss from your totals (you'll lose the money you made from this sale)\n2. Restore ${sale.unitsSold} unit(s) to inventory\n\nAre you sure you want to mark this as returned?`;

      const confirmed = await confirmAction({
        title: 'Mark sale as returned',
        message,
        confirmLabel: 'Mark returned',
        tone: 'danger'
      });
      if (!confirmed) return;

      markSaleReturned(lotId, saleId);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Initialize swipe functionality for lot cards
  initSwipeHandlers();

}

// Swipe handling functions - iOS Mail Style
function initSwipeHandlers() {
  const swipeWrappers = document.querySelectorAll('.lot-card-swipe-wrapper');

  swipeWrappers.forEach(wrapper => {
    const card = wrapper.querySelector('.lot-card');
    const lotId = wrapper.dataset.lotId;
    const editBg = wrapper.querySelector('.edit-bg');
    const deleteBg = wrapper.querySelector('.delete-bg');

    if (!card) return;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startY = 0;
    let isHorizontal = false;
    let cardWidth = 0;

    const startHandler = (clientX, clientY) => {
      startX = clientX;
      startY = clientY;
      isDragging = true;
      isHorizontal = false;
      cardWidth = card.offsetWidth;
      card.classList.remove('snapping', 'restore');
      wrapper.classList.add('swiping');
    };

    const moveHandler = (clientX, clientY, e) => {
      if (!isDragging) return;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      // Determine if horizontal swipe on first significant movement
      if (!isHorizontal && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        if (isHorizontal) {
          card.classList.add('swiping');
        } else {
          isDragging = false;
          wrapper.classList.remove('swiping');
        }
      }

      if (isHorizontal) {
        if (e.cancelable) e.preventDefault();
        currentX = deltaX;

        // Apply resistance after reveal position
        const revealPos = 80;
        let displayX = currentX;
        if (Math.abs(currentX) > revealPos) {
          const extra = Math.abs(currentX) - revealPos;
          displayX = (revealPos + extra * 0.3) * (currentX > 0 ? 1 : -1);
        }

        card.style.transform = `translateX(${displayX}px)`;

        // Show action indicators & Commit state (70% threshold)
        const commitThreshold = cardWidth * 0.7;
        const isCommitting = Math.abs(currentX) > commitThreshold;

        if (currentX > 20) {
          wrapper.classList.add('swiping-right');
          wrapper.classList.remove('swiping-left');
          if (editBg) editBg.classList.toggle('is-committing', isCommitting);
        } else if (currentX < -20) {
          wrapper.classList.add('swiping-left');
          wrapper.classList.remove('swiping-right');
          if (deleteBg) deleteBg.classList.toggle('is-committing', isCommitting);
        } else {
          wrapper.classList.remove('swiping-left', 'swiping-right');
          if (editBg) editBg.classList.remove('is-committing');
          if (deleteBg) deleteBg.classList.remove('is-committing');
        }
      }
    };

    const endHandler = () => {
      if (!isDragging) return;
      isDragging = false;

      card.classList.remove('swiping');
      wrapper.classList.remove('swiping', 'swiping-left', 'swiping-right');
      if (editBg) editBg.classList.remove('is-committing');
      if (deleteBg) deleteBg.classList.remove('is-committing');

      const revealThreshold = cardWidth * 0.25;
      const commitThreshold = cardWidth * 0.7;
      const revealPos = 80;

      card.classList.add('snapping');

      if (currentX > commitThreshold) {
        // COMMIT RIGHT -> EDIT
        card.style.transform = `translateX(${cardWidth}px)`;
        setTimeout(() => {
          openEditLotModal(lotId);
          resetCardPosition(card);
        }, 300);
      } else if (currentX < -commitThreshold) {
        // COMMIT LEFT -> DELETE
        card.style.transform = `translateX(-${cardWidth}px)`;
        setTimeout(async () => {
          const confirmed = await confirmAction({
            title: 'Delete lot',
            message: 'Delete this lot and all its sales history?',
            confirmLabel: 'Delete lot',
            tone: 'danger'
          });
          if (confirmed) {
            deleteLot(lotId);
            window.dispatchEvent(new CustomEvent('viewchange'));
          } else {
            resetCardPosition(card);
          }
        }, 300);
      } else if (currentX > revealThreshold) {
        // REVEAL RIGHT -> Snap to Edit button
        card.style.transform = `translateX(${revealPos}px)`;
        card.classList.add('swiped-right');

        // One-time click to trigger action or click away to reset
        const clickReset = () => {
          resetCardPosition(card);
          document.removeEventListener('click', clickReset);
        };
        setTimeout(() => document.addEventListener('click', clickReset), 10);
      } else if (currentX < -revealThreshold) {
        // REVEAL LEFT -> Snap to Delete button
        card.style.transform = `translateX(-${revealPos}px)`;
        card.classList.add('swiped-left');

        const clickReset = () => {
          resetCardPosition(card);
          document.removeEventListener('click', clickReset);
        };
        setTimeout(() => document.addEventListener('click', clickReset), 10);
      } else {
        // RESET
        resetCardPosition(card);
      }

      currentX = 0;
    };

    // Touch events
    card.addEventListener('touchstart', (e) => startHandler(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    card.addEventListener('touchmove', (e) => moveHandler(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
    card.addEventListener('touchend', endHandler);

    // Mouse events - optimized to only track window during active drag
    const onMouseMove = (e) => {
      if (isDragging) moveHandler(e.clientX, e.clientY, e);
    };

    const onMouseUp = () => {
      if (isDragging) {
        endHandler();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    card.addEventListener('mousedown', (e) => {
      startHandler(e.clientX, e.clientY);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Special handlers for background action clicks (fallback)
    if (editBg) {
      editBg.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditLotModal(lotId);
        resetCardPosition(card);
      });
    }
    if (deleteBg) {
      deleteBg.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await confirmAction({
          title: 'Delete lot',
          message: 'Delete this lot and all its sales history?',
          confirmLabel: 'Delete lot',
          tone: 'danger'
        });
        if (confirmed) {
          deleteLot(lotId);
          window.dispatchEvent(new CustomEvent('viewchange'));
        } else {
          resetCardPosition(card);
        }
      });
    }
  });
}

function resetCardPosition(card) {
  card.classList.remove('swiped-left', 'swiped-right', 'snapping');
  card.classList.add('restore');
  card.style.transform = '';
  setTimeout(() => {
    card.classList.remove('restore');
  }, 300);
}

// Open edit lot modal
function openEditLotModal(lotId) {
  const lot = getLots().find(l => l.id === lotId);
  if (!lot) return;

  // Remove existing modal if any
  const existingModal = document.getElementById('edit-lot-modal');
  if (existingModal) existingModal.remove();

  editLotData = { lot };
  editLotName = '';
  editLotUnitCost = '';
  editLotQuantity = '';
  editLotPurchaseDate = '';

  // Reset events flag when opening fresh
  editLotEventsAttached = false;

  window.dispatchEvent(new CustomEvent('viewchange'));

  // Attach events after DOM update
  setTimeout(() => {
    attachEditLotModalEvents();
  }, 0);
}

// Close edit lot modal
function closeEditLotModal() {
  const modal = document.getElementById('edit-lot-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      editLotData = null;
      editLotName = '';
      editLotUnitCost = '';
      editLotQuantity = '';
      editLotPurchaseDate = '';
    }, 200);
  } else {
    editLotData = null;
    editLotName = '';
    editLotUnitCost = '';
    editLotQuantity = '';
    editLotPurchaseDate = '';
  }
}

// Handle save edit lot
function handleSaveEditLot(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!editLotData) return;

  const { lot } = editLotData;

  // Parse values - now treating editLotUnitCost as TOTAL cost
  const newName = editLotName !== '' ? editLotName.trim() : lot.name;
  const newTotalCostDollars = editLotUnitCost !== '' ? parseFloat(editLotUnitCost) : (lot.unitCost * lot.quantity) / 100;
  const newQuantity = editLotQuantity !== '' ? parseInt(editLotQuantity) : lot.quantity;
  const newPurchaseDate = editLotPurchaseDate ? new Date(editLotPurchaseDate + 'T12:00:00').toISOString() : lot.purchaseDate;

  // Validate
  if (!newName) {
    showToast('Please enter an item name.', {
      variant: 'error',
      title: 'Edit lot'
    });
    return;
  }
  if (isNaN(newTotalCostDollars) || newTotalCostDollars < 0) {
    showToast('Please enter a valid total cost.', {
      variant: 'error',
      title: 'Edit lot'
    });
    return;
  }
  if (isNaN(newQuantity) || newQuantity < 1) {
    showToast('Please enter a valid quantity.', {
      variant: 'error',
      title: 'Edit lot'
    });
    return;
  }

  // Calculate costs in cents
  const newTotalCostCents = Math.round(newTotalCostDollars * 100);
  const newUnitCostCents = Math.round(newTotalCostCents / newQuantity);

  // Check if reducing quantity below already sold
  const unitsSold = lot.quantity - lot.remaining;
  if (newQuantity < unitsSold) {
    showToast(`Cannot reduce quantity below ${unitsSold} already sold. Delete sales first.`, {
      variant: 'error',
      title: 'Edit lot'
    });
    return;
  }

  // Calculate new remaining
  const newRemaining = lot.remaining + (newQuantity - lot.quantity);

  // Update lot
  updateLot(lot.id, {
    name: newName,
    unitCost: newUnitCostCents,
    quantity: newQuantity,
    remaining: newRemaining,
    totalCost: newTotalCostCents,
    purchaseDate: newPurchaseDate
  });

  // Close modal and refresh view to show updated data
  const modal = document.getElementById('edit-lot-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      editLotData = null;
      editLotName = '';
      editLotUnitCost = '';
      editLotQuantity = '';
      editLotPurchaseDate = '';
      window.dispatchEvent(new CustomEvent('viewchange'));
    }, 200);
  } else {
    editLotData = null;
    editLotName = '';
    editLotUnitCost = '';
    editLotQuantity = '';
    editLotPurchaseDate = '';
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

// Attach events for dynamically injected edit lot modal
function attachEditLotModalEvents() {
  // Prevent duplicate event attachment
  if (editLotEventsAttached) return;
  editLotEventsAttached = true;

  document.getElementById('close-edit-lot-modal')?.addEventListener('click', closeEditLotModal);
  document.getElementById('edit-lot-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-lot-modal') closeEditLotModal();
  });

  document.getElementById('edit-lot-name')?.addEventListener('input', (e) => {
    editLotName = e.target.value;
  });
  document.getElementById('edit-lot-unit-cost')?.addEventListener('input', (e) => {
    editLotUnitCost = e.target.value;
  });
  document.getElementById('edit-lot-quantity')?.addEventListener('input', (e) => {
    editLotQuantity = e.target.value;
  });
  document.getElementById('edit-lot-purchase-date')?.addEventListener('input', (e) => {
    editLotPurchaseDate = e.target.value;
  });

  // Quantity stepper buttons
  const decreaseBtn = document.getElementById('edit-decrease-qty');
  const increaseBtn = document.getElementById('edit-increase-qty');

  function handleEditDecrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const input = document.getElementById('edit-lot-quantity');
    if (input) {
      const currentQty = parseInt(input.value) || 1;
      if (currentQty > 1) {
        input.value = currentQty - 1;
        editLotQuantity = String(currentQty - 1);
      }
    }
  }

  function handleEditIncrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const input = document.getElementById('edit-lot-quantity');
    if (input) {
      const currentQty = parseInt(input.value) || 1;
      input.value = currentQty + 1;
      editLotQuantity = String(currentQty + 1);
    }
  }

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', handleEditDecrease);
  }
  if (increaseBtn) {
    increaseBtn.addEventListener('click', handleEditIncrease);
  }

  document.getElementById('save-edit-lot')?.addEventListener('click', handleSaveEditLot);
}
function attachEditSaleModalEvents() {
  // Close edit sale modal
  document.getElementById('close-edit-sale-modal')?.addEventListener('click', closeEditSaleModal);
  document.getElementById('edit-sale-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'edit-sale-modal') closeEditSaleModal();
  });

  // Edit sale input handlers
  document.getElementById('edit-sale-price')?.addEventListener('input', (e) => {
    editSalePrice = e.target.value;
  });
  document.getElementById('edit-shipping-cost')?.addEventListener('input', (e) => {
    editShippingCost = e.target.value;
  });
  document.getElementById('edit-sale-date')?.addEventListener('input', (e) => {
    editSaleDate = e.target.value;
  });

  // Save edit sale
  document.getElementById('save-edit-sale')?.addEventListener('click', handleSaveEditSale);
}

// Save edit sale handler
function handleSaveEditSale() {
  if (!editSaleData) return;

  const { lotId, saleId, sale } = editSaleData;
  const lot = getLots().find(l => l.id === lotId);
  if (!lot) return;

  // Parse new values with NaN protection
  const priceInput = editSalePrice !== '' ? parseFloat(editSalePrice) : NaN;
  const newPrice = Math.round((!isNaN(priceInput) ? priceInput : sale.pricePerUnit / 100) * 100);
  // Shipping: shippingPerUnitOld is already in cents (stored as total / units)
  const shippingPerUnitCentsOld = (sale.shippingCost != null && !isNaN(sale.shippingCost) && sale.unitsSold > 0) ? sale.shippingCost / sale.unitsSold : 0;
  // editShippingCost is in dollars, convert to cents. If empty, use old value (already in cents)
  const editShippingParsed = parseFloat(editShippingCost);
  const shippingPerUnitCents = sale.platform === 'ebay'
    ? (editShippingCost !== '' && !isNaN(editShippingParsed) ? Math.round(editShippingParsed * 100) : shippingPerUnitCentsOld)
    : 0;
  const newShipping = Math.round(shippingPerUnitCents * sale.unitsSold);

  // Safety check: if any values are NaN, show error and don't save
  if (isNaN(newPrice) || isNaN(newShipping)) {
    console.error('NaN detected in edit sale calculation:', { newPrice, newShipping, shippingPerUnitCents, sale });
    showToast('Invalid number calculated. Please check your inputs and try again.', {
      variant: 'error',
      title: 'Edit sale'
    });
    return;
  }

  // Validate lot.unitCost is valid
  if (isNaN(lot.unitCost)) {
    console.error('NaN detected in lot.unitCost:', lot);
    showToast('Invalid unit cost in lot data. Please contact support.', {
      variant: 'error',
      title: 'Edit sale'
    });
    return;
  }

  const newDate = editSaleDate || new Date(sale.dateSold).toISOString().split('T')[0];

  // Recalculate profit with new values
  const profitResult = calculateSaleProfit(
    lot.unitCost,
    sale.unitsSold,
    newPrice,
    sale.platform,
    newShipping
  );

  // Validate profit calculation result
  if (isNaN(profitResult.profit)) {
    console.error('NaN detected in profit calculation:', profitResult, { lot, sale, newPrice, newShipping });
    showToast('Profit calculation failed. Please check your inputs and try again.', {
      variant: 'error',
      title: 'Edit sale'
    });
    return;
  }

  // Update the sale
  const updates = {
    pricePerUnit: Math.round(newPrice),
    totalPrice: Math.round(newPrice * sale.unitsSold),
    shippingCost: Math.round(newShipping),
    dateSold: new Date(newDate + 'T12:00:00').toISOString(),
    profit: profitResult.profit,
    costBasis: profitResult.costBasis,
    fees: profitResult.fees
  };

  updateSale(lotId, saleId, updates);
  closeEditSaleModal();
  // Refresh lot list to show updated profit
  updateLotList();
}

export function initInventoryEvents() {
  // Check if we're on desktop and init desktop events
  if (isDesktopViewport()) {
    initDesktopInventoryEvents();
    return;
  }

  // Tab switching - targeted update only
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      activeTab = e.target.dataset.tab;
      updateLotList();
    });
  });

  // Search input
  document.getElementById('inventory-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    updateLotList();
  });

  // Sort dropdown
  document.getElementById('inventory-sort')?.addEventListener('change', (e) => {
    sortOrder = e.target.value;
    updateLotList();
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

  // Sale date input
  document.getElementById('sale-date')?.addEventListener('change', (e) => {
    saleDate = e.target.value;
  });

  // Platform selection - targeted update only
  document.querySelectorAll('.segmented-option').forEach(option => {
    option.addEventListener('click', () => {
      updatePlatformSelection(option.dataset.platform);
    });
  });

  // Initial update for summary box if modal is open
  if (selectedLotId) {
    updateSummaryBox();
  }

  // Quantity stepper buttons - works on both desktop and mobile
  const decreaseBtn = document.getElementById('decrease-qty');
  const increaseBtn = document.getElementById('increase-qty');

  function handleDecrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const lot = getLots().find(l => l.id === selectedLotId);
    if (lot) {
      const currentQty = parseInt(unitsSold) || 1;
      if (currentQty > 1) {
        unitsSold = String(currentQty - 1);
        const input = document.getElementById('units-sold');
        if (input) input.value = unitsSold;
        updateSummaryBox();
      }
    }
  }

  function handleIncrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const lot = getLots().find(l => l.id === selectedLotId);
    if (lot) {
      const currentQty = parseInt(unitsSold) || 1;
      if (currentQty < lot.remaining) {
        unitsSold = String(currentQty + 1);
        const input = document.getElementById('units-sold');
        if (input) input.value = unitsSold;
        updateSummaryBox();
      }
    }
  }

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', handleDecrease);
  }

  if (increaseBtn) {
    increaseBtn.addEventListener('click', handleIncrease);
  }

  // Breakdown toggle with accordion animation
  document.getElementById('breakdown-toggle')?.addEventListener('click', () => {
    const wrapper = document.getElementById('breakdown-wrapper');
    const arrow = document.getElementById('breakdown-arrow');
    const toggle = document.getElementById('breakdown-toggle');
    if (wrapper && arrow && toggle) {
      const isOpen = wrapper.classList.contains('open');
      if (isOpen) {
        wrapper.classList.remove('open');
        toggle.classList.remove('open');
        arrow.style.transform = 'rotate(0deg)';
      } else {
        wrapper.classList.add('open');
        toggle.classList.add('open');
        arrow.style.transform = 'rotate(180deg)';
      }
    }
  });

  // Confirm sale with animation
  document.getElementById('confirm-sale')?.addEventListener('click', () => {
    const price = parseFloat(salePrice);
    const units = parseInt(unitsSold) || 1;
    const shippingPerUnit = selectedPlatform === 'ebay' ? (parseFloat(shippingCost) || 0) : 0;
    const totalShipping = shippingPerUnit * units;
    if (price > 0 && units > 0 && selectedLotId) {
      // Add animation class to button
      const btn = document.getElementById('confirm-sale');
      if (btn) {
        btn.classList.add('animating');
        btn.textContent = 'Sale Recorded!';
        btn.disabled = true;
      }

      // Trigger confetti celebration
      celebrateSuccess(btn);

      // Delay the actual sale recording and refresh until animation completes
      setTimeout(() => {
        recordSale(selectedLotId, price, units, selectedPlatform, totalShipping, saleDate);
        closeSaleModal();
        window.dispatchEvent(new CustomEvent('viewchange'));
      }, 1200);
    }
  });

  // Delete lot
  document.getElementById('delete-lot')?.addEventListener('click', async () => {
    if (!selectedLotId) return;
    const confirmed = await confirmAction({
      title: 'Delete entire lot',
      message: 'Are you sure you want to delete this entire lot and all its sales?',
      confirmLabel: 'Delete lot',
      tone: 'danger'
    });
    if (!confirmed) return;

    deleteLot(selectedLotId);
    closeSaleModal();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // === CSV Import Events ===

  // Open import modal
  document.getElementById('import-csv-btn')?.addEventListener('click', () => {
    showImportModal = true;
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Close import modal
  document.getElementById('close-import-modal')?.addEventListener('click', closeImportModal);
  document.getElementById('import-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'import-modal') closeImportModal();
  });

  // Drop zone click to browse
  document.getElementById('import-drop-zone')?.addEventListener('click', () => {
    document.getElementById('csv-file-input')?.click();
  });

  // File input change
  document.getElementById('csv-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await processCSVFile(file);
  });

  // Drag and drop
  const dropZone = document.getElementById('import-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith('.csv')) {
        await processCSVFile(file);
      }
    });
  }

  // Download template
  document.getElementById('download-template')?.addEventListener('click', () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function closeImportModal() {
  const modal = document.getElementById('import-modal');
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      showImportModal = false;
      window.dispatchEvent(new CustomEvent('viewchange'));
    }, 200);
  } else {
    showImportModal = false;
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

async function processCSVFile(file) {
  const resultEl = document.getElementById('import-result');
  if (!resultEl) return;

  resultEl.hidden = false;
  resultEl.innerHTML = '<p class="text-muted">Importing...</p>';

  try {
    const { success, salesImported, errors } = await importLotsFromCSV(file);

    let html = `<div class="import-success">✅ Imported ${success} lot${success !== 1 ? 's' : ''}`;
    if (salesImported > 0) {
      html += ` with ${salesImported} sale${salesImported !== 1 ? 's' : ''}`;
    }
    html += `</div>`;

    if (errors.length > 0) {
      html += `<div class="import-errors">
        <strong>⚠️ ${errors.length} error${errors.length !== 1 ? 's' : ''}:</strong>
        <ul class="import-errors-list">
          ${errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
          ${errors.length > 5 ? `<li>...and ${errors.length - 5} more</li>` : ''}
        </ul>
      </div>`;
    }

    if (success > 0) {
      html += '<button class="btn btn-success btn-full import-result-close" id="close-import-result">Done</button>';
    }

    resultEl.innerHTML = html;

    document.getElementById('close-import-result')?.addEventListener('click', () => {
      closeImportModal();
    });

    if (success > 0) {
      setTimeout(() => {
        closeImportModal();
      }, 1500);
    }
  } catch (err) {
    resultEl.innerHTML = `<div class="import-error text-danger">❌ Import failed: ${err.message}</div>`;
  }
}
