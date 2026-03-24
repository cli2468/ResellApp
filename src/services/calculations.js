// Calculations Service - Financial calculations and aggregations

/**
 * Platform fee rates
 */
export const PLATFORM_FEES = {
  facebook: { name: 'Facebook', rate: 0, label: '0% fees' },
  ebay: { name: 'eBay', rate: 0.135, label: '13.5% fees' }
};

/**
 * Calculate fees for a sale
 * @param {number} priceInCents - Sale price in cents
 * @param {string} platform - 'facebook' or 'ebay'
 * @returns {number} Fee amount in cents
 */
export function calculateFees(priceInCents, platform) {
    const rate = PLATFORM_FEES[platform]?.rate || 0;
    return Math.round(priceInCents * rate);
}

/**
 * Calculate profit for a partial lot sale
 * @param {number} unitCostCents - Cost per unit in cents
 * @param {number} unitsSold - Number of units being sold
 * @param {number} pricePerUnitCents - Sale price per unit in cents
 * @param {string} platform - 'facebook' or 'ebay'
 * @param {number} shippingCostCents - Shipping cost in cents (for eBay)
 * @returns {Object} { costBasis, totalSalePrice, fees, shippingCost, profit } in cents
 */
export function calculateSaleProfit(unitCostCents, unitsSold, pricePerUnitCents, platform, shippingCostCents = 0) {
    // Explicit type casting with defaults
    const unitCost = Number(unitCostCents) || 0;
    const qty = Number(unitsSold) || 0;
    const pricePerUnit = Number(pricePerUnitCents) || 0;
    const shipping = Number(shippingCostCents) || 0;
    
    const costBasis = unitCost * qty;
    const totalSalePrice = pricePerUnit * qty;
    const fees = calculateFees(totalSalePrice, platform);
    const profit = totalSalePrice - costBasis - fees - shipping;

    return { costBasis, totalSalePrice, fees, shippingCost: shipping, profit };
}


/**
 * Calculate monthly stats from sales
 * @param {Array} salesData - Array of { lot, sale } objects
 * @returns {Object} Monthly statistics including returned sales
 */
export function calculateMonthlyStats(salesData) {
    const stats = {
        totalRevenue: 0,
        totalCosts: 0,
        totalFees: 0,
        totalProfit: 0,
        unitsSold: 0,
        transactionCount: 0,
        totalSales: 0,
        avgProfitPerUnit: 0,
        // Returned/refunded tracking
        totalReturned: 0,
        returnedCount: 0,
        returnedRevenue: 0
    };

    if (!Array.isArray(salesData)) return stats;

    for (const { sale } of salesData) {
        // Defensive: skip invalid sales
        if (!sale) continue;
        
        // Ensure numeric values
        const totalPrice = Number(sale.totalPrice) || 0;
        const costBasis = Number(sale.costBasis) || 0;
        const fees = Number(sale.fees) || 0;
        const profit = Number(sale.profit) || 0;
        const units = Number(sale.unitsSold) || 0;
        
        if (sale.returned) {
            // Track returned sales separately
            stats.totalReturned += profit;
            stats.returnedCount++;
            stats.returnedRevenue += totalPrice;
            continue;
        }
        
        stats.totalRevenue += totalPrice;
        stats.totalCosts += costBasis;
        stats.totalFees += fees;
        stats.totalProfit += profit;
        stats.unitsSold += units;
        stats.transactionCount++;
    }
    
    stats.totalSales = stats.transactionCount;

    stats.avgProfitPerUnit = stats.unitsSold > 0
        ? Math.round(stats.totalProfit / stats.unitsSold)
        : 0;

    return stats;
}

/**
 * Format cents to dollar string
 * @param {number} cents - Amount in cents
 * @param {boolean} showSign - Whether to show +/- sign
 * @returns {string} Formatted dollar amount
 */
export function formatCurrency(cents, showSign = false) {
    // Defensive: handle NaN, undefined, null, or non-numeric values
    const value = Number(cents);
    if (isNaN(value) || cents === undefined || cents === null) {
        return '—';
    }
    
    const dollars = value / 100;
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(Math.abs(dollars));

    if (showSign && value !== 0) {
        return value > 0 ? `+${formatted}` : `-${formatted}`;
    }

    return value < 0 ? `-${formatted}` : formatted;
}

/**
 * Format a date for display
 * @param {string} isoDate - ISO date string
 * @param {string} format - 'short', 'long', or 'relative'
 * @returns {string} Formatted date
 */
export function formatDate(isoDate, format = 'short') {
    // Defensive: handle invalid or missing dates
    if (!isoDate || isoDate === 'Invalid Date') {
        return '—';
    }
    
    const date = new Date(isoDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '—';
    }

    if (format === 'relative') {
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (format === 'long') {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get month name
 * @param {number} month - Month index (0-11)
 * @returns {string} Month name
 */
export function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
}

/**
 * Calculate ROI percentage
 * @param {number} costInCents - Cost in cents
 * @param {number} profitInCents - Profit in cents
 * @returns {number} ROI percentage
 */
export function calculateROI(costInCents, profitInCents) {
    if (costInCents === 0) return 0;
    return Math.round((profitInCents / costInCents) * 100);
}

/**
 * Calculate cashback earned on a purchase amount.
 * @param {number} purchaseAmountCents - Purchase amount in cents
 * @param {number} cashbackRate - Cashback rate as a whole-number percent (e.g. 5 for 5%)
 * @returns {number} Cashback amount in cents
 */
export function calculateCashbackValue(purchaseAmountCents, cashbackRate = 0) {
    const purchaseAmount = Number(purchaseAmountCents) || 0;
    const rate = Number(cashbackRate) || 0;
    return Math.round(purchaseAmount * (rate / 100));
}

/**
 * Calculate churning profit from reimbursement delta plus cashback.
 * @param {number} purchaseAmountCents - Purchase amount in cents
 * @param {number} reimbursementAmountCents - Reimbursement amount in cents
 * @param {number} cashbackRate - Cashback rate as a whole-number percent
 * @returns {number} Profit in cents
 */
export function calculateChurningProfit(purchaseAmountCents, reimbursementAmountCents, cashbackRate = 0) {
    const purchaseAmount = Number(purchaseAmountCents) || 0;
    const reimbursementAmount = Number(reimbursementAmountCents) || 0;
    const cashbackAmount = calculateCashbackValue(purchaseAmount, cashbackRate);

    return reimbursementAmount - purchaseAmount + cashbackAmount;
}

function parseLocalDate(dateValue) {
    if (!dateValue) return null;

    const normalized = typeof dateValue === 'string' && !dateValue.includes('T')
        ? `${dateValue}T12:00:00`
        : dateValue;

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Determine whether an order has missed the 3-day tracking upload window.
 * @param {Object} order - Churning order
 * @param {number} graceDays - Allowed days before flagging
 * @returns {boolean}
 */
export function isChurningTrackingOverdue(order, graceDays = 3) {
    if (!order || order.trackingUploaded) return false;

    const purchaseDate = parseLocalDate(order.purchaseDate);
    if (!purchaseDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    purchaseDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > graceDays;
}

/**
 * Filter churning orders to the month of the provided date.
 * @param {Array} orders - Churning orders
 * @param {Date} targetDate - Reference date
 * @returns {Array}
 */
export function getChurningOrdersForMonth(orders, targetDate = new Date()) {
    if (!Array.isArray(orders)) return [];

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    return orders.filter((order) => {
        const purchaseDate = parseLocalDate(order?.purchaseDate);
        return purchaseDate
            && purchaseDate.getFullYear() === year
            && purchaseDate.getMonth() === month;
    });
}

/**
 * Aggregate churning orders into summary statistics.
 * @param {Array} orders - Churning orders
 * @returns {Object}
 */
export function calculateChurningStats(orders) {
    const stats = {
        orderCount: 0,
        totalPurchaseVolume: 0,
        totalReimbursement: 0,
        totalCashback: 0,
        totalProfit: 0,
        pendingTrackingCount: 0,
        trackingOverdueCount: 0,
        deliveredCount: 0,
        paidCount: 0,
        pendingPaymentCount: 0,
        outstandingPurchaseVolume: 0
    };

    if (!Array.isArray(orders)) return stats;

    orders.forEach((order) => {
        if (!order) return;

        const purchaseAmount = Number(order.purchaseAmount) || 0;
        const reimbursementAmount = Number(order.reimbursementAmount) || 0;
        const cashbackAmount = Number.isFinite(Number(order.cashbackAmount))
            ? Number(order.cashbackAmount)
            : calculateCashbackValue(purchaseAmount, order.cashbackRate);
        const profit = Number.isFinite(Number(order.profit))
            ? Number(order.profit)
            : calculateChurningProfit(purchaseAmount, reimbursementAmount, order.cashbackRate);

        stats.orderCount += 1;
        stats.totalPurchaseVolume += purchaseAmount;
        stats.totalReimbursement += reimbursementAmount;
        stats.totalCashback += cashbackAmount;
        stats.totalProfit += profit;

        if (!order.trackingUploaded) {
            stats.pendingTrackingCount += 1;
        }

        if (isChurningTrackingOverdue(order)) {
            stats.trackingOverdueCount += 1;
        }

        if (order.delivered) {
            stats.deliveredCount += 1;
        }

        if (order.paid) {
            stats.paidCount += 1;
        } else {
            stats.pendingPaymentCount += 1;
            stats.outstandingPurchaseVolume += purchaseAmount;
        }
    });

    return stats;
}
