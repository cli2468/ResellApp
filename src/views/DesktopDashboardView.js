import { getAllSales, getSalesByDateRange, getLots, getLotTotalProfit, getChurningOrders } from '../services/storage.js';
import { calculateMonthlyStats, formatCurrency, calculateChurningStats, getChurningOrdersForMonth } from '../services/calculations.js';
import { aggregateSalesByDay, aggregateSalesForChart } from '../services/chartData.js';
import { renderPlatformBadge } from '../services/uiHelpers.js';
import { navigate } from '../router.js';
import { auth } from '../services/firebase.js';

let selectedRange = localStorage.getItem('dashboardCurrentRange') || 'all';
let desktopChartInstance = null;
let desktopChartData = null;
let selectedBarIndex = null;
let segmentationChartInstance = null;
let currentCenterVal = 0;
let centerAnimFrame = null;

// Helper function to animate numbers (count up/down)
function animateValue(obj, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // easeOutExpo for a snappy, modern counting effect
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

    currentCenterVal = Math.floor(ease * (end - start) + start);
    obj.innerHTML = currentCenterVal.toLocaleString();

    if (progress < 1) {
      centerAnimFrame = window.requestAnimationFrame(step);
    } else {
      currentCenterVal = end;
      obj.innerHTML = end.toLocaleString();
    }
  };
  if (centerAnimFrame) window.cancelAnimationFrame(centerAnimFrame);
  centerAnimFrame = window.requestAnimationFrame(step);
}

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function getSelectedRangeLabel(range = selectedRange) {
  if (range === '7d') return 'last 7 days';
  if (range === '90d') return 'last 90 days';
  if (range === 'all') return 'last 12 months';
  return 'last 30 days';
}

function getDashboardRangeData(range = selectedRange) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (range === 'all') {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 364);
    startDate.setHours(0, 0, 0, 0);

    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - 365);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    return {
      salesData: getSalesByDateRange(startDate, now),
      prevSalesData: getSalesByDateRange(prevStart, prevEnd)
    };
  }

  const days = range === '7d' ? 6 : range === '90d' ? 89 : 29;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - (days + 1));
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  prevEndDate.setHours(23, 59, 59, 999);

  return {
    salesData: getSalesByDateRange(startDate, now),
    prevSalesData: getSalesByDateRange(prevStartDate, prevEndDate)
  };
}

function getDesktopRevenueSummary(salesData, prevSalesData, range = selectedRange) {
  const stats = calculateMonthlyStats(salesData);
  const prevStats = calculateMonthlyStats(prevSalesData);
  const margin = stats.totalRevenue > 0 ? Math.round((stats.totalProfit / stats.totalRevenue) * 100) : 0;
  const avgSaleValue = salesData.length > 0 ? Math.round(stats.totalRevenue / salesData.length) : 0;
  const rangeLabel = getSelectedRangeLabel(range);

  if (salesData.length === 0) {
    return {
      title: `No sales recorded in the ${rangeLabel}`,
      text: `The revenue chart is empty for the ${rangeLabel}.`,
      ariaLabel: `Revenue chart with no sales recorded in the ${rangeLabel}.`
    };
  }

  const trend = calculateTrend(stats.totalRevenue, prevStats.totalRevenue);
  const trendDirection = trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'down' : 'flat';
  return {
    title: `${salesData.length} sale${salesData.length === 1 ? '' : 's'} in the ${rangeLabel}`,
    text: `${formatCurrency(stats.totalRevenue)} in revenue, ${formatCurrency(stats.totalProfit, true)} net profit, ${margin}% margin, average sale ${formatCurrency(avgSaleValue)}, and revenue trend ${trendDirection} versus the previous comparison window.`,
    ariaLabel: `Revenue chart for the ${rangeLabel}: ${salesData.length} sales, ${formatCurrency(stats.totalRevenue)} in revenue, ${formatCurrency(stats.totalProfit, true)} net profit, ${margin}% margin, and revenue trend ${trendDirection}.`
  };
}

function getSegmentationSummary(chartStats, totalSales, range = selectedRange) {
  const rangeLabel = getSelectedRangeLabel(range);

  if (!chartStats.length || totalSales === 0) {
    return {
      title: `No channel mix available for the ${rangeLabel}`,
      text: `The segmentation chart is empty for the ${rangeLabel}.`,
      ariaLabel: `Segmentation chart with no sales recorded in the ${rangeLabel}.`
    };
  }

  const leader = chartStats[0];
  const leaderLabel = leader.platform.charAt(0).toUpperCase() + leader.platform.slice(1);
  const revenueTotal = chartStats.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const share = revenueTotal > 0 ? Math.round((leader.revenue / revenueTotal) * 100) : 0;

  return {
    title: `${chartStats.length} channel${chartStats.length === 1 ? '' : 's'} active in the ${rangeLabel}`,
    text: `${leaderLabel} leads with ${formatCurrency(leader.revenue)} across ${leader.count} sale${leader.count === 1 ? '' : 's'}, representing ${share}% of recorded revenue.`,
    ariaLabel: `Segmentation chart for the ${rangeLabel}: ${chartStats.length} active channels. ${leaderLabel} leads with ${formatCurrency(leader.revenue)} across ${leader.count} sales and ${share}% of revenue.`
  };
}

export function DesktopDashboardView() {
  // Clean up stale chart references when the view re-renders after navigation
  if (desktopChartInstance) {
    desktopChartInstance.destroy();
    desktopChartInstance = null;
  }
  if (segmentationChartInstance) {
    segmentationChartInstance.destroy();
    segmentationChartInstance = null;
  }

  if (!selectedRange) {
    selectedRange = localStorage.getItem('dashboardCurrentRange') || '30d';
  }

  const salesData = getAllSales();
  const allLots = getLots();
  const unsoldUnits = allLots.reduce((sum, lot) => sum + (lot.remaining || 0), 0);
  const unsoldCostBasis = allLots.reduce((sum, lot) => sum + (lot.unitCost || 0) * (lot.remaining || 0), 0);
  const isDemo = localStorage.getItem('demoMode') === 'true';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const rawName = auth.currentUser?.displayName?.split(' ')[0] || '';
  const userName = isDemo ? 'Demo User' : (rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : 'there');

  const now = new Date();
  now.setHours(23, 59, 59, 999);


  // Rolling 30D Bounds
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  sixtyDaysAgo.setHours(0, 0, 0, 0);

  // KPIs are strictly rolling 30D and real-time, completely ignoring selectedRange
  const currentMonthSales = getSalesByDateRange(thirtyDaysAgo, now);
  const previousMonthSales = getSalesByDateRange(sixtyDaysAgo, thirtyDaysAgo);
  const inventoryValueAtStartOfMonth = calculateInventoryValueAtDate(allLots, thirtyDaysAgo);
  const prevUnsoldUnitsAtStartOfMonth = calculateInventoryQtyAtDate(allLots, thirtyDaysAgo);

  const currentStats = calculateMonthlyStats(currentMonthSales);
  const previousStats = calculateMonthlyStats(previousMonthSales);

  const profitMargin = currentStats.totalRevenue > 0
    ? Math.round((currentStats.totalProfit / currentStats.totalRevenue) * 100)
    : 0;
  const prevProfitMargin = previousStats.totalRevenue > 0
    ? Math.round((previousStats.totalProfit / previousStats.totalRevenue) * 100)
    : 0;

  const kpiMetrics = [
    {
      label: 'Monthly Profit',
      value: formatCurrency(currentStats.totalProfit, false),
      trend: calculateTrend(currentStats.totalProfit, previousStats.totalProfit),
    },
    {
      label: 'Profit Margin',
      value: `${profitMargin}%`,
      trend: calculateTrend(profitMargin, prevProfitMargin),
    },
    {
      label: 'Inventory Value',
      value: formatCurrency(unsoldCostBasis),
      trend: calculateTrend(unsoldCostBasis, inventoryValueAtStartOfMonth),
    },
    {
      label: 'Inventory Qty',
      value: unsoldUnits.toString(),
      trend: calculateTrend(unsoldUnits, prevUnsoldUnitsAtStartOfMonth),
    },
    {
      label: 'Items Sold',
      value: currentStats.unitsSold.toString(),
      trend: calculateTrend(currentStats.unitsSold, previousStats.unitsSold),
    },
  ];

  const churningOrders = getChurningOrders();
  const currentMonthChurning = getChurningOrdersForMonth(churningOrders);
  const churningStats = calculateChurningStats(currentMonthChurning);
  const overallChurningStats = calculateChurningStats(churningOrders);

  const recentSales = [...salesData]
    .sort((a, b) => {
      const dateA = a.sale?.dateSold ? new Date(a.sale.dateSold) : new Date(0);
      const dateB = b.sale?.dateSold ? new Date(b.sale.dateSold) : new Date(0);
      return dateB - dateA;
    })
    .slice(0, 7);
  const { salesData: rangeSalesData, prevSalesData: prevRangeSalesData } = getDashboardRangeData(selectedRange);
  const revenueSummary = getDesktopRevenueSummary(rangeSalesData, prevRangeSalesData, selectedRange);

  return `
    <div class="desktop-dashboard vision-desktop-dashboard">
      <div class="dashboard-intro">
        <h2 class="dashboard-greeting">${timeGreeting}, ${userName}</h2>
        <p class="dashboard-greeting-subtext">${isDemo ? "You're currently exploring the dashboard with sample data." : "Here's what's happening today."}</p>
      </div>

      <div class="kpi-pill">
        ${kpiMetrics.map((m, i) => `
          ${i > 0 ? '<div class="kpi-pill-divider"></div>' : ''}
          <div class="kpi-pill-cell">
            <span class="kpi-pill-label">${m.label}</span>
            <span class="kpi-pill-value">${m.value}</span>
            ${renderPillTrend(m.trend)}
          </div>
        `).join('')}
      </div>

      <div class="dashboard-mid-row">
        <div class="chart-section-large revenue-panel">
          <div class="section-header chart-revenue-header">
            <div class="header-titles">
              <h3 class="section-title">Sales Revenue</h3>
              <div id="revenue-dynamic-value" class="revenue-hero-value">$0.00</div>
              <div id="revenue-dynamic-trend" class="kpi-pill-trend dashboard-revenue-trend"></div>
            </div>
            <div class="date-range-filter">
              <button class="filter-btn ${selectedRange === '7d' ? 'active' : ''}" data-range="7d">7D</button>
              <button class="filter-btn ${selectedRange === '30d' ? 'active' : ''}" data-range="30d">30D</button>
              <button class="filter-btn ${selectedRange === '90d' ? 'active' : ''}" data-range="90d">90D</button>
              <button class="filter-btn ${selectedRange === 'all' ? 'active' : ''}" data-range="all">All</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="desktop-revenue-chart" role="img" aria-label="${revenueSummary.ariaLabel}">${revenueSummary.text}</canvas>
          </div>
          <div class="chart-summary desktop-chart-summary">
            <div class="chart-summary-title" id="desktop-revenue-summary-title">${revenueSummary.title}</div>
            <p class="chart-summary-text" id="desktop-revenue-summary-text">${revenueSummary.text}</p>
          </div>
        </div>

        <div class="chart-section-small segmentation-panel">
          <div class="section-header">
            <h3 class="section-title">Segmentation</h3>
          </div>
          ${renderSegmentation(rangeSalesData, prevRangeSalesData)}
        </div>
      </div>

      <div class="dashboard-bottom-row">
        <div class="bottom-card">
          ${renderTopPerformersPanel(allLots)}
        </div>
        <div class="bottom-card">
          ${renderChurningSnapshot(churningStats, overallChurningStats)}
        </div>
        <div class="bottom-card">
          ${renderRecentSalesCard(recentSales, allLots)}
        </div>
      </div>
    </div>
  `;
}

function renderPillTrend(trend) {
  if (!trend) return '';
  const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '';
  const cls = trend.direction === 'up' ? 'trend-up' : trend.direction === 'down' ? 'trend-down' : 'trend-neutral';
  // Use a slight gap if arrow exists
  const arrowHtml = arrow ? ` ${arrow}` : '';
  const valHtml = formatTrendPercent(trend.value);
  return `<span class="kpi-pill-trend"><span class="${cls}">${valHtml}${arrowHtml}</span> vs Last 30D</span>`;
}

function calculateInventoryValueAtDate(lots, atDate) {
  const targetTime = atDate.getTime();
  return lots.reduce((sum, lot) => {
    const purchaseDate = new Date(lot.purchaseDate).getTime();
    if (Number.isNaN(purchaseDate) || purchaseDate > targetTime) return sum;
    const quantity = Number(lot.quantity) || 0;
    const unitCost = Number(lot.unitCost) || 0;
    const currentRemaining = Number(lot.remaining) || 0;
    const unitsSoldAfterDate = (lot.sales || []).reduce((salesSum, sale) => {
      const soldAt = new Date(sale.dateSold).getTime();
      if (!Number.isNaN(soldAt) && soldAt > targetTime) {
        return salesSum + (Number(sale.unitsSold) || 0);
      }
      return salesSum;
    }, 0);
    const remainingAtDate = Math.min(quantity, Math.max(0, currentRemaining + unitsSoldAfterDate));
    return sum + (remainingAtDate * unitCost);
  }, 0);
}

function calculateInventoryQtyAtDate(lots, atDate) {
  const targetTime = atDate.getTime();
  return lots.reduce((sum, lot) => {
    const purchaseDate = new Date(lot.purchaseDate).getTime();
    if (Number.isNaN(purchaseDate) || purchaseDate > targetTime) return sum;
    const quantity = Number(lot.quantity) || 0;
    const currentRemaining = Number(lot.remaining) || 0;
    const unitsSoldAfterDate = (lot.sales || []).reduce((salesSum, sale) => {
      const soldAt = new Date(sale.dateSold).getTime();
      if (!Number.isNaN(soldAt) && soldAt > targetTime) {
        return salesSum + (Number(sale.unitsSold) || 0);
      }
      return salesSum;
    }, 0);
    return sum + Math.min(quantity, Math.max(0, currentRemaining + unitsSoldAfterDate));
  }, 0);
}

function generateSegmentationLegendHTML(salesData, prevSalesData) {
  const currentStats = {};
  let totalRevenue = 0;

  salesData.forEach(({ sale }) => {
    if (!sale) return;
    const platform = (sale.platform || 'other').toLowerCase();
    if (!currentStats[platform]) currentStats[platform] = { count: 0, revenue: 0 };
    currentStats[platform].count++;
    const rev = Number(sale.totalPrice) || 0;
    currentStats[platform].revenue += rev;
    totalRevenue += rev;
  });

  const prevStats = {};
  if (prevSalesData) {
    prevSalesData.forEach(({ sale }) => {
      if (!sale) return;
      const platform = (sale.platform || 'other').toLowerCase();
      if (!prevStats[platform]) prevStats[platform] = { count: 0, revenue: 0 };
      prevStats[platform].count++;
      prevStats[platform].revenue += (Number(sale.totalPrice) || 0);
    });
  }

  const icons = {
    amazon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 21c-2.4 1.3-6.5 2-10 2-4.5 0-8.2-1.3-11-2.5l1-2.5c2.4 1.1 5.4 2 8.5 2 3.8 0 7.2-.6 9.5-1.5l2 2.5z"/></svg>`,
    shopify: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2 4 4l-1 5 13-1-1-6z"/><path d="M4 9 3 20l9 2 9-5V7Z"/></svg>`,
    facebook: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
    ebay: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    walmart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
    target: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    woot: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    bestbuy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    other: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
  };

  const getLabel = (p) => {
    const labels = {
      amazon: 'Amazon',
      ebay: 'eBay',
      facebook: 'Facebook',
      walmart: 'Walmart',
      target: 'Target',
      woot: 'Woot',
      bestbuy: 'Best Buy',
      shopify: 'Shopify',
      other: 'Other',
      unknown: 'Other'
    };
    return labels[p] || p.charAt(0).toUpperCase() + p.slice(1);
  };
  let sortedPlatforms = Object.keys(currentStats).sort((a, b) => currentStats[b].revenue - currentStats[a].revenue);

  if (sortedPlatforms.length === 0 || totalRevenue === 0) {
    return {
      totalSales: 0,
      channelRowsHTML: `<p class="seg-empty">No sales data yet.</p>`,
      chartStats: []
    };
  }

  // Consolidate beyond top 4 into "Other"
  const MAX_CHANNELS = 3;
  let displayPlatforms = sortedPlatforms;
  if (sortedPlatforms.length > MAX_CHANNELS) {
    const topPlatforms = sortedPlatforms.slice(0, MAX_CHANNELS);
    const otherPlatforms = sortedPlatforms.slice(MAX_CHANNELS);
    // Merge 'other' stats
    const otherStats = { count: 0, revenue: 0 };
    otherPlatforms.forEach(p => {
      otherStats.count += currentStats[p].count;
      otherStats.revenue += currentStats[p].revenue;
    });
    // If 'other' already exists in top 4, merge into it
    if (topPlatforms.includes('other')) {
      currentStats['other'].count += otherStats.count;
      currentStats['other'].revenue += otherStats.revenue;
    } else {
      currentStats['other'] = otherStats;
      topPlatforms.push('other');
    }
    // Merge prev stats for 'other' too
    const otherPrevRev = otherPlatforms.reduce((sum, p) => sum + (prevStats[p]?.revenue || 0), 0);
    if (!prevStats['other']) prevStats['other'] = { count: 0, revenue: 0 };
    prevStats['other'].revenue += otherPrevRev;
    displayPlatforms = topPlatforms;
  }

  const chartStats = displayPlatforms.map(p => ({
    platform: p,
    ...currentStats[p]
  }));

  const totalSales = displayPlatforms.reduce((sum, p) => sum + currentStats[p].count, 0);

  const channelRowsHTML = displayPlatforms.map((platform, index) => {
    const stats = currentStats[platform];
    const prevRev = prevStats[platform] ? prevStats[platform].revenue : 0;
    const realTrendObj = calculateTrend(stats.revenue, prevRev);

    const arrow = realTrendObj.direction === 'up' ? '↑' : realTrendObj.direction === 'down' ? '↓' : '';
    const trendCls = realTrendObj.direction === 'up' ? 'trend-up' : realTrendObj.direction === 'down' ? 'trend-down' : 'trend-neutral';
    const trendText = formatTrendPercent(realTrendObj.value);
    const arrowHtml = arrow ? ` ${arrow}` : '';

    return `
      <div class="seg-channel-row" data-chart-index="${index}">
        <span class="seg-channel-name">
          <span class="seg-channel-icon ${getSegPlatformClass(platform)}">${icons[platform] || icons.other}</span>
          ${getLabel(platform)}
        </span>
        <span class="seg-channel-number">${stats.count}</span>
        <span class="seg-channel-total ${trendCls}">${trendText}${arrowHtml}</span>
      </div>
    `;
  }).join('');

  return { totalSales, channelRowsHTML, chartStats };
}

function renderSegmentation(salesData, prevSalesData) {
  const { totalSales, channelRowsHTML, chartStats } = generateSegmentationLegendHTML(salesData, prevSalesData);
  const summary = getSegmentationSummary(chartStats, totalSales, selectedRange);

  return `
    <div class="segmentation-container">
      <div class="pie-container">
        <canvas id="segmentation-pie-chart" role="img" aria-label="${summary.ariaLabel}">${summary.text}</canvas>
        <div class="pie-center-text">
          <span class="pie-center-value">${totalSales.toLocaleString()}</span>
          <span class="pie-center-label">total sales</span>
        </div>
      </div>
      <div class="chart-summary compact" id="segmentation-summary">
        <div class="chart-summary-title" id="segmentation-summary-title">${summary.title}</div>
        <p class="chart-summary-text" id="segmentation-summary-text">${summary.text}</p>
      </div>
      <div class="seg-channels-header">
        <span>Channels</span>
        <span class="text-right">Units</span>
        <span class="text-right">Growth</span>
      </div>
      <div class="seg-channels" id="seg-channels-list">${channelRowsHTML}</div>
    </div>
  `;
}

function renderTopPerformersPanel(lots) {
  const topItems = lots
    .filter(lot => lot?.sales?.length > 0)
    .map(lot => ({
      name: lot.name,
      profit: getLotTotalProfit(lot),
      unitsSold: lot.sales.reduce((sum, sale) => sum + (Number(sale.unitsSold) || 0), 0),
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  const header = `
    <div class="section-header">
      <h3 class="section-title">Top Performers</h3>
    </div>`;

  if (topItems.length === 0) {
    return `${header}<p class="bottom-card-empty">No sold items yet.</p>`;
  }

  const podiumOrder = [topItems[1], topItems[0], topItems[2]].filter(Boolean);
  const rest = topItems.slice(3);

  const podiumHtml = podiumOrder.map(item => {
    const rank = topItems.indexOf(item) + 1;
    return `
      <div class="tp-pedestal tp-rank-${rank}">
        <div class="tp-pedestal-badge">${rank}</div>
        <div class="tp-pedestal-bar"></div>
        <span class="tp-pedestal-name">${item.name}</span>
        <span class="tp-pedestal-profit">${formatCurrency(item.profit, true)}</span>
        <span class="tp-pedestal-units">${item.unitsSold} sold</span>
      </div>
    `;
  }).join('');

  const restHtml = rest.map((item, idx) => `
    <div class="tp-compact-row">
      <span class="tp-compact-rank">${idx + 4}</span>
      <span class="tp-compact-name">${item.name}</span>
      <span class="tp-compact-units">${item.unitsSold} sold</span>
      <span class="tp-compact-profit positive">${formatCurrency(item.profit, true)}</span>
    </div>
  `).join('');

  return `
    ${header}
    <div class="tp-list">
      <div class="tp-podium">${podiumHtml}</div>
      ${rest.length > 0 ? `<div class="tp-compact-list">${restHtml}</div>` : ''}
    </div>
  `;
}

function renderChurningSnapshot(monthStats, overallStats) {
  const header = `
    <div class="section-header">
      <h3 class="section-title">Churning</h3>
    </div>`;

  if (overallStats.orderCount === 0) {
    return `${header}<p class="bottom-card-empty">No churning orders logged yet.</p>`;
  }

  return `
    ${header}
    <div class="desktop-churn-summary">
      <div class="desktop-churn-hero">
        <span class="desktop-churn-label">This Month</span>
        <div class="desktop-churn-value ${monthStats.totalProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(monthStats.totalProfit, true)}</div>
        <div class="desktop-churn-meta">${monthStats.orderCount} order${monthStats.orderCount === 1 ? '' : 's'} across this month.</div>
      </div>
      <div class="desktop-churn-grid">
        <div class="desktop-churn-cell">
          <span>Awaiting tracking</span>
          <strong>${overallStats.pendingTrackingCount}</strong>
        </div>
        <div class="desktop-churn-cell">
          <span>Awaiting payment</span>
          <strong>${overallStats.pendingPaymentCount}</strong>
        </div>
        <div class="desktop-churn-cell">
          <span>Tracking overdue</span>
          <strong>${overallStats.trackingOverdueCount}</strong>
        </div>
        <div class="desktop-churn-cell">
          <span>Cash tied up</span>
          <strong>${formatCurrency(overallStats.outstandingPurchaseVolume)}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderRecentSalesCard(sales, lots) {
  const header = `
    <div class="section-header">
      <h3 class="section-title">Recent Sales</h3>
      <button class="view-all-btn" id="view-all-sales-btn">View All</button>
    </div>`;

  if (sales.length === 0) {
    return `${header}<p class="bottom-card-empty">No sales yet.</p>`;
  }

  const rows = sales.map(({ lot, sale }) => {
    if (!sale) return '';
    const lotName = lot?.name || 'Unknown';
    let dateDisplay = '—';
    if (sale.dateSold && sale.dateSold !== 'Invalid Date') {
      try {
        const date = new Date(sale.dateSold);
        if (!isNaN(date.getTime())) {
          dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      } catch (e) { dateDisplay = '—'; }
    }
    const platform = sale.platform || 'unknown';
    const totalPrice = Number(sale.totalPrice) || 0;
    const profit = Number(sale.profit) || 0;
    return `
      <div class="rs-row">
        <span class="rs-date">${dateDisplay}</span>
        <span class="rs-name">${lotName}</span>
        ${renderPlatformBadge(platform)}
        <span class="rs-revenue">${formatCurrency(totalPrice)}</span>
        <span class="rs-profit ${profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(profit, true)}</span>
      </div>
    `;
  }).join('');

  return `${header}<div class="rs-list">${rows}</div>`;
}

function calculateTrend(current, previous) {
  if (previous === 0) {
    return current > 0 ? { direction: 'up', value: '∞' } : { direction: 'neutral', value: '0' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { direction: 'up', value: Math.abs(pct) };
  if (pct < 0) return { direction: 'down', value: Math.abs(pct) };
  return { direction: 'neutral', value: '0' };
}

function renderInfinityPercent() {
  return '<span class="infinity-glyph">∞</span>&thinsp;%';
}

function formatTrendPercent(value) {
  return value === 'âˆž' || value === '∞' ? renderInfinityPercent() : `${value}%`;
}

function getSegPlatformClass(platform) {
  const supportedPlatforms = new Set(['amazon', 'shopify', 'facebook', 'ebay', 'whatnot']);
  return supportedPlatforms.has(platform) ? `platform-${platform}` : 'platform-other';
}

function setSegmentationActiveRow(index = null) {
  document.querySelectorAll('.seg-channel-row').forEach(row => {
    const rowIndex = Number(row.dataset.chartIndex);
    row.classList.toggle('is-active', index !== null && rowIndex === index);
  });
}

function initDesktopRevenueChart() {
  const canvas = document.getElementById('desktop-revenue-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const { salesData, prevSalesData } = getDashboardRangeData(selectedRange);

  desktopChartData = aggregateSalesByDay(salesData, selectedRange);
  const chartBuckets = aggregateSalesForChart(salesData, selectedRange);
  const { labels, revenues } = chartBuckets;
  const dynamicValEl = document.getElementById('revenue-dynamic-value');
  const dynamicTrendEl = document.getElementById('revenue-dynamic-trend');
  const summaryTitleEl = document.getElementById('desktop-revenue-summary-title');
  const summaryTextEl = document.getElementById('desktop-revenue-summary-text');
  const revenueSummary = getDesktopRevenueSummary(salesData, prevSalesData, selectedRange);
  const totalRevenueRange = salesData.reduce((sum, { sale }) => sum + (Number(sale.totalPrice) || 0), 0);

  if (summaryTitleEl) summaryTitleEl.textContent = revenueSummary.title;
  if (summaryTextEl) summaryTextEl.textContent = revenueSummary.text;
  canvas.setAttribute('aria-label', revenueSummary.ariaLabel);

  if (dynamicValEl) {
    dynamicValEl.textContent = '$' + (totalRevenueRange / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Calculate and exact inject trend string using KPI pill format logic
    if (dynamicTrendEl) {
      const prevTotalRevenue = prevSalesData.reduce((sum, { sale }) => sum + (Number(sale.totalPrice) || 0), 0);
      const trendData = calculateTrend(totalRevenueRange, prevTotalRevenue);

      const arrow = trendData.direction === 'up' ? '↑' : trendData.direction === 'down' ? '↓' : '';
      const cls = trendData.direction === 'up' ? 'trend-up' : trendData.direction === 'down' ? 'trend-down' : 'trend-neutral';
      const arrowHtml = arrow ? ` ${arrow}` : '';

      const periodLabel = selectedRange === '7d' ? 'Last 7D' : selectedRange === '30d' ? 'Last 30D' : selectedRange === '90d' ? 'Last 90D' : 'Previous Year';

      const valHtml = formatTrendPercent(trendData.value);

      dynamicTrendEl.innerHTML = `<span class="${cls}">${valHtml}${arrowHtml}</span> vs ${periodLabel}`;
    }
  }

  if (!labels?.length || !revenues?.length) return;

  const maxRevenue = Math.max(...revenues);
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.15) : 100;

  if (desktopChartInstance) desktopChartInstance.destroy();

  const ctx = canvas.getContext('2d');
  const axisTicks = getCssVar('--chart-axis-text', 'rgba(234, 230, 224, 0.55)');
  const axisGrid = getCssVar('--chart-grid-line', 'rgba(234, 230, 224, 0.08)');

  // Use solid color strings (not CanvasGradient) so Chart.js can smoothly interpolate during fade transitions
  const barColors = revenues.map(v => v > 0 ? 'rgba(35, 184, 165, 0.88)' : 'rgba(255,255,255,0.04)');
  const barHoverColors = revenues.map(v => v > 0 ? 'rgba(74, 204, 184, 0.94)' : 'rgba(255,255,255,0.06)');

  // Create faded colors for when a different bar is hovered
  const barFadedColors = revenues.map(v => v > 0 ? 'rgba(35, 184, 165, 0.22)' : 'rgba(255,255,255,0.02)');

  if (selectedBarIndex === null || selectedBarIndex >= labels.length) {
    selectedBarIndex = labels.length - 1;
  }

  const barCount = labels.length;
  // Bklit rounded line caps are uniform.
  const radius = barCount <= 5 ? 14 : barCount <= 8 ? 11 : barCount <= 15 ? 9 : 7;

  const crosshairPlugin = {
    id: 'bklitCrosshair',
    afterDraw: (chart) => {
      if (chart.tooltip?._active && chart.tooltip._active.length) {
        const activePoint = chart.tooltip._active[0];
        const ctx = chart.ctx;
        const x = activePoint.element.x;
        const topY = chart.scales.y.top;
        const bottomY = chart.scales.y.bottom;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const externalTooltipHandler = (context) => {
    const { chart, tooltip } = context;
    let tooltipEl = chart.canvas.parentNode.querySelector('div.bklit-custom-tooltip');

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.classList.add('bklit-custom-tooltip');
      chart.canvas.parentNode.appendChild(tooltipEl);
    }

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    if (tooltip.body) {
      const dataPoint = tooltip.dataPoints[0];
      const dateLabel = chart.data.labels[dataPoint.dataIndex];
      const val = '$' + dataPoint.raw.toLocaleString('en-US');

      tooltipEl.innerHTML = `
        <div class="chart-tooltip-date">${dateLabel}</div>
        <div class="chart-tooltip-row">
          <div class="chart-tooltip-series">
            <div class="chart-tooltip-dot"></div>
            <span class="chart-tooltip-label">revenue</span>
          </div>
          <span class="chart-tooltip-amount">${val}</span>
        </div>
      `;
    }

    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = tooltip.caretX + 'px';
    tooltipEl.style.top = tooltip.caretY + 'px';
  };

  // Create the HTML-based X-axis pill element for smooth animated transitions
  let xAxisPill = canvas.parentNode.querySelector('.bklit-xaxis-pill');
  if (!xAxisPill) {
    xAxisPill = document.createElement('div');
    xAxisPill.classList.add('bklit-xaxis-pill');
    canvas.parentNode.appendChild(xAxisPill);
  }

  desktopChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue', // Restoring the label so Chart.js has an internal reference
        data: revenues,
        backgroundColor: barColors,
        hoverBackgroundColor: barHoverColors,
        borderColor: 'transparent',
        borderWidth: 0,
        minBarLength: 10,
        borderRadius: radius,
        borderSkipped: false,
        barPercentage: 0.85,
        categoryPercentage: 0.9,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0, // Disable the generic animation
      },
      animations: {
        y: {
          easing: 'easeOutQuart',
          duration: 1200,
          from: (ctx) => {
            if (ctx.type === 'data' && ctx.mode === 'default' && ctx.chart.scales?.y) {
              return ctx.chart.scales.y.getPixelForValue(0);
            }
          },
          delay: (ctx) => {
            if (ctx.type === 'data' && ctx.mode === 'default') {
              const stagger = 1200 / barCount / 2;
              return ctx.dataIndex * stagger;
            }
            return 0;
          }
        }
      },
      transitions: {
        fade: {
          animation: {
            duration: 500,
            easing: 'easeOutQuart'
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
      onHover: (e, elements) => {
        if (desktopChartInstance) {
          if (elements.length > 0) {
            const hoveredIndex = elements[0].index;
            if (desktopChartInstance.lastHoveredIndex !== hoveredIndex) {
              desktopChartInstance.lastHoveredIndex = hoveredIndex;
              desktopChartInstance.data.datasets[0].backgroundColor = barColors.map((color, i) => i === hoveredIndex ? barHoverColors[i] : barFadedColors[i]);
              desktopChartInstance.update('fade');

              // Position the HTML X-axis pill over the active tick
              const xScale = desktopChartInstance.scales.x;
              const tickX = xScale.getPixelForValue(hoveredIndex);
              const label = desktopChartInstance.data.labels[hoveredIndex];
              xAxisPill.textContent = label;
              xAxisPill.style.left = tickX + 'px';
              xAxisPill.style.opacity = '1';
              xAxisPill.style.transform = 'translateX(-50%) translateY(0px)';
            }
          } else {
            if (desktopChartInstance.lastHoveredIndex !== null) {
              desktopChartInstance.lastHoveredIndex = null;
              desktopChartInstance.data.datasets[0].backgroundColor = barColors;
              desktopChartInstance.setActiveElements([]);
              desktopChartInstance.update('fade');

              const tEl = desktopChartInstance.canvas.parentNode.querySelector('div.bklit-custom-tooltip');
              if (tEl) tEl.style.opacity = '0';
              xAxisPill.style.opacity = '0';
              xAxisPill.style.transform = 'translateX(-50%) translateY(4px)';
            }
          }
        }
      },
      onLeave: (e) => {
        if (desktopChartInstance && desktopChartInstance.lastHoveredIndex !== null) {
          desktopChartInstance.lastHoveredIndex = null;
          desktopChartInstance.data.datasets[0].backgroundColor = barColors;
          desktopChartInstance.setActiveElements([]);
          desktopChartInstance.update('fade');

          const tEl = desktopChartInstance.canvas.parentNode.querySelector('div.bklit-custom-tooltip');
          if (tEl) tEl.style.opacity = '0';
          xAxisPill.style.opacity = '0';
          xAxisPill.style.transform = 'translateX(-50%) translateY(4px)';
        }
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          // Disable native tooltip completely and hook custom HTML renderer
          enabled: false,
          external: externalTooltipHandler
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: (context) => {
              // Hide the original text specifically when hovered so it doesn't bleed under the white pill
              if (desktopChartInstance && desktopChartInstance.lastHoveredIndex === context.index) return 'transparent';
              return axisTicks;
            },
            font: { size: 10, weight: '500' },
            maxRotation: 0,
            autoSkip: false,
            maxTicksLimit: 15,
            padding: 10
          },
          border: { display: false }
        },
        y: {
          display: true,
          border: { display: false },
          ticks: { display: false },
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.08)',
            drawTicks: false,
            tickLength: 0,
            lineWidth: 1,
            borderDash: [4, 4],
          }
        }
      }
    },
    // Global plugin array for crosshair
    plugins: [crosshairPlugin]
  });

  // Native boundary override to strictly catch rapid mouse-exits that drop frames in Chart.js
  canvas.addEventListener('mouseleave', () => {
    if (desktopChartInstance && desktopChartInstance.lastHoveredIndex !== null) {
      desktopChartInstance.lastHoveredIndex = null;
      desktopChartInstance.data.datasets[0].backgroundColor = barColors;
      desktopChartInstance.setActiveElements([]);
      desktopChartInstance.update('fade');

      const tEl = desktopChartInstance.canvas.parentNode.querySelector('div.bklit-custom-tooltip');
      if (tEl) tEl.style.opacity = '0';
      xAxisPill.style.opacity = '0';
      xAxisPill.style.transform = 'translateX(-50%) translateY(4px)';
    }
  });
}

function attachLegendHoverEvents(chartInstance, counts, labels, bgColors, totalSales) {
  const pieCenterValEl = document.querySelector('.pie-center-value');
  const pieCenterLabelEl = document.querySelector('.pie-center-label');

  document.querySelectorAll('.seg-channel-row').forEach(row => {
    // Clone node to safely remove old event listeners when updating
    const newRow = row.cloneNode(true);
    row.parentNode.replaceChild(newRow, row);

    newRow.addEventListener('mouseenter', () => {
      const index = parseInt(newRow.dataset.chartIndex, 10);
      if (!isNaN(index) && chartInstance) {
        chartInstance.data.datasets[0].backgroundColor = bgColors.map((color, i) => i === index ? color : (color.length === 7 ? color + '4D' : color));
        chartInstance.setActiveElements([{ datasetIndex: 0, index }]);
        chartInstance.update();
        setSegmentationActiveRow(index);

        if (pieCenterValEl && pieCenterLabelEl) {
          const targetCount = counts[index];
          if (currentCenterVal !== targetCount) {
            animateValue(pieCenterValEl, currentCenterVal, targetCount, 300);
            pieCenterLabelEl.textContent = labels[index];
          }
        }
      }
    });

    newRow.addEventListener('mouseleave', () => {
      if (chartInstance) {
        chartInstance.data.datasets[0].backgroundColor = bgColors;
        chartInstance.setActiveElements([]);
        chartInstance.update();
      }
      setSegmentationActiveRow();

      if (pieCenterValEl && pieCenterLabelEl && currentCenterVal !== totalSales) {
        animateValue(pieCenterValEl, currentCenterVal, totalSales, 300);
        pieCenterLabelEl.textContent = 'total sales';
      }
    });
  });
}

function initSegmentationChart(salesData, prevSalesData) {
  const canvas = document.getElementById('segmentation-pie-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const { totalSales, channelRowsHTML, chartStats } = generateSegmentationLegendHTML(salesData, prevSalesData);
  const summary = getSegmentationSummary(chartStats, totalSales, selectedRange);

  const segListEl = document.getElementById('seg-channels-list');
  if (segListEl && segmentationChartInstance) {
    segListEl.innerHTML = channelRowsHTML; // Inject dynamically if it exists
  }
  const segSummaryTitleEl = document.getElementById('segmentation-summary-title');
  const segSummaryTextEl = document.getElementById('segmentation-summary-text');
  if (segSummaryTitleEl) segSummaryTitleEl.textContent = summary.title;
  if (segSummaryTextEl) segSummaryTextEl.textContent = summary.text;
  canvas.setAttribute('aria-label', summary.ariaLabel);

  currentCenterVal = totalSales;
  const pieCenterValEl = document.querySelector('.pie-center-value');
  const pieCenterLabelEl = document.querySelector('.pie-center-label');

  if (pieCenterValEl) pieCenterValEl.textContent = totalSales.toLocaleString();
  if (pieCenterLabelEl) pieCenterLabelEl.textContent = 'total sales';

  const labels = chartStats.map(s => s.platform.charAt(0).toUpperCase() + s.platform.slice(1));
  const data = chartStats.map(s => s.revenue);
  const counts = chartStats.map(s => s.count);
  const colors = { amazon: '#d9a441', shopify: '#4fb89b', facebook: '#7c8fce', ebay: '#ce7562', whatnot: '#d8894d', other: '#6d6d73' };
  const bgColors = chartStats.map(s => colors[s.platform] || colors.other);

  if (segmentationChartInstance) {
    segmentationChartInstance.data.labels = labels;
    segmentationChartInstance.data.datasets[0].data = data;
    segmentationChartInstance.data.datasets[0].backgroundColor = bgColors;

    segmentationChartInstance.options.onHover = (event, activeElements) => {
      setSegmentationActiveRow();
      if (activeElements.length > 0) {
        const index = activeElements[0].index;
        setSegmentationActiveRow(index);

        segmentationChartInstance.data.datasets[0].backgroundColor = bgColors.map((color, i) => i === index ? color : (color.length === 7 ? color + '4D' : color));
        segmentationChartInstance.update();

        if (pieCenterValEl && pieCenterLabelEl) {
          const targetCount = counts[index];
          if (currentCenterVal !== targetCount) {
            animateValue(pieCenterValEl, currentCenterVal, targetCount, 300);
            pieCenterLabelEl.textContent = labels[index];
          }
        }
      } else {
        segmentationChartInstance.data.datasets[0].backgroundColor = bgColors;
        segmentationChartInstance.update();

        if (pieCenterValEl && pieCenterLabelEl && currentCenterVal !== totalSales) {
          animateValue(pieCenterValEl, currentCenterVal, totalSales, 300);
          pieCenterLabelEl.textContent = 'total sales';
        }
      }
    };

    segmentationChartInstance.update();
    attachLegendHoverEvents(segmentationChartInstance, counts, labels, bgColors, totalSales);
    return;
  }

  const ctx = canvas.getContext('2d');
  segmentationChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 16
      }]
    },
    options: {
      animation: {
        animateScale: false,
        animateRotate: true,
        duration: 1000,
        easing: 'easeOutExpo'
      },
      transitions: {
        active: {
          animation: {
            duration: 250,
            easing: 'easeOutBack'
          }
        }
      },
      cutout: '55%',
      layout: {
        padding: 16
      },
      responsive: true,
      onHover: (event, activeElements) => {
        setSegmentationActiveRow();
        if (activeElements.length > 0) {
          const index = activeElements[0].index;
          setSegmentationActiveRow(index);

          segmentationChartInstance.data.datasets[0].backgroundColor = bgColors.map((color, i) => i === index ? color : (color.length === 7 ? color + '4D' : color));
          segmentationChartInstance.update();

          if (pieCenterValEl && pieCenterLabelEl) {
            const targetCount = counts[index];
            if (currentCenterVal !== targetCount) {
              animateValue(pieCenterValEl, currentCenterVal, targetCount, 300);
              pieCenterLabelEl.textContent = labels[index];
            }
          }
        } else {
          segmentationChartInstance.data.datasets[0].backgroundColor = bgColors;
          segmentationChartInstance.update();

          if (pieCenterValEl && pieCenterLabelEl && currentCenterVal !== totalSales) {
            animateValue(pieCenterValEl, currentCenterVal, totalSales, 300);
            pieCenterLabelEl.textContent = 'total sales';
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });

  attachLegendHoverEvents(segmentationChartInstance, counts, labels, bgColors, totalSales);
}

export function initDesktopDashboardEvents(isInitialLoad = false) {
  // If this is the initial login load, wait for the app preloader to fully clear (~1000ms) + a small buffer
  const initialDelay = isInitialLoad ? 1200 : 0;

  setTimeout(() => {
    initDesktopRevenueChart();
    updateSegmentationByRange();
  }, initialDelay);

  // Helper function to easily grab identical time range for segmentation 
  function updateSegmentationByRange() {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let salesDataSegment;
    let prevSalesDataSegment;

    if (selectedRange === 'all') {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 364);
      startDate.setHours(0, 0, 0, 0);
      salesDataSegment = getSalesByDateRange(startDate, now);

      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - 365);
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      prevSalesDataSegment = getSalesByDateRange(prevStart, prevEnd);
    } else {
      const startDate = new Date(now);
      const days = selectedRange === '7d' ? 6 : selectedRange === '90d' ? 89 : 29;
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      salesDataSegment = getSalesByDateRange(startDate, now);

      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - (days + 1));
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
      prevSalesDataSegment = getSalesByDateRange(prevStartDate, prevEndDate);
    }
    initSegmentationChart(salesDataSegment, prevSalesDataSegment);
  }

  document.querySelectorAll('.filter-btn[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRange = btn.dataset.range;
      localStorage.setItem('dashboardCurrentRange', selectedRange);
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedBarIndex = null; // Reset to latest for new range
      initDesktopRevenueChart();
      updateSegmentationByRange();
    });
  });

  const viewAllBtn = document.getElementById('view-all-sales-btn');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => navigate('/sales'));
  }
}
