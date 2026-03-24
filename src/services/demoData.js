import { calculateCashbackValue, calculateChurningProfit } from './calculations.js';

export function generateDemoData() {
    const lots = [];
    let lotIdCounter = 1;
    let saleIdCounter = 1;
    const now = new Date();

    // Q4 Seasonality Day Randomizer
    function getRandomDaysAgoWithSeasonality() {
        const blocks = [];
        let totalW = 0;
        for (let i = 0; i < 12; i++) {
            const midDaysAgo = i * 30 + 15;
            const midDate = new Date(now);
            midDate.setDate(midDate.getDate() - midDaysAgo);
            const month = midDate.getMonth();
            let w = 1.0;
            if (month === 9) w = 1.3;
            if (month === 10) w = 1.8;
            if (month === 11) w = 1.5;
            if (i === 0) w = Math.max(w, 1.4);
            blocks.push({ i, w });
            totalW += w;
        }

        let r = Math.random() * totalW;
        let selectedBlock = 0;
        for (let b of blocks) {
            if (r < b.w) { selectedBlock = b.i; break; }
            r -= b.w;
        }
        return selectedBlock * 30 + (Math.random() * 30);
    }

    // 1. Define Top 5 SKUs (Fixed 163,110 Rev)
    const topPerformers = [
        { name: 'Apple iPad Pro', soldUnits: 112, price: 90000, cost: 60000, platform: 'amazon', remaining: 18 },
        { name: 'Nike Dunk Low Panda', soldUnits: 68, price: 17000, cost: 11000, platform: 'shopify', remaining: 5 },
        { name: 'PlayStation 5', soldUnits: 42, price: 55000, cost: 38000, platform: 'ebay', remaining: 0 },
        { name: 'Xbox Series X', soldUnits: 35, price: 55000, cost: 38000, platform: 'facebook', remaining: 8 },
        { name: 'Pokémon Base Set Booster Box', soldUnits: 21, price: 40000, cost: 25000, platform: 'whatnot', remaining: 0 }
    ];

    topPerformers.forEach(sku => {
        sku.totalCostCentsPool = sku.cost * sku.soldUnits;
    });

    // 2. Define 20 Secondary SKUs (Fixed 149,720 Rev)
    const secondarySkus = [
        { name: 'AirPods Pro 2', soldUnits: 28, price: 20000, platform: 'amazon', remaining: 12 },
        { name: 'Logitech G Pro X Superlight', soldUnits: 24, price: 15000, platform: 'amazon', remaining: 4 },
        { name: 'Lululemon Align Leggings', soldUnits: 24, price: 10000, platform: 'amazon', remaining: 0 },
        { name: 'Stanley Quencher H2.0', soldUnits: 74, price: 5000, platform: 'shopify', remaining: 20 },
        { name: 'Dyson Airwrap Multi-Styler', soldUnits: 35, price: 50000, platform: 'shopify', remaining: 3 },
        { name: 'Kaws Figure Flayed', soldUnits: 25, price: 28000, platform: 'shopify', remaining: 0 },
        { name: 'DJI Mini 3 Pro Drone', soldUnits: 16, price: 70000, platform: 'shopify', remaining: 2 },
        { name: 'Secretlab Titan Evo', soldUnits: 9, price: 58000, platform: 'shopify', remaining: 0 },
        { name: 'Yeezy Slide Onyx', soldUnits: 45, price: 12000, platform: 'facebook', remaining: 15 },
        { name: 'Bose QuietComfort Earbuds II', soldUnits: 25, price: 22000, platform: 'facebook', remaining: 0 },
        { name: 'Steam Deck 512GB', soldUnits: 18, price: 45000, platform: 'facebook', remaining: 2 },
        { name: 'Nintendo Switch Lite', soldUnits: 10, price: 18000, platform: 'whatnot', remaining: 6 },
        { name: 'Patagonia Better Sweater', soldUnits: 15, price: 10000, platform: 'whatnot', remaining: 0 },
        { name: 'Lego Star Wars UCS Falcon', soldUnits: 14, price: 80000, platform: 'ebay', remaining: 1 },
        { name: 'Sony A7IV Camera Body', soldUnits: 7, price: 200000, platform: 'ebay', remaining: 0 },
        { name: 'Oura Ring Gen 3', soldUnits: 25, price: 30000, platform: 'ebay', remaining: 5 },
        { name: 'AMD Ryzen 7 7800X3D', soldUnits: 30, price: 40000, platform: 'ebay', remaining: 8 },
        { name: 'Vintage Graphic Tees Bundle', soldUnits: 50, price: 15000, platform: 'ebay', remaining: 25 },
        { name: 'Garmin Fenix 7', soldUnits: 25, price: 60000, platform: 'ebay', remaining: 4 },
        { name: 'Herman Miller Aeron Chair', soldUnits: 10, price: 40000, platform: 'ebay', remaining: 2 }
    ];

    // Compute costs for secondary SKUs to strictly ensure EXACTLY $52,432.50 profit
    const TARGET_SECONDARY_PROFIT_CENTS = 5243250;
    let baselineCostCentsTotal = 0;
    let actualFeesCents = 0;
    const totalSecondaryRevCents = 14972000;

    secondarySkus.forEach(sku => {
        const rev = sku.soldUnits * sku.price;
        actualFeesCents += (sku.platform === 'ebay' ? Math.round(rev * 0.135) : 0);
        sku.cost = Math.round(sku.price * 0.58);
        baselineCostCentsTotal += (sku.cost * sku.soldUnits);
    });

    const targetTotalCostCents = totalSecondaryRevCents - actualFeesCents - TARGET_SECONDARY_PROFIT_CENTS;
    const costDiffCents = targetTotalCostCents - baselineCostCentsTotal;
    const totalSecondaryUnits = secondarySkus.reduce((sum, s) => sum + s.soldUnits, 0);
    const addedCostPerUnit = Math.round(costDiffCents / totalSecondaryUnits);

    let appliedDiff = 0;
    secondarySkus.forEach((sku, idx) => {
        if (idx === secondarySkus.length - 1) {
            const remainingDiffForOverall = costDiffCents - appliedDiff;
            sku.totalCostCentsPool = (sku.cost * sku.soldUnits) + remainingDiffForOverall;
            sku.unitCostCalc = Math.round(sku.totalCostCentsPool / sku.soldUnits);
        } else {
            const added = addedCostPerUnit * sku.soldUnits;
            sku.totalCostCentsPool = (sku.cost * sku.soldUnits) + added;
            sku.unitCostCalc = Math.round(sku.totalCostCentsPool / sku.soldUnits);
            appliedDiff += added;
        }
    });

    const allSalesSkus = [...topPerformers, ...secondarySkus];

    // Generate Lots & Sales for the 25 SKUs
    allSalesSkus.forEach(sku => {
        const sales = [];
        let unitsLeft = sku.soldUnits;
        let costPoolLeft = sku.totalCostCentsPool;

        while (unitsLeft > 0) {
            const chunk = Math.min(unitsLeft, Math.floor(Math.random() * 4) + 1);
            unitsLeft -= chunk;

            const daysAgo = getRandomDaysAgoWithSeasonality();
            const saleDate = new Date(now);
            saleDate.setDate(saleDate.getDate() - daysAgo);
            saleDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);

            const totPrice = chunk * sku.price;
            const feeRate = sku.platform === 'ebay' ? 0.135 : 0;
            const fees = Math.round(totPrice * feeRate);

            let chunkCost;
            if (unitsLeft === 0) {
                chunkCost = costPoolLeft;
            } else {
                chunkCost = Math.round((costPoolLeft / (unitsLeft + chunk)) * chunk);
                costPoolLeft -= chunkCost;
            }

            sales.push({
                id: `demo-sale-${saleIdCounter++}`,
                lotId: `demo-lot-${lotIdCounter}`,
                unitsSold: chunk,
                pricePerUnit: sku.price,
                totalPrice: totPrice,
                platform: sku.platform,
                fees: fees,
                shippingCost: 0,
                costBasis: chunkCost,
                profit: totPrice - chunkCost - fees,
                dateSold: saleDate.toISOString(),
                returned: false
            });
        }

        sales.sort((a, b) => new Date(a.dateSold) - new Date(b.dateSold));

        const firstSaleDate = new Date(sales[0].dateSold);
        const addedDate = new Date(firstSaleDate);
        addedDate.setDate(addedDate.getDate() - (Math.floor(Math.random() * 7) + 3));

        const inventoryQty = sku.soldUnits + sku.remaining;
        const avgUnitCost = sku.unitCostCalc || sku.cost;

        lots.push({
            id: `demo-lot-${lotIdCounter++}`,
            name: sku.name,
            totalCost: avgUnitCost * inventoryQty,
            unitCost: avgUnitCost,
            quantity: inventoryQty,
            remaining: sku.remaining,
            dateAdded: addedDate.toISOString(),
            purchaseDate: addedDate.toISOString(),
            imageData: null,
            sales: sales
        });
    });

    // 3. Define 15 Unsold Active SKUs (Total = 40 SKUs)
    const unsoldSkus = [
        { name: 'GoPro HERO12 Black', price: 35000, cost: 25000, remaining: 8 },
        { name: 'KitchenAid Stand Mixer', price: 40000, cost: 28000, remaining: 4 },
        { name: 'Yeti Rambler 20 oz', price: 3500, cost: 2000, remaining: 15 },
        { name: 'Owala FreeSip Water Bottle', price: 2800, cost: 1500, remaining: 20 },
        { name: 'AirPods Max', price: 45000, cost: 35000, remaining: 6 },
        { name: 'Kindle Paperwhite', price: 14000, cost: 10000, remaining: 9 },
        { name: 'Ninja Creami Maker', price: 20000, cost: 15000, remaining: 5 },
        { name: 'Carhartt WIP Beanie', price: 3000, cost: 1500, remaining: 25 },
        { name: 'Sony WH-1000XM5', price: 35000, cost: 25000, remaining: 7 },
        { name: 'Brooks Ghost 15', price: 14000, cost: 8000, remaining: 11 },
        { name: 'Nespresso VertuoPlus', price: 16000, cost: 11000, remaining: 8 },
        { name: 'New Balance 990v6', price: 20000, cost: 14000, remaining: 12 },
        { name: 'Theragun Mini', price: 19000, cost: 13000, remaining: 5 },
        { name: 'North Face Nuptse', price: 28000, cost: 19000, remaining: 4 },
        { name: 'Meta Quest 3', price: 50000, cost: 42000, remaining: 6 }
    ];

    unsoldSkus.forEach(sku => {
        const addedDate = new Date(now);
        addedDate.setDate(addedDate.getDate() - (Math.floor(Math.random() * 30) + 1));
        lots.push({
            id: `demo-lot-${lotIdCounter++}`,
            name: sku.name,
            totalCost: sku.cost * sku.remaining,
            unitCost: sku.cost,
            quantity: sku.remaining,
            remaining: sku.remaining,
            dateAdded: addedDate.toISOString(),
            purchaseDate: addedDate.toISOString(),
            imageData: null,
            sales: []
        });
    });

    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('dashboardCurrentRange', 'all');
    }

    return lots;
}

export function generateDemoChurningCards() {
    const createdAt = new Date().toISOString();

    return [
        {
            id: 'demo-card-amex-gold',
            name: 'Amex Gold',
            cashbackRate: 4,
            cashbackType: 'points',
            createdAt,
            updatedAt: createdAt
        },
        {
            id: 'demo-card-citi-custom',
            name: 'Citi Custom Cash',
            cashbackRate: 5,
            cashbackType: 'statement-credit',
            createdAt,
            updatedAt: createdAt
        }
    ];
}

export function generateDemoChurningOrders(cards = generateDemoChurningCards()) {
    const cardLookup = Object.fromEntries(cards.map((card) => [card.id, card]));
    const today = new Date();

    const demoOrders = [
        {
            id: 'demo-churn-order-1',
            store: 'Amazon',
            purchaseAmount: 48215,
            reimbursementAmount: 48215,
            cardId: 'demo-card-amex-gold',
            purchaseDate: shiftDate(today, -2),
            trackingUploaded: false,
            delivered: false,
            paid: false,
            paidDate: null
        },
        {
            id: 'demo-churn-order-2',
            store: 'Best Buy',
            purchaseAmount: 79999,
            reimbursementAmount: 80499,
            cardId: 'demo-card-citi-custom',
            purchaseDate: shiftDate(today, -6),
            trackingUploaded: false,
            delivered: false,
            paid: false,
            paidDate: null
        },
        {
            id: 'demo-churn-order-3',
            store: 'Amazon',
            purchaseAmount: 12999,
            reimbursementAmount: 12999,
            cardId: 'demo-card-citi-custom',
            purchaseDate: shiftDate(today, -9),
            trackingUploaded: true,
            delivered: true,
            paid: false,
            paidDate: null
        },
        {
            id: 'demo-churn-order-4',
            store: 'Target',
            purchaseAmount: 33998,
            reimbursementAmount: 33998,
            cardId: 'demo-card-amex-gold',
            purchaseDate: shiftDate(today, -16),
            trackingUploaded: true,
            delivered: true,
            paid: true,
            paidDate: shiftDate(today, -4)
        }
    ];

    return demoOrders.map((order) => enrichDemoOrder(order, cardLookup[order.cardId]));
}

function shiftDate(baseDate, days) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate.toISOString().split('T')[0];
}

function enrichDemoOrder(order, card) {
    const cashbackRate = Number(card?.cashbackRate) || 0;
    const cashbackAmount = calculateCashbackValue(order.purchaseAmount, cashbackRate);
    const profit = calculateChurningProfit(order.purchaseAmount, order.reimbursementAmount, cashbackRate);
    const timestamp = new Date(`${order.purchaseDate}T12:00:00`).toISOString();

    return {
        ...order,
        cardName: card?.name || 'Unknown Card',
        cashbackRate,
        cashbackType: card?.cashbackType || 'statement-credit',
        cashbackAmount,
        profit,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}
