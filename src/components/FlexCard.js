// Flex Card - shareable "win" graphic for a sold item
// Renders a 840x570 card overlay with the item name, profit, and supporting stats.

import { formatCurrency } from '../services/calculations.js';

let flexData = null; // { name, lotNumber, profit, cost, revenue, roi, units, platform, dateSold }

const PLATFORM_LABELS = {
  amazon: 'Amazon',
  ebay: 'eBay',
  facebook: 'Facebook',
  walmart: 'Walmart',
  target: 'Target',
  woot: 'Woot',
  bestbuy: 'Best Buy'
};

/**
 * Build the flex payload from a lot + sale pair.
 * All money values are in cents, matching the rest of the app.
 */
export function buildFlexData(lot, sale) {
  const units = sale?.unitsSold || 0;
  const revenue = Number(sale?.totalPrice) || 0;
  const profit = Number(sale?.profit) || 0;
  const cost = (lot?.unitCost || 0) * units;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;

  return {
    name: lot?.name || 'Unknown Item',
    lotNumber: lot?.lotNumber || '',
    profit,
    cost,
    revenue,
    roi,
    units,
    platform: sale?.platform || '',
    dateSold: sale?.dateSold || ''
  };
}

export function openFlexCard(lot, sale) {
  flexData = buildFlexData(lot, sale);
  mountFlexCard();
}

/**
 * Roll every recorded sale on a lot into one card.
 * Cost counts only the units actually sold, so ROI reflects realized
 * performance rather than being diluted by unsold stock.
 */
export function buildLotFlexData(lot) {
  const sales = Array.isArray(lot?.sales) ? lot.sales : [];

  let units = 0, revenue = 0, profit = 0;
  const platforms = new Set();
  let firstDate = null, lastDate = null;

  sales.forEach(sale => {
    units += sale?.unitsSold || 0;
    revenue += Number(sale?.totalPrice) || 0;
    profit += Number(sale?.profit) || 0;
    if (sale?.platform) platforms.add(sale.platform.toLowerCase());

    const t = sale?.dateSold ? new Date(sale.dateSold) : null;
    if (t && !isNaN(t.getTime())) {
      if (!firstDate || t < firstDate) firstDate = t;
      if (!lastDate || t > lastDate) lastDate = t;
    }
  });

  const cost = (lot?.unitCost || 0) * units;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;
  const totalUnits = (lot?.remaining || 0) + units;

  // Meta line: how long the lot took to move, and where it sold
  const parts = [];
  if (sales.length) parts.push(`${sales.length} sale${sales.length === 1 ? '' : 's'}`);
  if (platforms.size === 1) {
    parts.push(PLATFORM_LABELS[[...platforms][0]] || [...platforms][0]);
  } else if (platforms.size > 1) {
    parts.push(`${platforms.size} platforms`);
  }
  // A span only means something across multiple sales
  if (firstDate && lastDate && sales.length > 1) {
    const span = Math.max(0, Math.round((lastDate - firstDate) / 86400000));
    parts.push(span === 0 ? 'same day' : `${span}d span`);
  }

  const soldOut = (lot?.remaining || 0) === 0 && units > 0;

  return {
    name: lot?.name || 'Unknown Item',
    lotNumber: lot?.lotNumber || '',
    profit,
    cost,
    revenue,
    roi,
    units,
    metaOverride: parts.join(' · '),
    heroLabel: 'TOTAL NET',
    tag: soldOut ? 'SOLD OUT' : 'LOT',
    stats: [
      ['ROI', formatRoi(roi), true],
      ['Total Cost', formatCurrency(cost), false],
      ['Revenue', formatCurrency(revenue), false],
      ['Units Sold', totalUnits > 0 ? `${units} / ${totalUnits}` : String(units), false]
    ]
  };
}

export function openLotFlexCard(lot) {
  flexData = buildLotFlexData(lot);
  mountFlexCard();
}

export function closeFlexCard() {
  const overlay = document.getElementById('flex-card-overlay');
  if (!overlay) {
    flexData = null;
    return;
  }
  overlay.classList.add('closing');
  overlay.addEventListener('animationend', () => {
    overlay.remove();
    flexData = null;
  }, { once: true });
  // Fallback in case the animation never fires
  setTimeout(() => {
    if (document.getElementById('flex-card-overlay') === overlay) {
      overlay.remove();
      flexData = null;
    }
  }, 400);
}

function formatRoi(roi) {
  const sign = roi >= 0 ? '+' : '−';
  const abs = Math.abs(roi);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${sign}${abs.toFixed(digits)}%`;
}

/**
 * Stat rows for the card, as [label, value, useAccentColor] tuples.
 * Shared by the DOM card and the canvas export so the two never drift apart.
 */
function buildStats(d) {
  if (d.stats) return d.stats;

  const rows = [
    ['ROI', formatRoi(d.roi), true],
    ['Cost', formatCurrency(d.cost), false],
    ['Sold For', formatCurrency(d.revenue), false]
  ];
  if (d.units > 1) rows.push(['Units', String(d.units), false]);
  return rows;
}

/**
 * The bar sizes itself to the value, so this only kicks in for extreme amounts
 * that would otherwise push it past the text column. Matches the canvas export.
 */
function heroSizeClass(text) {
  return text.length >= 13 ? 'is-xlong' : '';
}

function formatFlexDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Decorative right-side artwork: a stack of boxes with a rising trend beam. */
function renderArtwork(isProfit) {
  const beam = isProfit ? 'flex-beam-up' : 'flex-beam-down';
  return `
    <svg class="flex-art" viewBox="0 0 320 570" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="flexBoxFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
        </linearGradient>
        <linearGradient id="flexBoxTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
        </linearGradient>
        <linearGradient id="flexGlow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--flex-accent)" stop-opacity="0"/>
          <stop offset="55%" stop-color="var(--flex-accent)" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="var(--flex-accent)" stop-opacity="0.95"/>
        </linearGradient>
        <radialGradient id="flexHalo" cx="0.62" cy="0.42" r="0.6">
          <stop offset="0%" stop-color="var(--flex-accent)" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="var(--flex-accent)" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <ellipse cx="196" cy="248" rx="190" ry="200" fill="url(#flexHalo)"/>

      <!-- rising trend beam -->
      <g class="${beam}">
        <path d="M46 452 L142 356 L206 404 L300 268" stroke="url(#flexGlow)" stroke-width="10"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
        <circle cx="300" cy="268" r="11" fill="var(--flex-accent)"/>
        <circle cx="300" cy="268" r="21" fill="var(--flex-accent)" opacity="0.22"/>
      </g>

      <!-- stacked shipping boxes, isometric -->
      <g class="flex-boxes">
        <g class="flex-box flex-box-back">
          <path d="M96 236 L166 200 L236 236 L166 272 Z" fill="url(#flexBoxTop)"/>
          <path d="M96 236 L166 272 L166 356 L96 320 Z" fill="url(#flexBoxFace)"/>
          <path d="M236 236 L166 272 L166 356 L236 320 Z" fill="rgba(0,0,0,0.34)"/>
          <path d="M131 218 L201 254 L201 268 L131 232 Z" fill="var(--flex-accent)" opacity="0.5"/>
        </g>
        <g class="flex-box flex-box-front">
          <path d="M112 330 L176 298 L240 330 L176 362 Z" fill="url(#flexBoxTop)"/>
          <path d="M112 330 L176 362 L176 440 L112 408 Z" fill="url(#flexBoxFace)"/>
          <path d="M240 330 L176 362 L176 440 L240 408 Z" fill="rgba(0,0,0,0.34)"/>
          <path d="M144 314 L208 346 L208 360 L144 328 Z" fill="var(--flex-accent)" opacity="0.62"/>
        </g>
      </g>

      <!-- drifting sparks -->
      <g class="flex-sparks">
        <circle cx="72" cy="150" r="3" fill="var(--flex-accent)" opacity="0.55"/>
        <circle cx="268" cy="140" r="4" fill="var(--flex-accent)" opacity="0.4"/>
        <circle cx="292" cy="470" r="3" fill="var(--flex-accent)" opacity="0.45"/>
        <circle cx="56" cy="392" r="2.5" fill="var(--flex-accent)" opacity="0.4"/>
      </g>
    </svg>
  `;
}

function renderFlexCard() {
  const d = flexData;
  const isProfit = d.profit >= 0;
  const platformLabel = PLATFORM_LABELS[d.platform?.toLowerCase()] || '';
  const dateLabel = formatFlexDate(d.dateSold);
  const metaBits = d.metaOverride || [platformLabel, dateLabel].filter(Boolean).join(' · ');
  const heroText = formatCurrency(d.profit, true);

  return `
    <div class="flex-card-overlay ${isProfit ? 'is-profit' : 'is-loss'}" id="flex-card-overlay">
      <div class="flex-card-shell" role="dialog" aria-modal="true" aria-label="Sale summary card">
        <div class="flex-card" id="flex-card-capture">
          <div class="flex-card-bg"></div>

          <div class="flex-card-body">
            <div class="flex-card-item" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>
            ${metaBits ? `<div class="flex-card-submeta">${escapeHtml(metaBits)}</div>` : ''}

            <div class="flex-card-hero">
              <span class="flex-hero-label">${escapeHtml(d.heroLabel || 'NET')}</span>
              <span class="flex-hero-value ${heroSizeClass(heroText)}">${heroText}</span>
            </div>

            <div class="flex-card-stats">
              ${buildStats(d).map(([label, value, isAccent]) => `
                <div class="flex-stat">
                  <span class="flex-stat-label">${escapeHtml(label)}</span>
                  <span class="flex-stat-value ${isAccent ? 'flex-stat-accent' : ''}">${escapeHtml(value)}</span>
                </div>
              `).join('')}
            </div>

          </div>

          ${renderArtwork(isProfit)}
        </div>

        <div class="flex-card-actions">
          <button class="flex-action-btn" id="flex-copy-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Image</span>
          </button>
          <button class="flex-action-btn" id="flex-download-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download</span>
          </button>
          <button class="flex-action-btn flex-action-close" id="flex-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mountFlexCard() {
  document.getElementById('flex-card-overlay')?.remove();

  const host = document.createElement('div');
  host.innerHTML = renderFlexCard();
  const overlay = host.firstElementChild;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFlexCard();
  });

  document.getElementById('flex-close-btn')?.addEventListener('click', closeFlexCard);
  document.getElementById('flex-download-btn')?.addEventListener('click', () => exportCard('download'));
  document.getElementById('flex-copy-btn')?.addEventListener('click', () => exportCard('copy'));

  const onKey = (e) => {
    if (e.key === 'Escape') {
      closeFlexCard();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
}

/* ---------- Image export ---------- */

function setBtnState(btn, text) {
  if (!btn) return;
  const span = btn.querySelector('span');
  const original = span ? span.textContent : btn.textContent;
  if (span) span.textContent = text; else btn.textContent = text;
  setTimeout(() => {
    if (span) span.textContent = original; else btn.textContent = original;
  }, 1800);
}

async function exportCard(mode) {
  const btn = document.getElementById(mode === 'copy' ? 'flex-copy-btn' : 'flex-download-btn');
  try {
    const blob = await renderCardToBlob();
    if (!blob) throw new Error('render failed');

    if (mode === 'copy') {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('clipboard unsupported');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setBtnState(btn, 'Copied!');
    } else {
      const safeName = (flexData?.name || 'sale').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vision-flex-${safeName || 'sale'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBtnState(btn, 'Saved!');
    }
  } catch (err) {
    console.error('Flex card export failed:', err);
    setBtnState(btn, 'Failed');
  }
}

/**
 * Draw the card to a canvas at 2x and return a PNG blob.
 * Drawn manually (rather than DOM rasterization) so the export
 * does not depend on an external html2canvas-style library.
 */
function renderCardToBlob() {
  const d = flexData;
  if (!d) return Promise.resolve(null);

  const W = 840, H = 570, S = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);

  const isProfit = d.profit >= 0;
  const accent = isProfit ? '#34D399' : '#F87171';
  const accentDim = isProfit ? 'rgba(52,211,153,' : 'rgba(248,113,113,';

  // Background
  ctx.fillStyle = '#0E0F10';
  ctx.fillRect(0, 0, W, H);

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, 'rgba(255,255,255,0.035)');
  bgGrad.addColorStop(0.55, 'rgba(255,255,255,0.012)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Accent halo behind the artwork
  const halo = ctx.createRadialGradient(640, 250, 20, 640, 250, 300);
  halo.addColorStop(0, accentDim + '0.20)');
  halo.addColorStop(1, accentDim + '0)');
  ctx.fillStyle = halo;
  ctx.fillRect(380, 0, W - 380, H);

  drawArtwork(ctx, accent, isProfit);

  const PAD = 52;

  ctx.textBaseline = 'alphabetic';

  ctx.font = '700 44px "DM Sans", system-ui, sans-serif';
  const nameLines = wrapText(ctx, d.name.toUpperCase(), 430, 2);

  const platformLabel = PLATFORM_LABELS[d.platform?.toLowerCase()] || '';
  const dateLabel = formatFlexDate(d.dateSold);
  const metaBits = d.metaOverride || [platformLabel, dateLabel].filter(Boolean).join('  ·  ');

  // Center the whole text block vertically, matching the on-screen card
  const statCount = buildStats(d).length;
  const blockH = nameLines.length * 50 + (metaBits ? 30 : 0) + 18 + 82 + 52 + (statCount - 1) * 40;
  let y = Math.max(96, Math.round((H - blockH) / 2) + 44);

  // Item name (wraps to 2 lines max)
  ctx.fillStyle = '#FFFFFF';
  nameLines.forEach(line => {
    ctx.fillText(line, PAD, y);
    y += 50;
  });

  // Sub meta
  if (metaBits) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText(metaBits, PAD, y - 12);
  }

  // Hero profit bar. Sized to the value it holds, so the block is exactly as
  // wide as the number rather than leaving dead space beside short amounts.
  const heroY = y + (metaBits ? 18 : 0);
  const heroH = 82;
  const heroText = formatCurrency(d.profit, true);
  const heroPadX = 28;

  // Only step down for extreme amounts that would push the bar past the text column
  let heroSize = 46;
  ctx.font = `700 ${heroSize}px "JetBrains Mono", "SF Mono", monospace`;
  while (ctx.measureText(heroText).width + heroPadX * 2 > 440 && heroSize > 26) {
    heroSize -= 2;
    ctx.font = `700 ${heroSize}px "JetBrains Mono", "SF Mono", monospace`;
  }

  const heroLabel = d.heroLabel || 'NET';
  const heroValueW = ctx.measureText(heroText).width;
  ctx.font = '600 15px "DM Sans", system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  const heroLabelW = ctx.measureText(heroLabel).width;
  ctx.letterSpacing = '0px';

  const heroW = Math.max(heroValueW, heroLabelW) + heroPadX * 2;

  ctx.fillStyle = accent;
  roundRect(ctx, PAD, heroY, heroW, heroH, 6);
  ctx.fill();

  ctx.fillStyle = 'rgba(10,12,12,0.62)';
  ctx.font = '600 15px "DM Sans", system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(heroLabel, PAD + heroPadX, heroY + 34);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#0B0D0D';
  ctx.font = `700 ${heroSize}px "JetBrains Mono", "SF Mono", monospace`;
  ctx.fillText(heroText, PAD + heroPadX, heroY + 66);

  // Stats rows
  const stats = buildStats(d);

  let sy = heroY + heroH + 52;
  const statStep = 40;
  stats.forEach(([label, value, isAccent]) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 21px "DM Sans", system-ui, sans-serif';
    ctx.fillText(label, PAD, sy);

    ctx.fillStyle = isAccent ? accent : '#FFFFFF';
    ctx.font = '600 21px "JetBrains Mono", "SF Mono", monospace';
    ctx.fillText(value, PAD + 168, sy);
    sy += statStep;
  });

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function drawArtwork(ctx, accent, isProfit) {
  ctx.save();
  ctx.translate(520, 0);

  // Trend beam
  const beamGrad = ctx.createLinearGradient(46, 452, 300, 268);
  beamGrad.addColorStop(0, hexToRgba(accent, 0));
  beamGrad.addColorStop(0.55, hexToRgba(accent, 0.5));
  beamGrad.addColorStop(1, hexToRgba(accent, 0.95));

  ctx.strokeStyle = beamGrad;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (isProfit) {
    ctx.moveTo(46, 452); ctx.lineTo(142, 356); ctx.lineTo(206, 404); ctx.lineTo(300, 268);
  } else {
    ctx.moveTo(46, 268); ctx.lineTo(142, 364); ctx.lineTo(206, 316); ctx.lineTo(300, 452);
  }
  ctx.stroke();

  const tipX = 300, tipY = isProfit ? 268 : 452;
  ctx.fillStyle = hexToRgba(accent, 0.22);
  ctx.beginPath(); ctx.arc(tipX, tipY, 21, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(tipX, tipY, 11, 0, Math.PI * 2); ctx.fill();

  // Boxes
  drawBox(ctx, [[96, 236], [166, 200], [236, 236], [166, 272]],
    [[96, 236], [166, 272], [166, 356], [96, 320]],
    [[236, 236], [166, 272], [166, 356], [236, 320]],
    [[131, 218], [201, 254], [201, 268], [131, 232]], accent, 0.5);

  drawBox(ctx, [[112, 330], [176, 298], [240, 330], [176, 362]],
    [[112, 330], [176, 362], [176, 440], [112, 408]],
    [[240, 330], [176, 362], [176, 440], [240, 408]],
    [[144, 314], [208, 346], [208, 360], [144, 328]], accent, 0.62);

  // Sparks
  [[72, 150, 3, 0.55], [268, 140, 4, 0.4], [292, 470, 3, 0.45], [56, 392, 2.5, 0.4]].forEach(([x, cy, r, a]) => {
    ctx.fillStyle = hexToRgba(accent, a);
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

function drawBox(ctx, top, left, right, tape, accent, tapeAlpha) {
  const topGrad = ctx.createLinearGradient(0, 190, 0, 280);
  topGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
  topGrad.addColorStop(1, 'rgba(255,255,255,0.06)');
  fillPoly(ctx, top, topGrad);

  const faceGrad = ctx.createLinearGradient(90, 230, 240, 440);
  faceGrad.addColorStop(0, 'rgba(255,255,255,0.14)');
  faceGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
  fillPoly(ctx, left, faceGrad);

  fillPoly(ctx, right, 'rgba(0,0,0,0.34)');
  fillPoly(ctx, tape, hexToRgba(accent, tapeAlpha));
}

function fillPoly(ctx, pts, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }

  // Whatever remains goes on the final line, truncated with an ellipsis if needed
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  let rest = words.slice(consumed).join(' ');
  if (!rest) rest = line;

  if (ctx.measureText(rest).width > maxWidth) {
    while (rest && ctx.measureText(rest + '…').width > maxWidth) {
      rest = rest.slice(0, -1);
    }
    rest = rest.replace(/\s+$/, '') + '…';
  }
  lines.push(rest);

  return lines.slice(0, maxLines);
}
