// Dashboard View - Profit overview with time-range filtering and Return Alerts

import { getAllSales, getSalesByDateRange, getLots, getLotsNearingReturnDeadline, getReturnDeadline, markReturned, dismissReturnAlert } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency } from '../services/calculations.js';

// Current selected time range for dashboard
let selectedRange = '30d'; // '7d' | '30d' | '90d' | 'all'

export function setTimeRange(range) {
  selectedRange = range;
}

export function getSelectedRange() {
  return selectedRange;
}

/**
 * Get the start date for the selected range
 */
function getStartDateForRange(range) {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  switch (range) {
    case '7d':
      const start7d = new Date(now);
      start7d.setDate(start7d.getDate() - 6);
      start7d.setHours(0, 0, 0, 0);
      return start7d;
    case '30d':
      const start30d = new Date(now);
      start30d.setDate(start30d.getDate() - 29);
      start30d.setHours(0, 0, 0, 0);
      return start30d;
    case '90d':
      const start90d = new Date(now);
      start90d.setDate(start90d.getDate() - 89);
      start90d.setHours(0, 0, 0, 0);
      return start90d;
    case 'all':
    default:
      return null;
  }
}

/**
 * Get sales for the currently selected range
 */
function getSalesForSelectedRange() {
  if (selectedRange === 'all') {
    return getAllSales();
  }
  const startDate = getStartDateForRange(selectedRange);
  return getSalesByDateRange(startDate, new Date());
}

function renderReturnAlerts() {
  const lotsNearingDeadline = getLotsNearingReturnDeadline(3);

  if (lotsNearingDeadline.length === 0) return '';

  const alertCards = lotsNearingDeadline.map(lot => {
    const deadline = getReturnDeadline(lot);
    const dateStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="return-alert-card" data-lot-id="${lot.id}">
        <div class="return-alert-content">
          <div class="return-alert-icon">⚠️</div>
          <div class="return-alert-text">
            <div class="return-alert-title">${lot.name}</div>
            <div class="return-alert-meta">${lot.remaining} unit${lot.remaining > 1 ? 's' : ''} • Return by ${dateStr}</div>
          </div>
        </div>
        <div class="return-alert-actions">
          <button class="btn btn-danger btn-sm mark-returned-btn" data-lot-id="${lot.id}">Returned</button>
          <button class="btn btn-secondary btn-sm keeping-it-btn" data-lot-id="${lot.id}">Keeping</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="return-alerts-section">
      <h3 class="section-title" style="color: var(--accent-warning);">⏰ Return Window Alerts</h3>
      ${alertCards}
    </div>
  `;
}

function getRangeLabel(range) {
  switch (range) {
    case '7d': return 'Last 7 Days';
    case '30d': return 'Last 30 Days';
    case '90d': return 'Last 90 Days';
    case 'all': return 'All Time';
    default: return '';
  }
}

export function DashboardView() {
  const salesData = getSalesForSelectedRange();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const stats = calculateMonthlyStats(salesData);

  const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';
  const returnAlertsHtml = renderReturnAlerts();

  return `
    <div class="page">
      <div class="container">
        <h1 class="page-title">Dashboard</h1>
        
        ${returnAlertsHtml}
        
        <div class="time-range-selector">
          <button class="range-btn ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">7D</button>
          <button class="range-btn ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">30D</button>
          <button class="range-btn ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">90D</button>
          <button class="range-btn ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All</button>
        </div>
        
        <div id="dashboard-stats">
          ${renderStatsContent(stats, profitClass, unsoldUnits, unsoldCostBasis)}
        </div>
      </div>
    </div>
  `;
}

function renderStatsContent(stats, profitClass, unsoldUnits, unsoldCostBasis) {
  return `
    <div class="stats-grid">
      <div class="stat-card profit">
        <div class="stat-icon">💰</div>
        <div class="stat-value ${profitClass}">${formatCurrency(stats.totalProfit)}</div>
        <div class="stat-label">Profit</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-value">${stats.unitsSold}</div>
        <div class="stat-label">Units Sold</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">💵</div>
        <div class="stat-value">${formatCurrency(stats.totalRevenue)}</div>
        <div class="stat-label">Revenue</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🏷️</div>
        <div class="stat-value">${formatCurrency(stats.totalFees)}</div>
        <div class="stat-label">Fees Paid</div>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: var(--spacing-lg);">
      <h3 class="section-title">Summary</h3>
      <div class="summary-box">
        <div class="summary-row">
          <span class="text-secondary">Revenue</span>
          <span class="summary-value">${formatCurrency(stats.totalRevenue)}</span>
        </div>
        <div class="summary-row">
          <span class="text-secondary">Cost of Goods</span>
          <span class="summary-value">-${formatCurrency(stats.totalCosts)}</span>
        </div>
        <div class="summary-row">
          <span class="text-secondary">Platform Fees</span>
          <span class="summary-value">-${formatCurrency(stats.totalFees)}</span>
        </div>
        <div class="summary-row ${stats.totalProfit >= 0 ? 'profit' : 'loss'}">
          <span>Net Profit</span>
          <span class="summary-value">${formatCurrency(stats.totalProfit)}</span>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h3 class="section-title">Inventory Status</h3>
      <div class="stats-grid" style="margin-bottom: 0;">
        <div class="stat-card">
          <div class="stat-value">${unsoldUnits}</div>
          <div class="stat-label">Unsold Units</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(unsoldCostBasis)}</div>
          <div class="stat-label">Cost Basis</div>
        </div>
      </div>
    </div>
  `;
}

// Update stats without full page re-render
function updateDashboardStats() {
  const salesData = getSalesForSelectedRange();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const stats = calculateMonthlyStats(salesData);
  const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';

  // Update range button active states
  document.querySelectorAll('.range-btn').forEach(btn => {
    if (btn.dataset.range === selectedRange) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update stats content
  const statsContainer = document.getElementById('dashboard-stats');
  if (statsContainer) {
    statsContainer.innerHTML = renderStatsContent(stats, profitClass, unsoldUnits, unsoldCostBasis);
  }
}

export function initDashboardEvents() {
  // Time range buttons - targeted update only
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      updateDashboardStats();
    });
  });

  // Mark Returned buttons
  document.querySelectorAll('.mark-returned-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lotId;
      if (confirm('Mark this item as returned? It will be removed from inventory.')) {
        markReturned(lotId);
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    });
  });

  // Keeping It buttons
  document.querySelectorAll('.keeping-it-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lotId;
      dismissReturnAlert(lotId);
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });
}
