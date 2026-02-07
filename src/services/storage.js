// Storage Service - localStorage wrapper with data persistence

const STORAGE_KEY = 'reselltracker_data';
const STORAGE_VERSION = 2; // Bumped for per-unit cost changes

import { saveLotToCloud, deleteLotFromCloud } from './firebaseSync.js';
import { auth } from './firebase.js';

/**
 * Get the current storage data structure
 */
function getStorageData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { version: STORAGE_VERSION, lots: [] };
        }
        const data = JSON.parse(raw);
        // Migration from v1 to v2: add unitCost and remaining
        if (data.version < 2) {
            data.lots = data.lots.map(lot => ({
                ...lot,
                unitCost: lot.unitCost || lot.cost, // v1 stored total cost as 'cost'
                totalCost: lot.cost,
                remaining: lot.sale ? 0 : (lot.quantity || 1),
                sales: lot.sale ? [{
                    ...lot.sale,
                    unitsSold: lot.quantity || 1
                }] : []
            }));
            data.version = 2;
            saveStorageData(data);
        }
        return data;
    } catch (e) {
        console.error('Failed to read storage:', e);
        return { version: STORAGE_VERSION, lots: [] };
    }
}

/**
 * Save the entire storage data structure
 */
function saveStorageData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Failed to save storage:', e);
        return false;
    }
}

/**
 * Generate a unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all lots
 * @returns {Array} Array of lot objects
 */
export function getLots() {
    return getStorageData().lots;
}

/**
 * Overwrite all lots (used for cloud sync)
 * @param {Array} lots - New array of lots
 */
export function setLots(lots) {
    const data = getStorageData();
    data.lots = lots;
    saveStorageData(data);
}

/**
 * Get a single lot by ID
 * @param {string} id - Lot ID
 * @returns {Object|null} Lot object or null
 */
export function getLotById(id) {
    const lots = getLots();
    return lots.find(lot => lot.id === id) || null;
}

/**
 * Save a new lot
 * @param {Object} lotData - Lot data (name, cost, quantity, imageData)
 * @returns {Object} The created lot with ID and timestamps
 */
export function saveLot(lotData) {
    const data = getStorageData();
    const quantity = lotData.quantity || 1;
    const totalCostCents = Math.round(lotData.cost * 100);
    const unitCostCents = Math.round(totalCostCents / quantity);

    const newLot = {
        id: generateId(),
        name: lotData.name || 'Unnamed Item',
        totalCost: totalCostCents,
        unitCost: unitCostCents,
        quantity: quantity,
        remaining: quantity,
        dateAdded: new Date().toISOString(),
        purchaseDate: lotData.purchaseDate || new Date().toISOString().split('T')[0],
        imageData: lotData.imageData || null,
        sales: [],
        returnDismissed: false
    };

    data.lots.unshift(newLot);
    saveStorageData(data);

    // Cloud sync
    if (auth.currentUser) {
        saveLotToCloud(newLot);
    }

    return newLot;
}

/**
 * Update an existing lot
 * @param {string} id - Lot ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated lot or null if not found
 */
export function updateLot(id, updates) {
    const data = getStorageData();
    const index = data.lots.findIndex(lot => lot.id === id);

    if (index === -1) return null;

    data.lots[index] = { ...data.lots[index], ...updates };
    saveStorageData(data);

    // Cloud sync
    if (auth.currentUser) {
        saveLotToCloud(data.lots[index]);
    }

    return data.lots[index];
}

/**
 * Record a sale for a lot (partial or full)
 * @param {string} id - Lot ID
 * @param {number} pricePerUnit - Sale price per unit in dollars
 * @param {number} unitsSold - Number of units being sold
 * @param {string} platform - 'facebook' or 'ebay'
 * @param {number} shippingCost - Shipping cost in dollars (for eBay)
 * @param {string} saleDateStr - Optional sale date in YYYY-MM-DD format
 * @returns {Object|null} Updated lot or null if not found
 */
export function recordSale(id, pricePerUnit, unitsSold, platform, shippingCost = 0, saleDateStr = null) {
    const lot = getLotById(id);
    if (!lot) return null;
    if (unitsSold > lot.remaining) return null;

    const pricePerUnitCents = Math.round(pricePerUnit * 100);
    const totalSalePrice = pricePerUnitCents * unitsSold;
    const feeRate = platform === 'ebay' ? 0.135 : 0;
    const fees = Math.round(totalSalePrice * feeRate);
    const shippingCostCents = Math.round(shippingCost * 100);
    const costBasis = lot.unitCost * unitsSold;
    const profit = totalSalePrice - costBasis - fees - shippingCostCents;

    const saleRecord = {
        id: generateId(),
        unitsSold,
        pricePerUnit: pricePerUnitCents,
        totalPrice: totalSalePrice,
        platform,
        fees,
        shippingCost: shippingCostCents,
        costBasis,
        profit,
        dateSold: saleDateStr ? new Date(saleDateStr + 'T12:00:00').toISOString() : new Date().toISOString()
    };

    const updatedSales = [...(lot.sales || []), saleRecord];
    const updatedRemaining = lot.remaining - unitsSold;

    return updateLot(id, {
        sales: updatedSales,
        remaining: updatedRemaining
    });
}


/**
 * Delete a specific sale from a lot
 * @param {string} lotId - Lot ID
 * @param {string} saleId - Sale record ID
 * @returns {Object|null} Updated lot or null
 */
export function deleteSale(lotId, saleId) {
    const data = getStorageData();
    const lotIndex = data.lots.findIndex(l => l.id === lotId);

    if (lotIndex === -1) return null;
    const lot = data.lots[lotIndex];

    const saleIndex = lot.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return null;

    const sale = lot.sales[saleIndex];

    // Data corruption check: remaining + restored units shouldn't exceed original quantity
    if (lot.remaining + sale.unitsSold > lot.quantity) {
        console.error('Corruption check failed: Deleting this sale would exceed original quantity');
        return null;
    }

    const updatedRemaining = lot.remaining + sale.unitsSold;
    const updatedSales = lot.sales.filter(s => s.id !== saleId);

    return updateLot(lotId, {
        remaining: updatedRemaining,
        sales: updatedSales
    });
}

/**
 * Update a specific sale record
 * @param {string} lotId - Lot ID
 * @param {string} saleId - Sale record ID
 * @param {Object} updates - Fields to update (e.g., { dateSold })
 * @returns {Object|null} Updated lot or null
 */
export function updateSale(lotId, saleId, updates) {
    const data = getStorageData();
    const lotIndex = data.lots.findIndex(l => l.id === lotId);

    if (lotIndex === -1) return null;
    const lot = data.lots[lotIndex];

    const saleIndex = lot.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return null;

    lot.sales[saleIndex] = { ...lot.sales[saleIndex], ...updates };
    saveStorageData(data);
    return lot;
}

/**
 * Get all sales from all lots
 * @returns {Array} Array of { lot, sale } objects
 */
export function getAllSales() {
    const lots = getLots();
    const allSales = [];

    for (const lot of lots) {
        if (!lot.sales) continue;
        for (const sale of lot.sales) {
            allSales.push({ lot, sale });
        }
    }

    return allSales;
}

/**
 * Get all sales within a date range
 * @param {Date} startDate - Start of range (inclusive)
 * @param {Date|null} endDate - End of range (inclusive), null for no end limit
 * @returns {Array} Array of { lot, sale } objects
 */
export function getSalesByDateRange(startDate, endDate = null) {
    const lots = getLots();
    const salesInRange = [];

    const startTime = startDate.getTime();
    const endTime = endDate ? endDate.getTime() : Infinity;

    for (const lot of lots) {
        if (!lot.sales) continue;
        for (const sale of lot.sales) {
            const saleTime = new Date(sale.dateSold).getTime();
            if (saleTime >= startTime && saleTime <= endTime) {
                salesInRange.push({ lot, sale });
            }
        }
    }

    return salesInRange;
}

/**
 * Delete a lot
 * @param {string} id - Lot ID
 * @returns {boolean} True if deleted
 */
export function deleteLot(id) {
    const data = getStorageData();
    const index = data.lots.findIndex(lot => lot.id === id);

    if (index === -1) return false;

    data.lots.splice(index, 1);
    saveStorageData(data);

    // Cloud sync
    if (auth.currentUser) {
        deleteLotFromCloud(id);
    }

    return true;
}

/**
 * Get lots filtered by month (by dateAdded)
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Array} Filtered lots
 */
export function getLotsByMonth(year, month) {
    const lots = getLots();
    return lots.filter(lot => {
        const date = new Date(lot.dateAdded);
        return date.getFullYear() === year && date.getMonth() === month;
    });
}

/**
 * Get all sales from all lots filtered by sale month
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Array} Array of { lot, sale } objects
 */
export function getSalesByMonth(year, month) {
    const lots = getLots();
    const salesInMonth = [];

    for (const lot of lots) {
        if (!lot.sales) continue;
        for (const sale of lot.sales) {
            const date = new Date(sale.dateSold);
            if (date.getFullYear() === year && date.getMonth() === month) {
                salesInMonth.push({ lot, sale });
            }
        }
    }

    return salesInMonth;
}

/**
 * Check if a lot is fully sold
 * @param {Object} lot - Lot object
 * @returns {boolean}
 */
export function isFullySold(lot) {
    return lot.remaining === 0;
}

/**
 * Check if a lot has any sales
 * @param {Object} lot - Lot object
 * @returns {boolean}
 */
export function hasSales(lot) {
    return lot.sales && lot.sales.length > 0;
}

/**
 * Get total profit for a lot across all sales
 * @param {Object} lot - Lot object
 * @returns {number} Total profit in cents
 */
export function getLotTotalProfit(lot) {
    if (!lot.sales) return 0;
    return lot.sales.reduce((sum, sale) => sum + sale.profit, 0);
}

/**
 * Calculate return deadline (purchase date + 30 days)
 * @param {Object} lot - Lot object
 * @returns {Date} Return deadline date
 */
export function getReturnDeadline(lot) {
    const purchaseDate = lot.purchaseDate ? new Date(lot.purchaseDate) : new Date(lot.dateAdded);
    const deadline = new Date(purchaseDate);
    deadline.setDate(deadline.getDate() + 30);
    return deadline;
}

/**
 * Get days until return deadline
 * @param {Object} lot - Lot object
 * @returns {number} Days remaining (negative if past)
 */
export function getDaysUntilReturn(lot) {
    const deadline = getReturnDeadline(lot);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get lots that are within days of return deadline and have unsold units
 * @param {number} withinDays - Alert threshold (default 3)
 * @returns {Array} Lots needing return attention
 */
export function getLotsNearingReturnDeadline(withinDays = 3) {
    return getLots().filter(lot => {
        if (lot.remaining === 0) return false;
        if (lot.returnDismissed) return false;
        const daysLeft = getDaysUntilReturn(lot);
        return daysLeft <= withinDays && daysLeft >= 0;
    });
}

/**
 * Mark a lot as returned (removes from inventory)
 * @param {string} id - Lot ID
 * @returns {boolean} True if deleted
 */
export function markReturned(id) {
    return deleteLot(id);
}

/**
 * Dismiss return alert for a lot (user is keeping it)
 * @param {string} id - Lot ID
 * @returns {Object|null} Updated lot
 */
export function dismissReturnAlert(id) {
    return updateLot(id, { returnDismissed: true });
}
