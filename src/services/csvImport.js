// CSV Import Service - Parse and import lots from CSV files

import { saveLot, recordSale, getLots } from './storage.js';

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - Raw CSV content
 * @returns {Array} Array of row objects with headers as keys
 */
export function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Parse header row
    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
        });
        rows.push(row);
    }

    return rows;
}

/**
 * Parse a single CSV row handling quoted values
 */
function parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

/**
 * Import lots (and optionally sales) from CSV file
 * Supports multiple formats:
 * - Simple: name, cost, quantity, purchase_date
 * - With sales: product_name, cost_price, quantity_purchased, date_purchased, 
 *               cash (FB sale), sale_price (eBay), shipping_fees, qty_sold, date_sold
 * @param {File} file - CSV file
 * @returns {Promise<{success: number, salesImported: number, errors: Array}>}
 */
export async function importLotsFromCSV(file) {
    const text = await file.text();
    const rows = parseCSV(text);

    let lotsImported = 0;
    let salesImported = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
            // Find name column (flexible naming)
            const name = row.product_name || row.name || row.item || row.product || row.description || '';
            if (!name) {
                errors.push(`Row ${i + 2}: Missing product name`);
                continue;
            }

            // Find cost column
            const costStr = row.cost_price || row.cost || row.price || row.total || row.amount || '0';
            const cost = parseFloat(costStr.replace(/[$,]/g, ''));
            if (isNaN(cost) || cost < 0) {
                errors.push(`Row ${i + 2}: Invalid cost "${costStr}"`);
                continue;
            }

            // Find quantity column
            const quantityStr = row.quantity_purchased || row.quantity || row.qty || row.units || '1';
            const quantity = parseInt(quantityStr) || 1;

            // Find purchase date column
            const purchaseDateStr = row.date_purchased || row.purchase_date || row.date || row.purchased || '';
            let purchaseDate = new Date().toISOString().split('T')[0];
            if (purchaseDateStr) {
                const parsed = parseDate(purchaseDateStr);
                if (parsed) purchaseDate = parsed;
            }

            // Save the lot
            const newLot = saveLot({
                name,
                cost,
                quantity,
                purchaseDate
            });

            lotsImported++;

            // Check for sale data - either Cash (Facebook) or Sale Price (eBay)
            const cashStr = row.cash || '';
            const salePriceStr = row.sale_price || '';
            const qtySoldStr = row.qty_sold || row.quantity_sold || '';
            const dateSoldStr = row.date_sold || '';
            const shippingStr = row.shipping_fees || row.shipping || '';

            const cashPrice = parseFloat(cashStr.replace(/[$,]/g, '')) || 0;
            const ebayPrice = parseFloat(salePriceStr.replace(/[$,]/g, '')) || 0;
            const qtySold = parseInt(qtySoldStr) || 0;
            const shippingFees = parseFloat(shippingStr.replace(/[$,]/g, '')) || 0;

            // Parse sale date
            let saleDate = null;
            if (dateSoldStr) {
                saleDate = parseDate(dateSoldStr);
            }

            // If there's a sale, record it
            if (qtySold > 0 && (cashPrice > 0 || ebayPrice > 0)) {
                if (cashPrice > 0) {
                    // Facebook sale
                    recordSale(newLot.id, cashPrice, qtySold, 'facebook', 0, saleDate);
                    salesImported++;
                } else if (ebayPrice > 0) {
                    // eBay sale
                    recordSale(newLot.id, ebayPrice, qtySold, 'ebay', shippingFees, saleDate);
                    salesImported++;
                }
            }

        } catch (e) {
            errors.push(`Row ${i + 2}: ${e.message}`);
        }
    }

    return { success: lotsImported, salesImported, errors };
}

/**
 * Parse various date formats
 */
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Normalize the string
    dateStr = dateStr.trim();

    // Try common formats
    const formats = [
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,       // YYYY-MM-DD
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,     // MM/DD/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,     // MM/DD/YY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,       // MM-DD-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{2})$/,       // MM-DD-YY
    ];

    for (let i = 0; i < formats.length; i++) {
        const match = dateStr.match(formats[i]);
        if (match) {
            try {
                let year, month, day;
                if (i === 0) {
                    // YYYY-MM-DD
                    [, year, month, day] = match;
                } else {
                    // MM/DD/YY or MM/DD/YYYY
                    [, month, day, year] = match;
                    if (year.length === 2) {
                        year = parseInt(year) > 50 ? '19' + year : '20' + year;
                    }
                }
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            } catch (e) {
                // Continue to next format
            }
        }
    }

    // Try native Date parsing
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        // Return null
    }

    return null;
}

/**
 * Generate a sample CSV template
 */
export function generateCSVTemplate() {
    return `product_name,cost_price,quantity_purchased,date_purchased,cash,sale_price,shipping_fees,qty_sold,date_sold
"Example Facebook Sale",25.99,5,1/15/2024,35.00,,0,2,1/20/2024
"Example eBay Sale",10.50,10,1/20/2024,,18.99,3.50,3,1/25/2024
"Unsold Item",45.00,3,2/1/2024,,,,,`;
}
