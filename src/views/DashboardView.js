// Dashboard View - Monthly profit overview with Return Alerts

import { getSalesByMonth, getLots, getLotsNearingReturnDeadline, getReturnDeadline, markReturned, dismissReturnAlert } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency, getMonthName } from '../services/calculations.js';

// Current selected month/year for dashboard
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

export function setMonth(year, month) {
  currentYear = year;
  currentMonth = month;
}

export function getSelectedDate() {
  return { year: currentYear, month: currentMonth };
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

export function DashboardView() {
  const salesData = getSalesByMonth(currentYear, currentMonth);
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
        
        <div class="month-selector">
          <button class="month-btn" id="prev-month">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span class="month-display">${getMonthName(currentMonth)} ${currentYear}</span>
          <button class="month-btn" id="next-month">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        
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
      </div>
    </div>
  `;
}

export function initDashboardEvents() {
  document.getElementById('prev-month')?.addEventListener('click', () => {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
    window.dispatchEvent(new CustomEvent('viewchange'));
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
