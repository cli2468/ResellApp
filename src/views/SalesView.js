// Sales View - All sales with filtering, sorting, and inline expanding

import { getAllSales, getLots, updateSale, deleteSale } from '../services/storage.js';
import { formatCurrency } from '../services/calculations.js';
import { renderPlatformBadge } from '../services/uiHelpers.js';
import { navigate } from '../router.js';

let currentSort = { key: 'date', direction: 'desc' };
let currentSearch = '';
let currentStartDate = '';
let currentEndDate = '';
let isDatePickerOpen = false;
let expandedSaleId = null;
let currentViewingMonth = new Date().getMonth();
let currentViewingYear = new Date().getFullYear();
let editSaleData = null; // { lot, sale, saleIdx, drawerMode: 'edit' | 'delete' }
let editSalePrice = '';
let editSaleQty = 1;
let editSalePlatform = 'facebook';
let editSaleShipping = '';
let pendingScrollToSale = false;

export function SalesView() {
  const salesData = getAllSales();
  const allLots = getLots();

  // Handle Hash Routing for auto-opening Edit Drawer (e.g., from Recent Sales click)
  const hashObj = new URLSearchParams(window.location.hash.split('?')[1]);
  const routeEditLot = hashObj.get('editLot');
  const routeEditSale = hashObj.get('editSale');

  if (routeEditLot && routeEditSale) {
    const targetLot = allLots.find(l => l.id === routeEditLot);
    if (targetLot && targetLot.sales) {
      const targetSaleIndex = targetLot.sales.findIndex(s => s.id === routeEditSale);
      if (targetSaleIndex !== -1) {
        // Expand the sale row instead of opening the edit drawer
        expandedSaleId = `${routeEditLot}-${targetSaleIndex}`;
        pendingScrollToSale = true;

        // Ensure the edit drawer is closed
        editSaleData = null;

        // Clear the hash without triggering a full re-render manually here
        history.replaceState(null, null, '#/sales');
      }
    }
  }

  // Search filtering
  let filteredSales = salesData;
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filteredSales = filteredSales.filter(({ lot }) => {
      const name = lot?.name || '';
      const num = lot?.lotNumber || '';
      return name.toLowerCase().includes(q) || num.toLowerCase().includes(q);
    });
  }

  // Date filtering
  if (currentStartDate || currentEndDate) {
    filteredSales = filteredSales.filter(({ sale }) => {
      if (!sale?.dateSold) return false;
      // Normalize dates for safe comparison
      const saleDate = new Date(sale.dateSold).toISOString().split('T')[0];
      if (currentStartDate && saleDate < currentStartDate) return false;
      if (currentEndDate && saleDate > currentEndDate) return false;
      return true;
    });
  }

  // Sort sales
  const sortedSales = sortSales(filteredSales, currentSort.key, currentSort.direction);

  return `
    <div class="desktop-inventory-container sales-log-view ${editSaleData ? 'has-selection' : ''}">
      <div class="inv-toolbar">
        <div class="inv-toolbar-left">
          <div class="inv-toolbar-title">SALES</div>
          <div class="sales-record-count">${filteredSales.length} records</div>
        </div>
        <div class="inv-toolbar-right">
          <div class="date-range-selector" id="sales-date-trigger" style="position: relative;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span id="sales-date-display">
              ${currentStartDate && currentEndDate ? `${formatShortDate(currentStartDate)} – ${formatShortDate(currentEndDate)}` :
      currentStartDate ? `From ${formatShortDate(currentStartDate)}` :
        currentEndDate ? `Until ${formatShortDate(currentEndDate)}` :
          'Filter by Date'}
            </span>
            
            <div class="custom-date-popover ${isDatePickerOpen ? 'active' : ''}" id="sales-date-popover">
              <div class="date-popover-header">Quick Select</div>
              <div class="date-popover-chips">
                <button class="date-chip" data-range="7">Last 7 Days</button>
                <button class="date-chip" data-range="30">Last 30 Days</button>
                <button class="date-chip" data-range="ytd">Year to Date</button>
                <button class="date-chip" data-range="all">All Time</button>
              </div>
              
              <div class="calendar-module">
                <div class="calendar-header">
                  <button class="calendar-nav-btn" id="cal-prev-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div class="calendar-month-label" id="cal-month-label"></div>
                  <button class="calendar-nav-btn" id="cal-next-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
                <div class="calendar-grid" id="cal-days-header" style="pointer-events: none;">
                  <div class="calendar-day-header">Su</div>
                  <div class="calendar-day-header">Mo</div>
                  <div class="calendar-day-header">Tu</div>
                  <div class="calendar-day-header">We</div>
                  <div class="calendar-day-header">Th</div>
                  <div class="calendar-day-header">Fr</div>
                  <div class="calendar-day-header">Sa</div>
                </div>
                <div class="calendar-grid" id="cal-grid"></div>
              </div>
              
              <div class="date-popover-footer">
                <button class="btn-date-clear" id="popover-clear-btn">Clear</button>
                <button class="btn-date-apply" id="popover-apply-btn">Apply Range</button>
              </div>
            </div>
          </div>
          <div class="inventory-search">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="sales-search" placeholder="Search by item..." value="${currentSearch}">
          </div>
        </div>
      </div>
      
      <div class="inventory-content">
        <div class="inventory-left-panel">
          <div class="sales-log-container">
            <div class="sale-log-header">
              <div class="sale-col-date sortable ${currentSort.key === 'date' ? currentSort.direction : ''}" data-sort="date">
                DATE ${getSortIndicator('date')}
              </div>
              <div class="sale-col-item sortable ${currentSort.key === 'item' ? currentSort.direction : ''}" data-sort="item">
                ITEM ${getSortIndicator('item')}
              </div>
              <div class="sale-col-platform sortable ${currentSort.key === 'platform' ? currentSort.direction : ''}" data-sort="platform">
                PLATFORM ${getSortIndicator('platform')}
              </div>
              <div class="sale-col-price sortable ${currentSort.key === 'revenue' ? currentSort.direction : ''}" data-sort="revenue">
                SALE PRICE ${getSortIndicator('revenue')}
              </div>
              <div class="sale-col-profit sortable ${currentSort.key === 'profit' ? currentSort.direction : ''}" data-sort="profit">
                PROFIT ${getSortIndicator('profit')}
              </div>
              <div class="sale-col-roi">ROI</div>
              <div class="sale-col-qty sortable ${currentSort.key === 'units' ? currentSort.direction : ''}" data-sort="units">
                QTY ${getSortIndicator('units')}
              </div>
              <div class="sale-col-actions"></div>
            </div>
            
            <div class="sale-log-body">
              ${sortedSales.length === 0 ? `
                <div class="desktop-empty-state">
                  <div class="empty-state-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 16px;">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                      <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                    <h3 class="empty-state-title">No sales recorded yet</h3>
                    <p class="empty-state-desc">Record your first sale from the Inventory screen to start tracking your profits.</p>
                  </div>
                </div>
              ` : renderSalesRows(sortedSales, allLots)}
            </div>
          </div>
        </div>

        <!-- Detail Panel Wrapper -->
        <div class="inventory-right-panel ${editSaleData ? 'active' : ''}">
          ${editSaleData ? renderEditDrawer() : ''}
        </div>
      </div>
    </div>
  `;
}

function getSortIndicator(key) {
  if (currentSort.key !== key) return '↕';
  return currentSort.direction === 'asc' ? '↑' : '↓';
}

function renderPlatformSelect(selectedPlatform, inputId) {
  const options = [
    ['amazon', 'Amazon'],
    ['ebay', 'eBay'],
    ['facebook', 'Facebook'],
    ['walmart', 'Walmart'],
    ['target', 'Target'],
    ['woot', 'Woot'],
    ['bestbuy', 'Best Buy']
  ];

  return `
    <select class="form-input" id="${inputId}">
      ${options.map(([value, label]) => `
        <option value="${value}" ${selectedPlatform === value ? 'selected' : ''}>${label}</option>
      `).join('')}
    </select>
  `;
}

function sortSales(sales, key, direction) {
  const sorted = [...sales];
  sorted.sort((a, b) => {
    let valA, valB;
    switch (key) {
      case 'date':
        valA = a.sale?.dateSold ? new Date(a.sale.dateSold) : new Date(0);
        valB = b.sale?.dateSold ? new Date(b.sale.dateSold) : new Date(0);
        break;
      case 'item':
        valA = a.lot?.name || '';
        valB = b.lot?.name || '';
        break;
      case 'platform':
        valA = a.sale?.platform || '';
        valB = b.sale?.platform || '';
        break;
      case 'units':
        valA = a.sale?.unitsSold || 0;
        valB = b.sale?.unitsSold || 0;
        break;
      case 'revenue':
        valA = Number(a.sale?.totalPrice) || 0;
        valB = Number(b.sale?.totalPrice) || 0;
        break;
      case 'profit':
        valA = Number(a.sale?.profit) || 0;
        valB = Number(b.sale?.profit) || 0;
        break;
      default:
        return 0;
    }
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function getPlatformColor(platform) {
  switch (platform?.toLowerCase()) {
    case 'amazon': return '#FBBF24';  // Yellow
    case 'ebay': return '#EF4444';    // Red
    case 'facebook': return '#8B5CF6'; // Purple
    case 'shopify': return '#2DD4BF';  // Teal
    case 'whatnot': return '#F97316';  // Orange
    case 'poshmark': return '#F87171'; // Pink-red
    default: return '#71717A';         // Gray
  }
}

function renderSalesRows(sales, lots) {
  return sales.map(({ lot, sale, saleIndex }) => {
    if (!sale) return '';
    const lotName = lot?.name || 'Unknown';
    const lotNum = lot?.lotNumber || `Lot #${lot?.id?.substring(0, 4) || '—'}`;
    const dateStr = sale.dateSold;
    let dateDisplay = '—';

    if (dateStr && dateStr !== 'Invalid Date') {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dateDisplay = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
      } catch (e) {
        dateDisplay = '—';
      }
    }

    const platform = sale.platform || 'unknown';
    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    const platformColor = getPlatformColor(platform);

    const units = sale.unitsSold || 0;
    const revenue = Number(sale.totalPrice) || 0;
    const profit = Number(sale.profit) || 0;

    const unitCost = lot?.unitCost || 0;
    const totalCost = unitCost * units;
    const roi = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;
    const salePerUnit = units > 0 ? revenue / units : 0;
    const marginPerUnit = units > 0 ? profit / units : 0;

    let daysToSell = '—';
    if (lot?.purchaseDate && dateStr) {
      const pDate = new Date(lot.purchaseDate);
      const sDate = new Date(dateStr);
      const msDiff = Math.max(0, sDate.getTime() - pDate.getTime());
      daysToSell = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 'd';
    }

    const uniqueId = `${lot?.id}-${saleIndex}`;
    const isExpanded = expandedSaleId === uniqueId;

    let expandedHtml = '';
    if (isExpanded) {
      expandedHtml = `
        <div class="sale-log-expanded-details">
          <div class="sale-log-details-grid">
            <div class="sale-detail-item">
              <span class="sale-detail-label">Cost / Unit</span>
              <span class="sale-detail-value">${formatCurrency(unitCost)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Sale / Unit</span>
              <span class="sale-detail-value">${formatCurrency(salePerUnit)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Margin / Unit</span>
              <span class="sale-detail-value accent-teal">${formatCurrency(marginPerUnit, true)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Total Cost</span>
              <span class="sale-detail-value">${formatCurrency(totalCost)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Total Revenue</span>
              <span class="sale-detail-value">${formatCurrency(revenue)}</span>
            </div>
            <div class="sale-detail-item">
              <span class="sale-detail-label">Days to Sell</span>
              <span class="sale-detail-value">${daysToSell}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="sale-log-wrapper">
        <div class="sale-log-row ${isExpanded ? 'active' : ''}" data-unique-id="${uniqueId}">
          <div class="sale-col-date">${dateDisplay}</div>
          <div class="sale-col-item">
            <div class="sale-item-name">${lotName}</div>
            <div class="sale-item-meta">${lotNum}</div>
          </div>
          <div class="sale-col-platform">
            <span class="platform-dot" style="background-color: ${platformColor}"></span>
            ${platformLabel}
          </div>
          <div class="sale-col-price">${formatCurrency(revenue)}</div>
          <div class="sale-col-profit accent-teal">${formatCurrency(profit, true)}</div>
          <div class="sale-col-roi accent-teal">+${roi}%</div>
          <div class="sale-col-qty">${units}</div>
          <div class="sale-col-actions hover-actions">
            <button class="icon-btn edit-sale-btn" data-lot-id="${lot.id}" data-sale-idx="${saleIndex}" title="Edit Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="icon-btn delete-sale-btn" data-lot-id="${lot.id}" data-sale-idx="${saleIndex}" title="Delete Sale">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
        ${expandedHtml}
      </div>
    `;
  }).join('');
}

function renderEditDrawer() {
  const { lot, sale, drawerMode } = editSaleData;
  if (drawerMode === 'delete') return renderDeleteConfirmation(lot, sale);

  const price = parseFloat(editSalePrice) || 0;
  const qty = parseInt(editSaleQty) || 1;
  const priceInCents = Math.round(price * 100);
  const totalRevenue = priceInCents * qty;

  const costBasis = lot.unitCost * qty;
  const isFacebook = editSalePlatform === 'facebook';
  const feeRate = isFacebook ? 0 : 0.135;
  const fees = Math.round(totalRevenue * feeRate);

  const shippingPerUnit = isFacebook ? 0 : (parseFloat(editSaleShipping) || 0);
  const shippingCostCents = Math.round(shippingPerUnit * 100) * qty;

  const netProfit = totalRevenue - fees - shippingCostCents - costBasis;

  return `
    <div class="intelligence-panel sale-drawer">
      <div class="drawer-header">
        <h3 class="drawer-title">Edit Sale</h3>
        <button class="close-drawer-btn" id="close-edit-drawer" title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="drawer-content">
        <div class="form-group">
          <label class="form-label">Sale Price (per unit)</label>
          <div class="input-with-prefix">
            <span class="input-prefix">$</span>
            <input type="number" 
                   class="form-input" 
                   id="edit-sale-price" 
                   placeholder="0.00" 
                   step="0.01" 
                   min="0" 
                   value="${editSalePrice}"
                   inputmode="decimal">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Quantity</label>
          <div class="quantity-stepper">
            <button type="button" class="stepper-btn" id="edit-qty-decrease">-</button>
            <input type="number" 
                   class="form-input stepper-input" 
                   id="edit-sale-qty" 
                   value="${editSaleQty}" 
                   min="1" 
                   max="${lot.remaining + sale.unitsSold}"
                   readonly>
            <button type="button" class="stepper-btn" id="edit-qty-increase">+</button>
          </div>
          <div class="qty-hint">Max: ${lot.remaining + sale.unitsSold} units</div>
        </div>

        <div class="form-group">
          <label class="form-label">Platform</label>
          ${renderPlatformSelect(editSalePlatform, 'edit-sale-platform')}
        </div>

        ${!isFacebook ? `
          <div class="form-group">
            <label class="form-label">Shipping Fee (per unit)</label>
            <div class="input-with-prefix">
              <span class="input-prefix">$</span>
              <input type="number" 
                     class="form-input" 
                     id="edit-shipping-cost" 
                     placeholder="0.00" 
                     step="0.01" 
                     min="0" 
                     value="${editSaleShipping}"
                     inputmode="decimal">
            </div>
          </div>
        ` : ''}

        <div class="sale-summary" id="edit-sale-summary-box">
          <div class="summary-row">
            <span>Revenue</span>
            <span>${formatCurrency(totalRevenue)}</span>
          </div>
          <div class="summary-row">
            <span>Fees (${isFacebook ? '0%' : '13.5%'})</span>
            <span class="negative">-${formatCurrency(fees)}</span>
          </div>
          ${!isFacebook ? `
            <div class="summary-row">
              <span>Shipping</span>
              <span class="negative">-${formatCurrency(shippingCostCents)}</span>
            </div>
          ` : ''}
          <div class="summary-row">
            <span>COGS (${qty} × ${formatCurrency(lot.unitCost)})</span>
            <span class="negative">-${formatCurrency(costBasis)}</span>
          </div>
          <div class="summary-row total">
            <span>Net Profit</span>
            <span class="${netProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(netProfit, true)}</span>
          </div>
        </div>
      </div>

      <div class="drawer-footer" style="display: flex; gap: 12px;">
        <button class="btn btn-danger" id="initiate-delete-sale" style="flex: 0 0 auto; padding: 0 20px; font-weight: 600; white-space: nowrap; transition: all 0.2s ease;">
          Delete
        </button>
        <button class="btn btn-primary record-sale-drawer-btn" style="flex: 1;" id="confirm-save-edit" ${price <= 0 ? 'disabled' : ''}>
          Update Sale
        </button>
      </div>
    </div>
  `;
}

// (Obsolete) renderDeleteConfirmation removed

function attachEditDrawerEvents() {
  const { lot, sale, drawerMode } = editSaleData;

  // Close drawer
  document.getElementById('close-edit-drawer')?.addEventListener('click', () => {
    editSaleData = null;
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  if (drawerMode === 'delete') {
    // Legacy route protection - redirect to edit if we somehow land on delete
    editSaleData.drawerMode = 'edit';
    window.dispatchEvent(new CustomEvent('viewchange'));
    return;
  }

  // Edit Mode Events
  const priceInput = document.getElementById('edit-sale-price');
  const qtyInput = document.getElementById('edit-sale-qty');
  const shipInput = document.getElementById('edit-shipping-cost');
  const platformInput = document.getElementById('edit-sale-platform');
  const saveBtn = document.getElementById('confirm-save-edit');

  const updateSummary = () => {
    const price = parseFloat(editSalePrice) || 0;
    const qty = parseInt(editSaleQty) || 1;
    const priceInCents = Math.round(price * 100);
    const totalRevenue = priceInCents * qty;

    const costBasis = lot.unitCost * qty;
    const isFacebook = editSalePlatform === 'facebook';
    const feeRate = isFacebook ? 0 : 0.135;
    const fees = Math.round(totalRevenue * feeRate);

    const shippingPerUnit = isFacebook ? 0 : (parseFloat(editSaleShipping) || 0);
    const shippingCostCents = Math.round(shippingPerUnit * 100) * qty;

    const netProfit = totalRevenue - fees - shippingCostCents - costBasis;

    const summaryBox = document.getElementById('edit-sale-summary-box');
    if (summaryBox) {
      const rows = summaryBox.querySelectorAll('.summary-row');
      if (rows.length >= 3) {
        rows[0].querySelectorAll('span')[1].textContent = formatCurrency(totalRevenue);
        rows[1].querySelectorAll('span')[1].textContent = '-' + formatCurrency(fees);
        rows[1].querySelector('span').textContent = `Fees (${isFacebook ? '0%' : '13.5%'})`;

        if (!isFacebook) {
          const shipRow = Array.from(rows).find(r => r.textContent.includes('Shipping'));
          if (shipRow) {
            shipRow.querySelectorAll('span')[1].textContent = '-' + formatCurrency(shippingCostCents);
          }
        }

        const cogsRow = Array.from(rows).find(r => r.textContent.includes('COGS'));
        if (cogsRow) {
          cogsRow.querySelector('span').textContent = `COGS (${qty} × ${formatCurrency(lot.unitCost)})`;
          cogsRow.querySelectorAll('span')[1].textContent = '-' + formatCurrency(costBasis);
        }

        const totalRow = summaryBox.querySelector('.summary-row.total');
        if (totalRow) {
          const valSpan = totalRow.querySelectorAll('span')[1];
          valSpan.textContent = formatCurrency(netProfit, true);
          valSpan.className = netProfit >= 0 ? 'positive' : 'negative';
        }
      }
    }

    if (saveBtn) saveBtn.disabled = price <= 0;
  };

  priceInput?.addEventListener('input', (e) => {
    editSalePrice = e.target.value;
    updateSummary();
  });

  shipInput?.addEventListener('input', (e) => {
    editSaleShipping = e.target.value;
    updateSummary();
  });

  document.getElementById('edit-qty-decrease')?.addEventListener('click', () => {
    if (editSaleQty > 1) {
      editSaleQty--;
      if (qtyInput) qtyInput.value = editSaleQty;
      updateSummary();
    }
  });

  document.getElementById('edit-qty-increase')?.addEventListener('click', () => {
    if (editSaleQty < (lot.remaining + sale.unitsSold)) {
      editSaleQty++;
      if (qtyInput) qtyInput.value = editSaleQty;
      updateSummary();
    }
  });

  platformInput?.addEventListener('change', (e) => {
    editSalePlatform = e.target.value;
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  saveBtn?.addEventListener('click', () => {
    const price = parseFloat(editSalePrice) || 0;
    const qty = parseInt(editSaleQty) || 1;
    const shipping = editSalePlatform !== 'facebook' ? (parseFloat(editSaleShipping) || 0) : 0;

    updateSale(lot.id, sale.id, {
      pricePerUnit: Math.round(price * 100),
      unitsSold: qty,
      platform: editSalePlatform,
      shippingCost: Math.round(shipping * 100) * qty
    });

    editSaleData = null;
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Inline Delete Logic
  const deleteBtn = document.getElementById('initiate-delete-sale');
  let deleteTimeout = null;

  deleteBtn?.addEventListener('click', () => {
    if (deleteBtn.dataset.confirming === 'true') {
      // Execute Delete
      deleteSale(lot.id, sale.id);
      editSaleData = null;
      // Also clear hash if it exists
      if (window.location.hash.includes('editLot')) {
        window.location.hash = '#/sales';
      } else {
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    } else {
      // Enter Confirm State
      deleteBtn.dataset.confirming = 'true';
      deleteBtn.textContent = 'Are you sure?';
      deleteBtn.style.background = 'rgba(239, 68, 68, 0.15)';
      deleteBtn.style.color = '#F87171';
      deleteBtn.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      deleteBtn.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.2)';

      // Auto-revert after 4 seconds
      clearTimeout(deleteTimeout);
      deleteTimeout = setTimeout(() => {
        deleteBtn.dataset.confirming = 'false';
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.background = '';
        deleteBtn.style.color = '';
        deleteBtn.style.border = '';
        deleteBtn.style.boxShadow = '';
      }, 4000);
    }
  });
}


// Helper for nice date formats in trigger
function formatShortDate(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

export function initSalesEvents() {
  const isDesktop = window.innerWidth >= 1024;
  if (!isDesktop) return;
  // Row Expand Toggle
  document.querySelectorAll('.sale-log-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const uid = row.dataset.uniqueId;
      if (expandedSaleId === uid) {
        expandedSaleId = null; // collapse if already open
      } else {
        expandedSaleId = uid;
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Action buttons
  document.querySelectorAll('.edit-sale-btn, .delete-sale-btn, .sale-edit-text-btn, .sale-delete-text-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lotId = btn.dataset.lotId;
      const saleIdx = parseInt(btn.dataset.saleIdx);
      const lot = getLots().find(l => l.id === lotId);
      const sale = lot?.sales?.[saleIdx];

      if (!lot || !sale) return;

      if (btn.classList.contains('delete') || btn.classList.contains('delete-sale-btn') || btn.classList.contains('sale-delete-text-btn')) {
        editSaleData = { lot, sale, saleIdx, drawerMode: 'delete' };
      } else {
        editSaleData = { lot, sale, saleIdx, drawerMode: 'edit' };
        editSalePrice = (sale.totalPrice / 100 / sale.unitsSold).toFixed(2);
        editSaleQty = sale.unitsSold;
        editSalePlatform = sale.platform || 'facebook';
        editSaleShipping = (sale.shippingCost / 100 / sale.unitsSold).toFixed(2);
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  if (editSaleData) attachEditDrawerEvents();


  // Search - inline filtering to prevent focus loss
  const searchInput = document.getElementById('sales-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      const query = currentSearch.toLowerCase();

      document.querySelectorAll('.sale-log-wrapper').forEach(wrapper => {
        const row = wrapper.querySelector('.sale-log-row');
        if (!row) return;

        const name = row.querySelector('.sale-item-name')?.textContent.toLowerCase() || '';
        const meta = row.querySelector('.sale-item-meta')?.textContent.toLowerCase() || '';

        if (name.includes(query) || meta.includes(query)) {
          wrapper.style.display = '';
        } else {
          wrapper.style.display = 'none';
        }
      });
    });
  }

  // Custom Date Popover Logic
  const trigger = document.getElementById('sales-date-trigger');
  const popover = document.getElementById('sales-date-popover');

  if (trigger && popover) {
    // Open/Close toggle
    trigger.addEventListener('click', (e) => {
      // Don't toggle if clicking inside the popover itself
      if (e.target.closest('.custom-date-popover')) return;

      isDatePickerOpen = !isDatePickerOpen;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });

    // Stop propagation so clicking inside doesn't close it
    popover.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Global click-outside to close attached safely across view cycles
    if (!window._salesOutsideClickHandler) {
      window._salesOutsideClickHandler = (e) => {
        const activeTrigger = document.getElementById('sales-date-trigger');
        if (isDatePickerOpen && activeTrigger && !activeTrigger.contains(e.target)) {
          isDatePickerOpen = false;
          window.dispatchEvent(new CustomEvent('viewchange'));
          document.removeEventListener('click', window._salesOutsideClickHandler);
        }
      };
    }

    document.removeEventListener('click', window._salesOutsideClickHandler);

    if (isDatePickerOpen) {
      // Delay attachment so the opening click doesn't immediately close it
      setTimeout(() => document.addEventListener('click', window._salesOutsideClickHandler), 0);
    }

    // Local popover state before hitting Apply
    let tempStart = currentStartDate;
    let tempEnd = currentEndDate;

    // Calendar Engine
    function buildCalendar() {
      const grid = document.getElementById('cal-grid');
      const label = document.getElementById('cal-month-label');
      if (!grid || !label) return;

      const date = new Date(currentViewingYear, currentViewingMonth, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      label.textContent = `${monthName} ${currentViewingYear}`;

      grid.innerHTML = '';

      const firstDayIndex = date.getDay();
      const daysInMonth = new Date(currentViewingYear, currentViewingMonth + 1, 0).getDate();
      const todayStr = new Date().toISOString().split('T')[0];

      // Empty cells
      for (let i = 0; i < firstDayIndex; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell empty';
        grid.appendChild(cell);
      }

      // Day cells
      for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        cell.textContent = i;

        // Format YYYY-MM-DD safely for local time edge cases
        const y = currentViewingYear;
        const m = String(currentViewingMonth + 1).padStart(2, '0');
        const d = String(i).padStart(2, '0');
        const cellDateStr = `${y}-${m}-${d}`;

        if (cellDateStr === todayStr) cell.classList.add('is-today');

        // Selection Visuals
        const tStart = tempStart || null;
        const tEnd = tempEnd || null;

        if (tStart && tEnd && cellDateStr >= tStart && cellDateStr <= tEnd) {
          cell.classList.add('in-range');
        }

        if (tStart === cellDateStr) {
          cell.classList.add('active-start');
          if (tEnd) cell.classList.add('has-end');
          cell.classList.remove('in-range'); // Boundary replaces in-range color
        }
        if (tEnd && tEnd === cellDateStr) {
          cell.classList.add('active-end');
          if (tStart) cell.classList.add('has-start');
          cell.classList.remove('in-range');
        }

        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (tempStart && tempEnd) {
            tempStart = cellDateStr;
            tempEnd = '';
          } else if (tempStart && !tempEnd) {
            if (cellDateStr < tempStart) {
              tempEnd = tempStart;
              tempStart = cellDateStr;
            } else {
              tempEnd = cellDateStr;
            }
          } else {
            tempStart = cellDateStr;
          }
          buildCalendar();
        });

        grid.appendChild(cell);
      }
    }

    // Call initial build if open
    if (isDatePickerOpen) buildCalendar();

    // Nav Listeners
    document.getElementById('cal-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentViewingMonth--;
      if (currentViewingMonth < 0) { currentViewingMonth = 11; currentViewingYear--; }
      buildCalendar();
    });

    document.getElementById('cal-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentViewingMonth++;
      if (currentViewingMonth > 11) { currentViewingMonth = 0; currentViewingYear++; }
      buildCalendar();
    });

    // Quick Chips
    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const range = e.target.dataset.range;
        const today = new Date();
        const endStr = today.toISOString().split('T')[0];
        let startStr = '';

        if (range === '7') {
          const start = new Date(today);
          start.setDate(today.getDate() - 7);
          startStr = start.toISOString().split('T')[0];
        } else if (range === '30') {
          const start = new Date(today);
          start.setDate(today.getDate() - 30);
          startStr = start.toISOString().split('T')[0];
        } else if (range === 'ytd') {
          startStr = `${today.getFullYear()}-01-01`;
        } else if (range === 'all') {
          startStr = '';
        }

        tempStart = startStr;
        tempEnd = range === 'all' ? '' : endStr;

        // Hop calendar view to the latest date boundary
        if (tempEnd) {
          const [y, m] = tempEnd.split('-');
          currentViewingYear = parseInt(y, 10);
          currentViewingMonth = parseInt(m, 10) - 1;
        }
        buildCalendar();
      });
    });

    // Apply & Clear
    document.getElementById('popover-apply-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentStartDate = tempStart;
      currentEndDate = tempEnd;
      isDatePickerOpen = false;
      document.removeEventListener('click', window._salesOutsideClickHandler);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });

    document.getElementById('popover-clear-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentStartDate = '';
      currentEndDate = '';
      tempStart = '';
      tempEnd = '';
      isDatePickerOpen = false;
      document.removeEventListener('click', window._salesOutsideClickHandler);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  }

  // Table sorting
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = sortKey;
        currentSort.direction = 'desc';
      }
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Auto-scroll to the expanded row if directed from another view
  if (pendingScrollToSale && expandedSaleId) {
    pendingScrollToSale = false;
    setTimeout(() => {
      const expandedRow = document.querySelector(`.sale-log-row[data-unique-id="${expandedSaleId}"]`);
      if (expandedRow) {
        expandedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }
}
