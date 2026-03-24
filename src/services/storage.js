// Storage Service - localStorage wrapper with data persistence

const STORAGE_KEY = 'reselltracker_data';
const STORAGE_VERSION = 3; // Adds churning cards + orders

import {
    saveLotToCloud,
    deleteLotFromCloud,
    saveChurningOrderToCloud,
    deleteChurningOrderFromCloud,
    saveChurnCardToCloud,
    deleteChurnCardFromCloud
} from './firebaseSync.js';
import { auth } from './firebase.js';
import { generateDemoData, generateDemoChurningCards, generateDemoChurningOrders } from './demoData.js';
import { calculateCashbackValue, calculateChurningProfit } from './calculations.js';

function createEmptyStorageData() {
    return {
        version: STORAGE_VERSION,
        lots: [],
        churnCards: [],
        churningOrders: []
    };
}

function createDemoStorageData() {
    const cards = generateDemoChurningCards();

    return {
        version: STORAGE_VERSION,
        lots: generateDemoData(),
        churnCards: cards,
        churningOrders: generateDemoChurningOrders(cards)
    };
}

function normalizeStorageData(data) {
    if (!data || typeof data !== 'object') {
        return createEmptyStorageData();
    }

    if (!Array.isArray(data.lots)) {
        data.lots = [];
    }

    // Migration from v1 to v2: add unitCost and remaining
    if ((data.version || 1) < 2) {
        data.lots = data.lots.map(lot => ({
            ...lot,
            unitCost: lot.unitCost || lot.cost,
            totalCost: lot.cost,
            remaining: lot.sale ? 0 : (lot.quantity || 1),
            sales: lot.sale ? [{
                ...lot.sale,
                unitsSold: lot.quantity || 1
            }] : []
        }));
    }

    if ((data.version || 1) < 3) {
        data.churnCards = [];
        data.churningOrders = [];
    }

    data.churnCards = Array.isArray(data.churnCards) ? data.churnCards : [];
    data.churningOrders = Array.isArray(data.churningOrders) ? data.churningOrders : [];
    data.churnCards = data.churnCards.map((card) => ({
        ...card,
        cashbackRate: Math.max(0, Number(card?.cashbackRate) || 0),
        cashbackType: normalizeCashbackType(card?.cashbackType)
    }));
    data.churningOrders = data.churningOrders.map((order) => {
        const purchaseAmount = Math.max(0, Number(order?.purchaseAmount) || 0);
        const reimbursementAmount = Math.max(0, Number(order?.reimbursementAmount) || 0);
        const cashbackRate = Math.max(0, Number(order?.cashbackRate) || 0);

        return {
            ...order,
            purchaseAmount,
            reimbursementAmount,
            cashbackRate,
            cashbackType: normalizeCashbackType(order?.cashbackType),
            cashbackAmount: Number.isFinite(Number(order?.cashbackAmount))
                ? Number(order.cashbackAmount)
                : calculateCashbackValue(purchaseAmount, cashbackRate),
            profit: Number.isFinite(Number(order?.profit))
                ? Number(order.profit)
                : calculateChurningProfit(purchaseAmount, reimbursementAmount, cashbackRate)
        };
    });
    data.version = STORAGE_VERSION;

    return data;
}

/**
 * Get the current storage data structure
 */
function getStorageData() {
    // Demo Mode Interception
    if (localStorage.getItem('demoMode') === 'true') {
        const demoRaw = localStorage.getItem('resell_demo_lots');
        if (demoRaw) return normalizeStorageData(JSON.parse(demoRaw));

        const demoState = createDemoStorageData();
        localStorage.setItem('resell_demo_lots', JSON.stringify(demoState));
        return demoState;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return createEmptyStorageData();
        }

        const parsed = JSON.parse(raw);
        const data = normalizeStorageData(parsed);

        if ((parsed.version || 1) !== STORAGE_VERSION) {
            saveStorageData(data);
        }

        return data;
    } catch (e) {
        console.error('Failed to read storage:', e);
        return createEmptyStorageData();
    }
}

/**
 * Save the entire storage data structure
 */
function saveStorageData(data) {
    if (localStorage.getItem('demoMode') === 'true') {
        localStorage.setItem('resell_demo_lots', JSON.stringify(data));
        return true;
    }

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

export function getChurnCards() {
    return getStorageData().churnCards;
}

export function setChurnCards(cards) {
    const data = getStorageData();
    data.churnCards = Array.isArray(cards) ? cards : [];
    saveStorageData(data);
}

export function getChurningOrders() {
    return getStorageData().churningOrders;
}

export function setChurningOrders(orders) {
    const data = getStorageData();
    data.churningOrders = Array.isArray(orders) ? orders : [];
    saveStorageData(data);
}

export function clearAllData() {
    saveStorageData(createEmptyStorageData());
}

function normalizeCashbackType(type) {
    return type === 'points' ? 'points' : 'statement-credit';
}

function getChurningCardById(cardId) {
    return getChurnCards().find(card => card.id === cardId) || null;
}

function buildChurningCardPayload(cardData, existingCard = null) {
    const now = new Date().toISOString();

    return {
        id: existingCard?.id || generateId(),
        name: (cardData.name || existingCard?.name || 'Untitled Card').trim(),
        cashbackRate: Math.max(0, Number(cardData.cashbackRate ?? existingCard?.cashbackRate) || 0),
        cashbackType: normalizeCashbackType(cardData.cashbackType ?? existingCard?.cashbackType),
        createdAt: existingCard?.createdAt || now,
        updatedAt: now
    };
}

function buildChurningOrderPayload(orderData, existingOrder = null) {
    const resolvedCardId = orderData.cardId ?? existingOrder?.cardId ?? null;
    const selectedCard = resolvedCardId ? getChurningCardById(resolvedCardId) : null;
    const fallbackSnapshot = existingOrder || {};
    const cashbackRate = Number(selectedCard?.cashbackRate ?? fallbackSnapshot.cashbackRate) || 0;
    const cashbackType = normalizeCashbackType(selectedCard?.cashbackType ?? fallbackSnapshot.cashbackType);
    const purchaseAmount = Math.max(0, Number(orderData.purchaseAmount ?? existingOrder?.purchaseAmount) || 0);
    const reimbursementAmount = Math.max(0, Number(orderData.reimbursementAmount ?? existingOrder?.reimbursementAmount) || 0);
    const now = new Date().toISOString();

    if (resolvedCardId && !selectedCard && !existingOrder) {
        return null;
    }

    const cashbackAmount = calculateCashbackValue(purchaseAmount, cashbackRate);
    const profit = calculateChurningProfit(purchaseAmount, reimbursementAmount, cashbackRate);

    return {
        id: existingOrder?.id || generateId(),
        store: (orderData.store ?? existingOrder?.store ?? 'Unknown Store').trim(),
        purchaseAmount,
        reimbursementAmount,
        cardId: resolvedCardId,
        cardName: selectedCard?.name || fallbackSnapshot.cardName || 'Unknown Card',
        cashbackRate,
        cashbackType,
        cashbackAmount,
        profit,
        trackingUploaded: Boolean(orderData.trackingUploaded ?? existingOrder?.trackingUploaded),
        delivered: Boolean(orderData.delivered ?? existingOrder?.delivered),
        paid: Boolean(orderData.paid ?? existingOrder?.paid),
        purchaseDate: orderData.purchaseDate ?? existingOrder?.purchaseDate ?? new Date().toISOString().split('T')[0],
        paidDate: (orderData.paid ?? existingOrder?.paid)
            ? (orderData.paidDate ?? existingOrder?.paidDate ?? new Date().toISOString().split('T')[0])
            : null,
        createdAt: existingOrder?.createdAt || now,
        updatedAt: now
    };
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
    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
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
    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        saveLotToCloud(data.lots[index]);
    }

    return data.lots[index];
}

export function saveChurnCard(cardData) {
    const data = getStorageData();
    const newCard = buildChurningCardPayload(cardData);

    data.churnCards.unshift(newCard);
    saveStorageData(data);

    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        saveChurnCardToCloud(newCard);
    }

    return newCard;
}

export function updateChurnCard(id, updates) {
    const data = getStorageData();
    const index = data.churnCards.findIndex(card => card.id === id);

    if (index === -1) return null;

    data.churnCards[index] = buildChurningCardPayload({
        ...data.churnCards[index],
        ...updates
    }, data.churnCards[index]);

    saveStorageData(data);

    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        saveChurnCardToCloud(data.churnCards[index]);
    }

    return data.churnCards[index];
}

export function deleteChurnCard(id) {
    const data = getStorageData();
    const isInUse = data.churningOrders.some(order => order.cardId === id);

    if (isInUse) return false;

    const nextCards = data.churnCards.filter(card => card.id !== id);
    if (nextCards.length === data.churnCards.length) return false;

    data.churnCards = nextCards;
    saveStorageData(data);

    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        deleteChurnCardFromCloud(id);
    }

    return true;
}

export function getChurningOrderById(id) {
    return getChurningOrders().find(order => order.id === id) || null;
}

export function saveChurningOrder(orderData) {
    const data = getStorageData();
    const newOrder = buildChurningOrderPayload(orderData);

    if (!newOrder) return null;

    data.churningOrders.unshift(newOrder);
    saveStorageData(data);

    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        saveChurningOrderToCloud(newOrder);
    }

    return newOrder;
}

export function updateChurningOrder(id, updates) {
    const data = getStorageData();
    const index = data.churningOrders.findIndex(order => order.id === id);

    if (index === -1) return null;

    const updatedOrder = buildChurningOrderPayload({
        ...data.churningOrders[index],
        ...updates
    }, data.churningOrders[index]);

    if (!updatedOrder) return null;

    data.churningOrders[index] = updatedOrder;
    saveStorageData(data);

    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        saveChurningOrderToCloud(updatedOrder);
    }

    return updatedOrder;
}

export function deleteChurningOrder(id) {
    const data = getStorageData();
    const nextOrders = data.churningOrders.filter(order => order.id !== id);

    if (nextOrders.length === data.churningOrders.length) return false;

    data.churningOrders = nextOrders;
    saveStorageData(data);

    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        deleteChurningOrderFromCloud(id);
    }

    return true;
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

    // Explicit type casting with defaults
    const price = Number(pricePerUnit) || 0;
    const qty = Number(unitsSold) || 0;
    const shipping = Number(shippingCost) || 0;

    if (qty > lot.remaining) return null;
    if (price <= 0) return null;

    const pricePerUnitCents = Math.round(price * 100);
    const totalSalePrice = pricePerUnitCents * qty;
    const feeRate = platform === 'facebook' ? 0 : 0.135;
    const fees = Math.round(totalSalePrice * feeRate);
    const shippingCostCents = Math.round(shipping * 100);
    const costBasis = (Number(lot.unitCost) || 0) * qty;
    const profit = totalSalePrice - costBasis - fees - shippingCostCents;

    const saleRecord = {
        id: generateId(),
        lotId: id,
        unitsSold: qty,
        pricePerUnit: pricePerUnitCents,
        totalPrice: totalSalePrice,
        platform: platform || 'unknown',
        fees,
        shippingCost: shippingCostCents,
        costBasis,
        profit,
        dateSold: saleDateStr ? new Date(saleDateStr + 'T12:00:00').toISOString() : new Date().toISOString(),
        returned: false
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

    const oldSale = lot.sales[saleIndex];
    const newSale = { ...oldSale, ...updates };

    // If quantity changed, adjust lot.remaining
    if (updates.unitsSold !== undefined) {
        const qtyDiff = oldSale.unitsSold - updates.unitsSold;
        lot.remaining += qtyDiff;
    }

    // Recalculate fees and profit if price, quantity, or platform changed
    if (updates.pricePerUnit !== undefined || updates.unitsSold !== undefined || updates.platform !== undefined || updates.shippingCost !== undefined) {
        const platform = newSale.platform || 'unknown';
        const feeRate = platform === 'facebook' ? 0 : 0.135;

        const pricePerUnitCents = newSale.pricePerUnit;
        const totalSalePrice = pricePerUnitCents * newSale.unitsSold;
        const fees = Math.round(totalSalePrice * feeRate);
        const costBasis = (Number(lot.unitCost) || 0) * newSale.unitsSold;

        newSale.totalPrice = totalSalePrice;
        newSale.fees = fees;
        newSale.costBasis = costBasis;
        newSale.profit = totalSalePrice - costBasis - fees - (newSale.shippingCost || 0);
    }

    lot.sales[saleIndex] = newSale;
    saveStorageData(data);

    // Cloud sync
    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        saveLotToCloud(lot);
    }

    return lot;
}

/**
 * Mark a specific sale as returned/refunded
 * @param {string} lotId - Lot ID
 * @param {string} saleId - Sale record ID
 * @returns {Object|null} Updated lot or null
 */
export function markSaleReturned(lotId, saleId) {
    const data = getStorageData();
    const lotIndex = data.lots.findIndex(l => l.id === lotId);

    if (lotIndex === -1) return null;
    const lot = data.lots[lotIndex];

    const saleIndex = lot.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return null;

    const sale = lot.sales[saleIndex];

    // Already returned, nothing to do
    if (sale.returned) return lot;

    // Mark as returned
    lot.sales[saleIndex] = { ...sale, returned: true };

    // Restore units to inventory
    lot.remaining += sale.unitsSold;

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
        lot.sales.forEach((sale, saleIndex) => {
            allSales.push({ lot, sale, saleIndex });
        });
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
        lot.sales.forEach((sale, saleIndex) => {
            // Parse date as local time by appending T00:00:00 to avoid UTC shift
            const saleDateStr = sale.dateSold.includes('T') ? sale.dateSold : sale.dateSold + 'T00:00:00';
            const saleTime = new Date(saleDateStr).getTime();
            if (saleTime >= startTime && saleTime <= endTime) {
                salesInRange.push({ lot, sale, saleIndex });
            }
        });
    }

    return salesInRange;
}

/**
 * Delete a lot
 * @param {string} id - Lot ID
 * @returns {boolean} True if deleted
 */
export function deleteLot(id) {
    console.log('🗑️ deleteLot called with id:', id);
    const data = getStorageData();
    const index = data.lots.findIndex(lot => lot.id === id);

    if (index === -1) {
        console.warn('🚫 Lot not found for deletion:', id);
        return false;
    }

    data.lots.splice(index, 1);
    saveStorageData(data);
    console.log('✅ Deleted from localStorage:', id);

    // Cloud sync
    if (auth.currentUser && localStorage.getItem('demoMode') !== 'true') {
        console.log('☁️ User logged in, deleting from cloud...');
        deleteLotFromCloud(id).catch(err => console.error('❌ Cloud delete failed:', err));
    } else {
        console.warn('🚫 No user logged in or demo mode active, skipping cloud delete');
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
        lot.sales.forEach((sale, saleIndex) => {
            const date = new Date(sale.dateSold);
            if (date.getFullYear() === year && date.getMonth() === month) {
                salesInMonth.push({ lot, sale, saleIndex });
            }
        });
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
    if (!lot || !lot.sales || !Array.isArray(lot.sales)) return 0;
    return lot.sales.reduce((sum, sale) => {
        const profit = Number(sale?.profit) || 0;
        return sum + profit;
    }, 0);
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
