// CSV Import Service - Parse and import lots from CSV files

import { saveLot, recordSale } from './storage.js';

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - Raw CSV content
 * @returns {Array} Array of row objects with headers as keys
 */
export function parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Parse header row
    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        if (values.length === 0) continue;

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
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
 * Import lots from CSV file
 * Expected columns: name, cost, quantity, purchase_date (optional)
 * @param {File} file - CSV file
 * @returns {Promise<{success: number, errors: Array}>}
 */
export async function importLotsFromCSV(file) {
    const text = await file.text();
    const rows = parseCSV(text);

    let success = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
            // Find name column (flexible naming)
            const name = row.name || row.item || row.product || row.description || '';
            if (!name) {
                errors.push(`Row ${i + 2}: Missing name`);
                continue;
            }

            // Find cost column
            const costStr = row.cost || row.price || row.total || row.amount || '0';
            const cost = parseFloat(costStr.replace(/[$,]/g, ''));
            if (isNaN(cost) || cost < 0) {
                errors.push(`Row ${i + 2}: Invalid cost "${costStr}"`);
                continue;
            }

            // Find quantity column
            const quantityStr = row.quantity || row.qty || row.units || '1';
            const quantity = parseInt(quantityStr) || 1;

            // Find purchase date column
            const dateStr = row.purchase_date || row.date || row.purchased || '';
            let purchaseDate = new Date().toISOString().split('T')[0];
            if (dateStr) {
                const parsed = parseDate(dateStr);
                if (parsed) purchaseDate = parsed;
            }

            // Save the lot
            saveLot({
                name,
                cost,
                quantity,
                purchaseDate
            });

            success++;
        } catch (e) {
            errors.push(`Row ${i + 2}: ${e.message}`);
        }
    }

    return { success, errors };
}

/**
 * Parse various date formats
 */
function parseDate(dateStr) {
    // Try common formats
    const formats = [
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,  // YYYY-MM-DD
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,   // MM-DD-YYYY
    ];

    for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
            try {
                let year, month, day;
                if (format === formats[0]) {
                    [, year, month, day] = match;
                } else {
                    [, month, day, year] = match;
                }
                const date = new Date(year, month - 1, day);
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
    return `name,cost,quantity,purchase_date
"Example Item 1",25.99,5,2024-01-15
"Example Item 2",10.50,10,2024-01-20
"Multi-pack Bundle",45.00,3,2024-02-01`;
}
