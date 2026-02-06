// OCR Service - Tesseract.js integration for Universal Receipt Parsing

import Tesseract from 'tesseract.js';

let worker = null;

// US State abbreviations for address detection
const STATE_ABBREVS = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Product indicator words - STRONG signals
const PRODUCT_INDICATORS = [
    'jacket', 'coat', 'blender', 'set', 'pack', 'wireless', 'leather', 'cotton',
    'kitchen', 'mixer', 'headphones', 'speaker', 'tablet', 'laptop', 'camera',
    'shoes', 'boots', 'sneakers', 'dress', 'shirt', 'pants', 'jeans',
    'watch', 'ring', 'necklace', 'bracelet', 'earbuds', 'charger', 'cable',
    'bag', 'backpack', 'wallet', 'purse', 'case', 'cover', 'stand', 'holder',
    'tool', 'drill', 'saw', 'vacuum', 'cleaner', 'iron', 'toaster', 'oven',
    'pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'edition', 'series',
    'womens', 'mens', 'women', 'men', 'kids', 'boys', 'girls',
    'front', 'back', 'zip', 'lined', 'fully', 'new', 'black', 'white', 'blue', 'red'
];

// Known brand names - STRONG signals
const KNOWN_BRANDS = [
    'cole haan', 'nike', 'adidas', 'apple', 'samsung', 'sony', 'lg', 'kitchenaid',
    'ninja', 'instant pot', 'cuisinart', 'dyson', 'shark', 'roomba', 'irobot',
    'north face', 'patagonia', 'columbia', 'levi', 'calvin klein', 'ralph lauren',
    'michael kors', 'coach', 'kate spade', 'gucci', 'prada', 'louis vuitton',
    'bose', 'jbl', 'beats', 'anker', 'logitech', 'razer', 'hp', 'dell', 'lenovo',
    'amazon basics', 'mainstays', 'better homes'
];

// Minimum score required to accept a candidate (prevents garbage)
const MIN_SCORE_THRESHOLD = 50;

async function initWorker() {
    if (worker) return worker;
    worker = await Tesseract.createWorker('eng', 1, {
        logger: () => { }
    });
    return worker;
}

export async function extractOrderData(image, onProgress = () => { }) {
    try {
        onProgress(10);
        const w = await initWorker();
        onProgress(30);
        const result = await w.recognize(image);
        onProgress(80);
        const text = result.data.text;

        // Debug: log raw OCR output to console
        console.log('[OCR] Raw text extracted:', text);

        const extractedData = parseReceiptText(text);
        onProgress(100);

        return {
            success: true,
            rawText: text,
            ...extractedData
        };
    } catch (error) {
        console.error('OCR failed:', error);
        return {
            success: false,
            error: error.message,
            rawText: '',
            name: 'Unnamed Item',
            cost: 0,
            quantity: 1
        };
    }
}

function looksLikeAddress(line) {
    const upper = line.toUpperCase();

    for (const state of STATE_ABBREVS) {
        const statePattern = new RegExp(`\\b${state}\\b`);
        if (statePattern.test(upper)) return true;
    }

    if (/\b\d{5}(-\d{4})?\b/.test(line)) return true;
    if (/ship(ping)?\s*to/i.test(line)) return true;
    if (/[A-Z][a-z]+\s+[A-Z][a-z]+\s*[—–-]\s*[A-Z]+/.test(line)) return true;

    return false;
}

function isExcludedLine(line) {
    const patterns = [
        /^sold\s+by/i,
        /^ships\s+from/i,
        /^fulfilled\s+by/i,
        /^order\s*[#:]/i,
        /^order\s+date/i,
        /^order\s+placed/i,
        /^order\s+number/i,
        /^arriving/i,
        /^delivered/i,
        /^tracking/i,
        /^condition:/i,
        /^color:/i,
        /^size:/i,
        /^gender:/i,
        /^quantity:/i,
        /\d+\s*@\s*\$?\d+/i,
        /\$\d+[.,]\d{2}.*\d+%/i,
        /\d+%\s*(off|discount)/i,
        /reference\s*price/i,
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d+/i,
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
        /^order\s+details$/i,
        /^help$/i
    ];
    return patterns.some(p => p.test(line.trim()));
}

function getProductIndicatorScore(line) {
    const lower = line.toLowerCase();
    let score = 0;

    // Check for product indicator words
    for (const indicator of PRODUCT_INDICATORS) {
        if (lower.includes(indicator)) {
            score += 30;
        }
    }

    // Check for known brand names (STRONG signal)
    for (const brand of KNOWN_BRANDS) {
        if (lower.includes(brand)) {
            score += 60;
        }
    }

    return score;
}

function isValidProductName(line) {
    // Must have multiple words
    const words = line.split(/\s+/).filter(w => w.length > 1);
    if (words.length < 2) return false;

    // Must have mostly letters (not numbers/symbols)
    const letterRatio = (line.match(/[a-zA-Z]/g) || []).length / line.length;
    if (letterRatio < 0.6) return false;

    // Should not be too short
    if (line.length < 15) return false;

    // Should start with a letter
    if (!/^[A-Za-z]/.test(line)) return false;

    return true;
}

function parseReceiptText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 1. Extract Price
    const pricePatterns = [
        /\$\s*(\d+[.,]\d{2})/,
        /USD\s*(\d+[.,]\d{2})/i,
        /Total[:\s]*\$?\s*(\d+[.,]\d{2})/i
    ];

    let cost = 0;
    for (const pattern of pricePatterns) {
        const match = text.match(pattern);
        if (match) {
            const price = parseFloat(match[1].replace(',', '.'));
            if (price > cost && price < 5000) {
                cost = price;
            }
        }
    }

    // 2. Extract Quantity
    const qtyPatterns = [
        /Qty[:\s]*(\d+)/i,
        /Quantity[:\s]*(\d+)/i,
        /(\d+)\s*@\s*\$/i
    ];

    let quantity = 1;
    for (const pattern of qtyPatterns) {
        const match = text.match(pattern);
        if (match) {
            quantity = parseInt(match[1], 10);
            break;
        }
    }

    // 3. Extract Product Name
    const uiExclusions = [
        'your orders', 'your account', 'buy again', 'cart', 'checkout',
        'subtotal', 'shipping', 'tax', 'total', 'payment',
        'track package', 'hello', 'sign in', 'home', 'menu', 'search',
        'amazon', 'target', 'walmart', 'prime', 'delivery', 'return',
        'customer service', 'my account', 'sign out', 'help', 'view order'
    ];

    const candidates = [];

    lines.forEach((line, index) => {
        // Clean line - remove special chars at start
        let cleanLine = line.replace(/^[|=\-*#@$%\s]+/, '').replace(/[|]+$/, '').trim();
        if (cleanLine.length < 12 || cleanLine.length > 120) return;

        // Basic validation
        if (!isValidProductName(cleanLine)) return;

        // UI Exclusion Filter
        const lowerLine = cleanLine.toLowerCase();
        if (uiExclusions.some(p => lowerLine.includes(p))) return;

        // Address Filter
        if (looksLikeAddress(cleanLine)) return;

        // Seller/Metadata Filter
        if (isExcludedLine(cleanLine)) return;

        // START SCORING
        let score = 0;

        // Product Indicator Bonus (includes brand detection)
        score += getProductIndicatorScore(cleanLine);

        // Length Bonus (ideal 20-70 chars)
        if (cleanLine.length >= 20 && cleanLine.length <= 70) score += 25;
        else if (cleanLine.length >= 15 && cleanLine.length <= 90) score += 10;

        // Word Count Bonus
        const wordCount = cleanLine.split(/\s+/).length;
        if (wordCount >= 4 && wordCount <= 12) score += 25;
        else if (wordCount >= 3) score += 10;

        // Starts with capital letter (brand name pattern)
        if (/^[A-Z][a-z]/.test(cleanLine)) score += 15;

        // Multiple capitalized words (brand + product pattern)
        const capitalizedWords = (cleanLine.match(/\b[A-Z][a-z]{2,}/g) || []).length;
        if (capitalizedWords >= 2) score += 20;

        // Contains parentheses with size info like (S), (M), (L), (XL)
        if (/\([SMLX]{1,2}\)|\(Small\)|\(Medium\)|\(Large\)/i.test(cleanLine)) score += 30;

        // Position bonus: middle section of document
        const position = index / lines.length;
        if (position >= 0.15 && position <= 0.55) score += 15;
        if (position < 0.08 || position > 0.85) score -= 25;

        candidates.push({ line: cleanLine, score, index });
    });

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Debug: log top candidates
    console.log('[OCR] Top candidates:', candidates.slice(0, 5).map(c => `"${c.line}" (score: ${c.score})`));

    // Find best valid candidate above threshold
    let bestName = 'Unnamed Item';
    for (const candidate of candidates) {
        if (candidate.score >= MIN_SCORE_THRESHOLD) {
            bestName = candidate.line;
            break;
        }
    }

    // If no good candidate found, log warning
    if (bestName === 'Unnamed Item') {
        console.warn('[OCR] No product name found above threshold. Please enter manually.');
    }

    return {
        name: bestName.substring(0, 100).trim(),
        cost,
        quantity: Math.max(1, quantity)
    };
}

export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function createThumbnail(base64, maxSize = 200) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = base64;
    });
}
