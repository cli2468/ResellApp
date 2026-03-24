// Dashboard View - Revenue/Profit chart with time-range filtering and Return Alerts

import { getAllSales, getSalesByDateRange, getLots, getLotTotalProfit, getLotsNearingReturnDeadline, getReturnDeadline, markReturned, dismissReturnAlert, getChurningOrders } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency, getMonthName, calculateChurningStats, getChurningOrdersForMonth } from '../services/calculations.js';
import { aggregateSalesByDay, getSalesForDay } from '../services/chartData.js';
import { animateCountUp } from '../utils/animations.js';
import { navigate } from '../router.js';
import { confirmAction } from '../services/feedback.js';

// Current selected time range for dashboard
let selectedRange = null;
let chartMode = 'revenue'; // 'revenue' | 'profit'
let chartInstance = null;
let currentChartData = null;
let isFirstRender = true; // Track first render for placeholders

export function setTimeRange(range) {
  selectedRange = range;
  localStorage.setItem('dashboardCurrentRange', range);
}

export function getSelectedRange() {
  return selectedRange;
}

/**
 * Get the start date for the selected range
 */
function getStartDateForRange(range) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

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
  // Don't show return alerts on mobile
  if (window.innerWidth < 1024) return '';

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

/**
 * Get contextual header label based on selected time range
 */
function getContextualHeader() {
  return 'Last 30 Days';
}

function getRangeLabel(range = selectedRange) {
  if (range === '7d') return 'last 7 days';
  if (range === '90d') return 'last 90 days';
  if (range === 'all') return 'all time';
  return 'last 30 days';
}

function getRevenueChartSummary(salesData, range = selectedRange) {
  const stats = calculateMonthlyStats(salesData);
  const margin = stats.totalRevenue > 0 ? Math.round((stats.totalProfit / stats.totalRevenue) * 100) : 0;
  const rangeLabel = getRangeLabel(range);

  if (salesData.length === 0) {
    return {
      title: `No sales recorded in the ${rangeLabel}`,
      text: `The revenue chart is empty for the ${rangeLabel}.`,
      ariaLabel: `Revenue chart with no sales recorded in the ${rangeLabel}.`
    };
  }

  const avgSaleValue = Math.round(stats.totalRevenue / salesData.length);
  return {
    title: `${salesData.length} sale${salesData.length === 1 ? '' : 's'} in the ${rangeLabel}`,
    text: `${formatCurrency(stats.totalRevenue)} in revenue, ${formatCurrency(stats.totalProfit, true)} net profit, ${margin}% margin, and an average sale value of ${formatCurrency(avgSaleValue)}.`,
    ariaLabel: `Revenue chart for the ${rangeLabel}: ${salesData.length} sales, ${formatCurrency(stats.totalRevenue)} in revenue, ${formatCurrency(stats.totalProfit, true)} net profit, and ${margin}% margin.`
  };
}

function renderChurningDashboardCard() {
  const orders = getChurningOrders();
  const monthlyOrders = getChurningOrdersForMonth(orders);
  const monthlyStats = calculateChurningStats(monthlyOrders);
  const overallStats = calculateChurningStats(orders);

  if (orders.length === 0) {
    return `
      <div class="churn-dashboard-card">
        <div class="churn-dashboard-header">
          <div>
            <div class="churn-dashboard-label">Churning</div>
            <div class="churn-dashboard-title">No orders logged yet</div>
          </div>
          <button class="btn btn-secondary" id="open-churning-tab">Open Tab</button>
        </div>
        <p class="churn-dashboard-copy">Track buy-group reimbursements, cashback profit, and payment status in one place.</p>
      </div>
    `;
  }

  return `
    <div class="churn-dashboard-card">
      <div class="churn-dashboard-header">
        <div>
          <div class="churn-dashboard-label">Churning This Month</div>
          <div class="churn-dashboard-title">${formatCurrency(monthlyStats.totalProfit, true)}</div>
        </div>
        <button class="btn btn-secondary" id="open-churning-tab">Open Tab</button>
      </div>
      <div class="churn-dashboard-copy">${monthlyStats.orderCount} order${monthlyStats.orderCount === 1 ? '' : 's'} logged this month.</div>
      <div class="churn-dashboard-grid">
        <div>
          <span>Awaiting tracking</span>
          <strong>${overallStats.pendingTrackingCount}</strong>
        </div>
        <div>
          <span>Awaiting payment</span>
          <strong>${overallStats.pendingPaymentCount}</strong>
        </div>
        <div>
          <span>Tracking overdue</span>
          <strong>${overallStats.trackingOverdueCount}</strong>
        </div>
        <div>
          <span>Cash tied up</span>
          <strong>${formatCurrency(overallStats.outstandingPurchaseVolume)}</strong>
        </div>
      </div>
    </div>
  `;
}

export function DashboardView() {
  if (!selectedRange) {
    selectedRange = localStorage.getItem('dashboardCurrentRange') || '30d';
  }

  const salesData = getSalesForSelectedRange();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const now = new Date();

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const rolling30DSales = getSalesByDateRange(thirtyDaysAgo, now);
  const rolling30DStats = calculateMonthlyStats(rolling30DSales);
  const chartSummary = getRevenueChartSummary(salesData, selectedRange);

  const returnAlertsHtml = renderReturnAlerts();

  // Calculate margin strictly on 30D
  const margin = rolling30DStats.totalRevenue > 0 ? Math.round((rolling30DStats.totalProfit / rolling30DStats.totalRevenue) * 100) : 0;
  const profitSign = rolling30DStats.totalProfit >= 0 ? '+' : '-';

  return `
    <div class="page">
      <div class="container">
        ${returnAlertsHtml}
        
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title-section">
              <div class="chart-context-label">${getContextualHeader()}</div>
              <div class="chart-revenue-value">${isFirstRender ? '$0.00' : formatCurrency(rolling30DStats.totalRevenue)}</div>
              <div class="chart-sub-metrics">
                <span class="chart-profit-inline ${rolling30DStats.totalProfit >= 0 ? 'text-success' : 'text-danger'}">${isFirstRender ? '+0.00' : (profitSign + formatCurrency(Math.abs(rolling30DStats.totalProfit)))} net</span>
                <span class="chart-metric-sep">·</span>
                <span class="chart-margin-inline ${margin >= 0 ? '' : 'text-danger'}">${isFirstRender ? '0' : margin}% margin</span>
              </div>
            </div>
            <div class="time-selector-accordion" id="time-selector">
              <button class="time-selector-trigger">
                <span class="time-selector-current">${selectedRange === '7d' ? '7D' : selectedRange === '30d' ? '30D' : selectedRange === '90d' ? '90D' : 'All'}</span>
                <svg class="time-selector-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="time-selector-dropdown">
                <button class="time-option ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">Last 7 Days</button>
                <button class="time-option ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">Last 30 Days</button>
                <button class="time-option ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">Last 90 Days</button>
                <button class="time-option ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All Time</button>
              </div>
            </div>
          </div>
          <div class="chart-wrapper">
            <canvas id="dashboard-chart" role="img" aria-label="${chartSummary.ariaLabel}">${chartSummary.text}</canvas>
          </div>
          <div class="chart-summary">
            <div class="chart-summary-title" id="dashboard-chart-summary-title">${chartSummary.title}</div>
            <p class="chart-summary-text" id="dashboard-chart-summary-text">${chartSummary.text}</p>
          </div>
        </div>
        
        ${renderTopPerformers(allLots)}
        
        ${renderInventoryCard(allLots, unsoldCostBasis, unsoldUnits)}

        ${renderChurningDashboardCard()}
        
        <!-- Day breakdown modal -->
        <div class="modal-overlay day-breakdown-modal" id="day-breakdown-modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title" id="day-breakdown-title">Sales</h2>
              <button class="modal-close" id="close-day-modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div id="day-breakdown-content"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderChartSection(stats) {
  const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';

  return `
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title-section">
          <div class="chart-main-title">Total Revenue</div>
          <div class="chart-revenue-value">${formatCurrency(stats.totalRevenue)}</div>
          <div class="chart-profit-subtitle ${profitClass}">
            ${formatCurrency(Math.abs(stats.totalProfit))} profit this ${selectedRange === '7d' ? 'week' : selectedRange === '30d' ? 'month' : selectedRange === '90d' ? 'quarter' : 'lifetime'}
          </div>
        </div>
        <div class="chart-pill-selector">
          <button class="pill-btn ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">7D</button>
          <button class="pill-btn ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">30D</button>
          <button class="pill-btn ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">90D</button>
          <button class="pill-btn ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All</button>
        </div>
      </div>
      <div class="chart-wrapper">
        <canvas id="dashboard-chart"></canvas>
      </div>
    </div>
  `;
}

function renderTopPerformers(allLots) {
  // Calculate per-lot stats
  const lotStats = allLots
    .filter(lot => lot.sales && lot.sales.length > 0)
    .map(lot => {
      const totalProfit = getLotTotalProfit(lot);
      const totalUnitsSold = lot.sales.reduce((sum, s) => sum + (s.unitsSold || 0), 0);
      const totalCostBasis = lot.sales.reduce((sum, s) => sum + (s.costBasis || 0), 0);
      const roi = totalCostBasis > 0 ? (totalProfit / totalCostBasis) * 100 : Infinity;
      // Find the most recent sale date for this lot
      const lastSaleDate = lot.sales.reduce((latest, s) => {
        const d = new Date(s.dateSold);
        return d > latest ? d : latest;
      }, new Date(0));
      return { name: lot.name, totalProfit, totalUnitsSold, roi, lastSaleDate };
    })
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 3);

  if (lotStats.length === 0) {
    return `
      <div class="mpp-card">
        <div class="mpp-header">
          <div class="mpp-title">Most Profitable Products</div>
          <div class="mpp-subtitle">All Time · Ranked by Net Profit</div>
        </div>
        <div class="mpp-empty">No sales data yet</div>
      </div>
    `;
  }

  // Calculate "updated ago" from the most recent sale across all top items
  const mostRecentSale = lotStats.reduce((latest, item) =>
    item.lastSaleDate > latest ? item.lastSaleDate : latest, new Date(0));
  const minsAgo = Math.max(1, Math.round((Date.now() - mostRecentSale.getTime()) / 60000));
  let updatedText;
  if (minsAgo < 60) updatedText = `${minsAgo}m ago`;
  else if (minsAgo < 1440) updatedText = `${Math.round(minsAgo / 60)}h ago`;
  else updatedText = `${Math.round(minsAgo / 1440)}d ago`;

  // Find highest ROI item for performance cue
  const highestRoiIdx = lotStats.reduce((best, item, i) => {
    const bestRoi = lotStats[best].roi;
    return item.roi > bestRoi ? i : best;
  }, 0);

  const itemsHtml = lotStats.map((item, i) => {
    const isTop = i === 0;
    const roiIsInfinite = !isFinite(item.roi);
    const isHighestRoi = i === highestRoiIdx;

    // ROI display and intensity class
    let roiHtml;
    if (roiIsInfinite) {
      roiHtml = `<span class="mpp-roi-badge mpp-roi-infinite" title="Cost basis was $0 — pure profit">${isHighestRoi ? '🔥 ' : ''}∞</span>`;
    } else {
      const absRoi = Math.abs(item.roi);
      const roiTier = absRoi >= 100 ? 'high' : absRoi >= 40 ? 'mid' : 'low';
      const sign = item.roi >= 0 ? '+' : '';
      roiHtml = `<span class="mpp-roi-badge mpp-roi-${roiTier}">${isHighestRoi ? '🔥 ' : ''}${sign}${item.roi.toFixed(0)}%</span>`;
    }

    return `
      <div class="mpp-row ${isTop ? 'mpp-row-top' : ''}">
        <div class="mpp-rank">${i + 1}</div>
        <div class="mpp-info">
          <div class="mpp-name">${item.name}</div>
          <div class="mpp-units">${item.totalUnitsSold} unit${item.totalUnitsSold !== 1 ? 's' : ''} sold</div>
        </div>
        <div class="mpp-metrics">
          ${roiHtml}
          <div class="mpp-profit-block">
            <div class="mpp-profit-value ${item.totalProfit >= 0 ? '' : 'mpp-negative'}">${formatCurrency(Math.abs(item.totalProfit))}</div>
            <div class="mpp-profit-label">Net Profit</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="mpp-card">
      <div class="mpp-header">
        <div class="mpp-title">Most Profitable Products</div>
        <div class="mpp-subtitle">All Time · Ranked by Net Profit</div>
      </div>
      <div class="mpp-list">
        ${itemsHtml}
      </div>
      <div class="mpp-footer">Updated ${updatedText}</div>
    </div>
  `;
}

function renderInventoryCard(allLots, unsoldCostBasis, unsoldUnits) {
  const unsoldLots = allLots.filter(lot => lot.remaining > 0);
  const itemCount = unsoldLots.length;

  // Projected remaining profit: avg profit per unit × remaining units
  const allSalesData = allLots.flatMap(lot => (lot.sales || []).filter(s => !s.returned));
  const totalSoldUnits = allSalesData.reduce((sum, s) => sum + (s.unitsSold || 0), 0);
  const totalProfit = allSalesData.reduce((sum, s) => sum + (s.profit || 0), 0);
  const avgProfitPerUnit = totalSoldUnits > 0 ? totalProfit / totalSoldUnits : 0;
  const projectedProfit = Math.round(avgProfitPerUnit * unsoldUnits);

  // Oldest unsold item (days since purchase)
  let oldestDays = 0;
  if (unsoldLots.length > 0) {
    const now = new Date();
    const oldestDate = unsoldLots.reduce((oldest, lot) => {
      const d = new Date(lot.dateAdded || lot.createdAt);
      return d < oldest ? d : oldest;
    }, now);
    oldestDays = Math.max(0, Math.floor((now - oldestDate) / (1000 * 60 * 60 * 24)));
  }

  return `
    <div class="inv-card">
      <div class="inv-header">Inventory Status</div>
      <div class="inv-grid">
        <div class="inv-metric">
          <div class="inv-metric-value">${formatCurrency(unsoldCostBasis)}</div>
          <div class="inv-metric-label">Capital Deployed</div>
        </div>
        <div class="inv-metric">
          <div class="inv-metric-value ${projectedProfit >= 0 ? 'inv-positive' : 'inv-negative'}">${projectedProfit >= 0 ? '+' : '-'}${formatCurrency(Math.abs(projectedProfit))}</div>
          <div class="inv-metric-label">Projected Profit</div>
        </div>
        <div class="inv-metric">
          <div class="inv-metric-value">${oldestDays}<span class="inv-metric-unit">d</span></div>
          <div class="inv-metric-label">Oldest Item</div>
        </div>
      </div>
      <div class="inv-footer">${unsoldUnits} unit${unsoldUnits !== 1 ? 's' : ''} across ${itemCount} product${itemCount !== 1 ? 's' : ''}</div>
    </div>
  `;
}

/**
 * Initialize and render the chart
 */
function initChart() {
  const canvas = document.getElementById('dashboard-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const salesData = getSalesForSelectedRange();
  currentChartData = aggregateSalesByDay(salesData, selectedRange);

  const { labels, cumulativeRevenues } = currentChartData;

  // Calculate Y-axis step size using nice increments (100, 500, 1000, 2000)
  // Ensure 5-6 total Y-axis points (4-5 intervals) including zero
  const maxRevenue = Math.max(...cumulativeRevenues, 0);
  const niceSteps = [100, 500, 1000, 2000];

  // Find step that gives us 4-5 intervals (5-6 total points including zero)
  let stepSize = 2000; // Default to largest
  for (const step of niceSteps) {
    const intervals = maxRevenue / step;
    if (intervals >= 4 && intervals <= 5) {
      // Perfect: 4-5 intervals means 5-6 points (including zero)
      stepSize = step;
      break;
    } else if (intervals < 4) {
      // Too few intervals, use larger step (fewer intervals)
      stepSize = step;
      break;
    }
    stepSize = step;
  }

  // Calculate yMax to ensure exactly 5-6 points
  // Round to nearest multiple of stepSize that gives 4-5 intervals
  let targetIntervals = Math.ceil(maxRevenue / stepSize);
  targetIntervals = Math.max(4, Math.min(5, targetIntervals)); // Clamp to 4-5 intervals
  const yMax = targetIntervals * stepSize;

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  // Create fade gradient that goes from accent to transparent
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
  gradient.addColorStop(0, 'rgba(163, 230, 53, 0.24)');
  gradient.addColorStop(0.5, 'rgba(163, 230, 53, 0.1)');
  gradient.addColorStop(1, 'rgba(163, 230, 53, 0)');

  // Custom plugin for vertical dotted hover line
  const verticalLinePlugin = {
    id: 'verticalLine',
    beforeDatasetsDraw: (chart) => {
      const { ctx, chartArea: { top, bottom }, tooltip } = chart;
      if (tooltip?._active?.length) {
        const x = tooltip._active[0].element.x;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.5)';
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue',
        data: cumulativeRevenues,
        backgroundColor: gradient,
        borderColor: '#A3E635',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#A3E635',
        pointBorderColor: '#0A0A0A',
        pointBorderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#A3E635',
        pointHoverBorderColor: '#0A0A0A',
        pointHoverBorderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          showDayBreakdown(index);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#A3E635',
          borderColor: 'rgba(163, 230, 53, 0.35)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: function (context) {
              return context[0].label;
            },
            label: function (context) {
              const value = context.raw;
              return 'Revenue: $' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
          }
        },
        verticalLine: verticalLinePlugin
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.45)',
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: selectedRange !== '7d', // Show all labels for 7D
            maxTicksLimit: selectedRange === '7d' ? 7 : 6
          },
          border: {
            display: false
          }
        },
        y: {
          min: 0,
          max: yMax,
          ticks: {
            stepSize: stepSize,
            color: 'rgba(255, 255, 255, 0.45)',
            font: { size: 11 },
            padding: 8,
            callback: function (value) {
              if (value >= 1000) {
                return '$' + (value / 1000).toFixed(1) + 'k';
              }
              return '$' + value;
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.06)',
            drawBorder: false,
            tickLength: 0
          },
          border: {
            display: false
          }
        }
      }
    },
    plugins: [verticalLinePlugin]
  });
}

/**
 * Show breakdown of sales for a specific day
 */
function showDayBreakdown(dayIndex) {
  if (!currentChartData) return;

  const sales = getSalesForDay(currentChartData.salesByDay, dayIndex);
  const dateKeys = Array.from(currentChartData.salesByDay.keys());
  const dateKey = dateKeys[dayIndex];
  const date = new Date(dateKey + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const modal = document.getElementById('day-breakdown-modal');
  const title = document.getElementById('day-breakdown-title');
  const content = document.getElementById('day-breakdown-content');

  if (!modal || !title || !content) return;

  title.textContent = dateStr;

  if (sales.length === 0) {
    content.innerHTML = `<p class="text-muted" style="text-align: center; padding: var(--spacing-lg);">No sales on this day</p>`;
  } else {
    content.innerHTML = sales.map(({ lot, sale }) => `
      <div class="day-sale-item">
        <div class="day-sale-info">
          <div class="day-sale-name">${lot.name}</div>
          <div class="day-sale-meta">${sale.unitsSold} unit${sale.unitsSold > 1 ? 's' : ''} on ${sale.platform === 'ebay' ? 'eBay' : 'Facebook'}</div>
        </div>
        <div class="day-sale-values">
          <div class="day-sale-revenue">${formatCurrency(sale.totalPrice)}</div>
          <div class="day-sale-profit ${sale.profit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(sale.profit, true)}</div>
        </div>
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
}

/**
 * Close the day breakdown modal
 */
function closeDayModal() {
  const modal = document.getElementById('day-breakdown-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Animate revenue and profit count-up
 */
function animateDashboardTotals(stats) {
  const revenueEl = document.querySelector('.chart-revenue-value');
  const profitInlineEl = document.querySelector('.chart-profit-inline');
  const marginInlineEl = document.querySelector('.chart-margin-inline');

  if (revenueEl) {
    animateCountUp(revenueEl, 0, stats.totalRevenue, 800, (val) => formatCurrency(val));
  }

  if (profitInlineEl) {
    const profitClass = stats.totalProfit >= 0 ? 'text-success' : 'text-danger';
    profitInlineEl.className = `chart-profit-inline ${profitClass}`;
    const sign = stats.totalProfit >= 0 ? '+' : '-';
    animateCountUp(profitInlineEl, 0, Math.abs(stats.totalProfit), 800, (val) => {
      return `${sign}${formatCurrency(val)} net`;
    });
  }

  if (marginInlineEl) {
    const margin = stats.totalRevenue > 0 ? Math.round((stats.totalProfit / stats.totalRevenue) * 100) : 0;
    marginInlineEl.textContent = `${margin}% margin`;
    if (margin < 0) marginInlineEl.classList.add('text-danger');
    else marginInlineEl.classList.remove('text-danger');
  }
}

/**
 * Update chart without full page re-render
 */
function updateDashboard() {
  const salesData = getSalesForSelectedRange();
  const chartSummary = getRevenueChartSummary(salesData, selectedRange);
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const rolling30DSales = getSalesByDateRange(thirtyDaysAgo, now);
  const rolling30DStats = calculateMonthlyStats(rolling30DSales);

  // Update time selector active state and current label
  document.querySelectorAll('.time-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === selectedRange);
  });

  const currentLabelEl = document.querySelector('.time-selector-current');
  if (currentLabelEl) {
    const labelMap = { '7d': '7D', '30d': '30D', '90d': '90D', 'all': 'All' };
    currentLabelEl.textContent = labelMap[selectedRange];
  }

  // Update contextual header
  const contextLabel = document.querySelector('.chart-context-label');
  if (contextLabel) {
    contextLabel.textContent = getContextualHeader();
  }

  const summaryTitleEl = document.getElementById('dashboard-chart-summary-title');
  const summaryTextEl = document.getElementById('dashboard-chart-summary-text');
  const chartCanvas = document.getElementById('dashboard-chart');
  if (summaryTitleEl) summaryTitleEl.textContent = chartSummary.title;
  if (summaryTextEl) summaryTextEl.textContent = chartSummary.text;
  if (chartCanvas) chartCanvas.setAttribute('aria-label', chartSummary.ariaLabel);

  // Re-render chart
  initChart();

  // Update totals in header with animation
  animateDashboardTotals(rolling30DStats);
}

export function initDashboardEvents(isInitialLoad = false) {
  // Ultra-snappier reveal: start animations as preloader begins to fade out (approx 750ms)
  const animationDelay = isInitialLoad ? 750 : 0;

  setTimeout(() => {
    isFirstRender = false; // Next renders will not show placeholders
    // Initialize chart and animate count-up together
    initChart();

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const rolling30DSales = getSalesByDateRange(thirtyDaysAgo, now);
    const rolling30DStats = calculateMonthlyStats(rolling30DSales);

    animateDashboardTotals(rolling30DStats);
  }, animationDelay);

  // Time selector accordion toggle
  const timeSelector = document.getElementById('time-selector');
  const trigger = timeSelector?.querySelector('.time-selector-trigger');

  trigger?.addEventListener('click', () => {
    timeSelector?.classList.toggle('open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (timeSelector && !timeSelector.contains(e.target)) {
      timeSelector.classList.remove('open');
    }
  });

  // Time option selection
  document.querySelectorAll('.time-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      timeSelector?.classList.remove('open');
      updateDashboard();
    });
  });

  // Day breakdown modal close
  document.getElementById('close-day-modal')?.addEventListener('click', closeDayModal);
  document.getElementById('day-breakdown-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'day-breakdown-modal') closeDayModal();
  });

  // Mark Returned buttons
  document.querySelectorAll('.mark-returned-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lotId = btn.dataset.lotId;
      const confirmed = await confirmAction({
        title: 'Mark as returned',
        message: 'Mark this item as returned? It will be removed from inventory.',
        confirmLabel: 'Mark returned',
        tone: 'danger'
      });
      if (!confirmed) return;

      markReturned(lotId);
      window.dispatchEvent(new CustomEvent('viewchange'));
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

  document.getElementById('open-churning-tab')?.addEventListener('click', () => {
    navigate('/churning');
  });
}
