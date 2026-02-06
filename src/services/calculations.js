// Calculations Service - Financial calculations and aggregations

/**
 * Platform fee rates
 */
export const PLATFORM_FEES = {
    facebook: { name: 'Facebook Marketplace', rate: 0, label: '0% fees' },
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
    const costBasis = unitCostCents * unitsSold;
    const totalSalePrice = pricePerUnitCents * unitsSold;
    const fees = calculateFees(totalSalePrice, platform);
    const profit = totalSalePrice - costBasis - fees - shippingCostCents;

    return { costBasis, totalSalePrice, fees, shippingCost: shippingCostCents, profit };
}


/**
 * Calculate monthly stats from sales
 * @param {Array} salesData - Array of { lot, sale } objects
 * @returns {Object} Monthly statistics
 */
export function calculateMonthlyStats(salesData) {
    const stats = {
        totalRevenue: 0,
        totalCosts: 0,
        totalFees: 0,
        totalProfit: 0,
        unitsSold: 0,
        transactionCount: 0,
        avgProfitPerUnit: 0
    };

    for (const { sale } of salesData) {
        stats.totalRevenue += sale.totalPrice;
        stats.totalCosts += sale.costBasis;
        stats.totalFees += sale.fees;
        stats.totalProfit += sale.profit;
        stats.unitsSold += sale.unitsSold;
        stats.transactionCount++;
    }

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
    const dollars = cents / 100;
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(Math.abs(dollars));

    if (showSign && cents !== 0) {
        return cents > 0 ? `+${formatted}` : `-${formatted}`;
    }

    return cents < 0 ? `-${formatted}` : formatted;
}

/**
 * Format a date for display
 * @param {string} isoDate - ISO date string
 * @param {string} format - 'short', 'long', or 'relative'
 * @returns {string} Formatted date
 */
export function formatDate(isoDate, format = 'short') {
    const date = new Date(isoDate);

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
