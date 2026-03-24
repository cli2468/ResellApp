import {
  calculateChurningStats,
  formatCurrency,
  formatDate,
  getChurningOrdersForMonth,
  isChurningTrackingOverdue
} from '../services/calculations.js';
import {
  deleteChurnCard,
  deleteChurningOrder,
  getChurnCards,
  getChurningOrderById,
  getChurningOrders,
  saveChurnCard,
  saveChurningOrder,
  updateChurnCard,
  updateChurningOrder
} from '../services/storage.js';
import { confirmAction, showToast } from '../services/feedback.js';

const FILTER_OPTIONS = [
  { key: 'active', label: 'Active' },
  { key: 'awaiting-tracking', label: 'Need Tracking' },
  { key: 'awaiting-payment', label: 'Awaiting Payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All Orders' }
];

let selectedFilter = 'active';
let editingOrderId = null;
let editingCardId = null;
let orderDraft = createOrderDraft();
let cardDraft = createCardDraft();

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function createOrderDraft(overrides = {}) {
  return {
    store: '',
    purchaseAmount: '',
    reimbursementAmount: '',
    cardId: '',
    purchaseDate: todayStr(),
    ...overrides
  };
}

function createCardDraft(overrides = {}) {
  return {
    name: '',
    cashbackRate: '',
    cashbackType: 'statement-credit',
    ...overrides
  };
}

function centsToInput(cents) {
  const value = Number(cents) || 0;
  return (value / 100).toFixed(2);
}

function dollarsToCents(value) {
  return Math.round((Number(value) || 0) * 100);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getCashbackTypeLabel(type) {
  return type === 'points' ? 'Points' : 'Statement Credit';
}

function getFilterCount(filterKey, orders) {
  return filterOrders(orders, filterKey).length;
}

function filterOrders(orders, filterKey) {
  switch (filterKey) {
    case 'awaiting-tracking':
      return orders.filter((order) => !order.trackingUploaded);
    case 'awaiting-payment':
      return orders.filter((order) => !order.paid);
    case 'paid':
      return orders.filter((order) => order.paid);
    case 'active':
      return orders.filter((order) => !order.paid);
    case 'all':
    default:
      return orders;
  }
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => {
    const dateA = new Date(`${a.purchaseDate || todayStr()}T12:00:00`).getTime();
    const dateB = new Date(`${b.purchaseDate || todayStr()}T12:00:00`).getTime();
    return dateB - dateA;
  });
}

function getSelectedCardId(cards) {
  return orderDraft.cardId || cards[0]?.id || '';
}

function getOrderStatusLabel(order) {
  if (order.paid) return 'Paid';
  if (isChurningTrackingOverdue(order)) return 'Tracking overdue';
  return 'Open';
}

function renderMetricCard(label, value, detail, accentClass = '') {
  return `
    <div class="churn-stat-card ${accentClass}">
      <div class="churn-stat-label">${label}</div>
      <div class="churn-stat-value">${value}</div>
      <div class="churn-stat-detail">${detail}</div>
    </div>
  `;
}

function renderSignalBar(stats) {
  const signals = [];

  if (stats.trackingOverdueCount > 0) {
    signals.push(`<span class="churn-signal urgent">${stats.trackingOverdueCount} overdue for tracking</span>`);
  }

  if (stats.pendingTrackingCount > 0) {
    signals.push(`<span class="churn-signal">${stats.pendingTrackingCount} orders still need tracking uploaded</span>`);
  }

  if (stats.pendingPaymentCount > 0) {
    signals.push(`<span class="churn-signal warning">${stats.pendingPaymentCount} orders are awaiting payment</span>`);
  }

  if (signals.length === 0) {
    signals.push('<span class="churn-signal success">No open churning tasks right now.</span>');
  }

  return `
    <div class="churn-signal-row">
      ${signals.join('')}
    </div>
  `;
}

function renderWallet(cards, orders) {
  if (cards.length === 0) {
    return `
      <div class="churn-wallet-empty">
        <div class="churn-panel-heading">Wallet</div>
        <p>Add your first card so new orders can snapshot the right cashback rate.</p>
      </div>
    `;
  }

  const cardsHtml = cards.map((card) => {
    const linkedOrders = orders.filter((order) => order.cardId === card.id).length;
    const isEditing = editingCardId === card.id;

    return `
      <article class="churn-wallet-card ${isEditing ? 'is-editing' : ''}">
        <div class="churn-wallet-top">
          <div>
            <div class="churn-wallet-name">${escapeHtml(card.name)}</div>
            <div class="churn-wallet-meta">${getCashbackTypeLabel(card.cashbackType)}</div>
          </div>
          <div class="churn-wallet-rate">${Number(card.cashbackRate).toFixed(2)}%</div>
        </div>
        <div class="churn-wallet-footer">
          <span>${linkedOrders} linked order${linkedOrders === 1 ? '' : 's'}</span>
          <div class="churn-inline-actions">
            <button class="churn-text-btn" type="button" data-edit-card="${card.id}">Edit</button>
            <button class="churn-text-btn danger" type="button" data-delete-card="${card.id}">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="churn-wallet-stack">
      <div class="churn-panel-heading">Wallet</div>
      ${cardsHtml}
    </div>
  `;
}

function renderCardForm() {
  return `
    <section class="churn-panel">
      <div class="churn-panel-header">
        <div>
          <div class="churn-panel-eyebrow">Cards</div>
          <h2 class="churn-panel-title">${editingCardId ? 'Update card' : 'Add a card'}</h2>
        </div>
      </div>

      <form id="churn-card-form">
        <div class="form-group">
          <label class="form-label" for="churn-card-name">Card Name</label>
          <input class="form-input" id="churn-card-name" type="text" value="${escapeHtml(cardDraft.name)}" placeholder="Amex Gold" />
        </div>

        <div class="churn-form-grid two-up">
          <div class="form-group">
            <label class="form-label" for="churn-card-rate">Cashback %</label>
            <input class="form-input" id="churn-card-rate" type="number" min="0" step="0.01" value="${escapeHtml(cardDraft.cashbackRate)}" placeholder="4.00" />
          </div>

          <div class="form-group">
            <label class="form-label" for="churn-card-type">Reward Type</label>
            <select class="form-input" id="churn-card-type">
              <option value="statement-credit" ${cardDraft.cashbackType === 'statement-credit' ? 'selected' : ''}>Statement Credit</option>
              <option value="points" ${cardDraft.cashbackType === 'points' ? 'selected' : ''}>Points for Cash</option>
            </select>
          </div>
        </div>

        <div class="churn-form-actions">
          <button class="btn btn-primary" type="submit">${editingCardId ? 'Update Card' : 'Save Card'}</button>
          ${editingCardId ? '<button class="btn btn-secondary" type="button" id="cancel-card-edit">Cancel</button>' : ''}
        </div>
      </form>
    </section>
  `;
}

function renderOrderComposer(cards) {
  const selectedCardId = getSelectedCardId(cards);

  return `
    <section class="churn-panel">
      <div class="churn-panel-header">
        <div>
          <div class="churn-panel-eyebrow">Orders</div>
          <h2 class="churn-panel-title">${editingOrderId ? 'Update order' : 'Log an order'}</h2>
        </div>
        <div class="churn-panel-note">Profit = reimbursement delta + card rewards.</div>
      </div>

      <form id="churn-order-form">
        <div class="churn-form-grid three-up">
          <div class="form-group">
            <label class="form-label" for="churn-store">Store</label>
            <input class="form-input" id="churn-store" type="text" value="${escapeHtml(orderDraft.store)}" placeholder="Amazon" />
          </div>

          <div class="form-group">
            <label class="form-label" for="churn-card-select">Card Used</label>
            <select class="form-input" id="churn-card-select" ${cards.length === 0 ? 'disabled' : ''}>
              ${cards.length === 0
                ? '<option value="">Add a card first</option>'
                : cards.map((card) => `
                    <option value="${card.id}" ${card.id === selectedCardId ? 'selected' : ''}>
                      ${escapeHtml(card.name)} · ${Number(card.cashbackRate).toFixed(2)}%
                    </option>
                  `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="churn-purchase-date">Purchase Date</label>
            <input class="form-input" id="churn-purchase-date" type="date" value="${escapeHtml(orderDraft.purchaseDate)}" />
          </div>
        </div>

        <div class="churn-form-grid two-up">
          <div class="form-group">
            <label class="form-label" for="churn-purchase-amount">Purchase Amount</label>
            <div class="input-with-prefix">
              <span class="input-prefix">$</span>
              <input class="form-input" id="churn-purchase-amount" type="number" min="0" step="0.01" value="${escapeHtml(orderDraft.purchaseAmount)}" placeholder="0.00" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="churn-reimbursement-amount">Reimbursement</label>
            <div class="input-with-prefix">
              <span class="input-prefix">$</span>
              <input class="form-input" id="churn-reimbursement-amount" type="number" min="0" step="0.01" value="${escapeHtml(orderDraft.reimbursementAmount)}" placeholder="Defaults to purchase amount" />
            </div>
          </div>
        </div>

        <div class="churn-form-actions">
          <button class="btn btn-primary" type="submit" ${cards.length === 0 ? 'disabled' : ''}>${editingOrderId ? 'Update Order' : 'Save Order'}</button>
          ${editingOrderId ? '<button class="btn btn-secondary" type="button" id="cancel-order-edit">Cancel</button>' : ''}
        </div>
      </form>
    </section>
  `;
}

function renderFilters(orders) {
  return `
    <div class="churn-filter-row">
      ${FILTER_OPTIONS.map((filter) => `
        <button
          type="button"
          class="churn-filter-chip ${selectedFilter === filter.key ? 'active' : ''}"
          data-churn-filter="${filter.key}"
          aria-pressed="${selectedFilter === filter.key ? 'true' : 'false'}"
        >
          ${filter.label}
          <span>${getFilterCount(filter.key, orders)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderOrderList(orders) {
  if (orders.length === 0) {
    return `
      <div class="churn-empty-state">
        <div class="empty-state-inner">
          <h3 class="empty-state-title">No churning orders yet</h3>
          <p class="empty-state-desc">Your orders will show reimbursement math, cashback profit, and task status here.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="churn-order-stack">
      ${orders.map(renderOrderCard).join('')}
    </div>
  `;
}

function renderOrderCard(order) {
  const overdueTracking = isChurningTrackingOverdue(order);
  const statusClass = order.paid ? 'paid' : overdueTracking ? 'overdue' : 'open';

  return `
    <article class="churn-order-card ${statusClass}">
      <div class="churn-order-top">
        <div>
          <div class="churn-order-store">${escapeHtml(order.store)}</div>
          <div class="churn-order-meta">
            ${escapeHtml(order.cardName || 'Unknown Card')} · ${Number(order.cashbackRate || 0).toFixed(2)}% · Bought ${formatDate(order.purchaseDate, 'long')}
          </div>
          <div class="churn-order-status-copy">${getOrderStatusLabel(order)}</div>
        </div>
        <div class="churn-order-profit">
          <span>Net profit</span>
          <strong class="${order.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(order.profit, true)}</strong>
        </div>
      </div>

      <div class="churn-order-metrics">
        <div>
          <span>Purchase</span>
          <strong>${formatCurrency(order.purchaseAmount)}</strong>
        </div>
        <div>
          <span>Reimbursed</span>
          <strong>${formatCurrency(order.reimbursementAmount)}</strong>
        </div>
        <div>
          <span>Cashback</span>
          <strong>${formatCurrency(order.cashbackAmount, true)}</strong>
        </div>
        <div>
          <span>${order.paid ? 'Paid on' : 'Payment'}</span>
          <strong>${order.paidDate ? formatDate(order.paidDate, 'long') : (order.paid ? 'Marked paid' : 'Pending')}</strong>
        </div>
      </div>

      <div class="churn-status-row">
        <button class="churn-status-pill ${order.trackingUploaded ? 'done' : ''}" type="button" data-toggle-status="trackingUploaded" data-order-id="${order.id}" aria-pressed="${order.trackingUploaded ? 'true' : 'false'}">
          Tracking uploaded
        </button>
        <button class="churn-status-pill ${order.delivered ? 'done' : ''}" type="button" data-toggle-status="delivered" data-order-id="${order.id}" aria-pressed="${order.delivered ? 'true' : 'false'}">
          Delivered
        </button>
        <button class="churn-status-pill ${order.paid ? 'done' : ''}" type="button" data-toggle-status="paid" data-order-id="${order.id}" aria-pressed="${order.paid ? 'true' : 'false'}">
          Paid
        </button>
      </div>

      <div class="churn-order-footer">
        <div class="churn-order-flags">
          ${overdueTracking ? '<span class="churn-flag urgent">Tracking overdue</span>' : ''}
          ${!order.paid ? '<span class="churn-flag">Awaiting payment</span>' : '<span class="churn-flag success">Settled</span>'}
        </div>
        <div class="churn-inline-actions">
          <button class="churn-text-btn" type="button" data-edit-order="${order.id}">Edit</button>
          <button class="churn-text-btn danger" type="button" data-delete-order="${order.id}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderWalletColumn(cards, orders) {
  return `
    <aside class="churn-side-column">
      <section class="churn-panel">
        ${renderWallet(cards, orders)}
      </section>
      ${renderCardForm()}
    </aside>
  `;
}

function renderOrdersColumn(cards, orders) {
  const filteredOrders = filterOrders(orders, selectedFilter);

  return `
    <div class="churn-main-column">
      ${renderOrderComposer(cards)}
      ${renderFilters(orders)}
      ${renderOrderList(filteredOrders)}
    </div>
  `;
}

export function ChurningView() {
  const cards = getChurnCards();
  const orders = sortOrders(getChurningOrders());
  const selectedCardId = getSelectedCardId(cards);
  const monthlyOrders = getChurningOrdersForMonth(orders);
  const monthlyStats = calculateChurningStats(monthlyOrders);
  const allStats = calculateChurningStats(orders);
  const isDesktopView = window.innerWidth >= 1024;
  const ordersColumn = renderOrdersColumn(cards, orders);
  const walletColumn = renderWalletColumn(cards, orders);

  return `
    <div class="page churning-page">
      <div class="container">
        <section class="churn-hero">
          <div class="churn-hero-copy">
            <div class="churn-eyebrow">Cashback Arbitrage</div>
            <h1 class="churn-title">Churning</h1>
            <p class="churn-subtitle">Track buy-group purchases, reimbursements, and card rewards without duplicating the rest of your workflow.</p>
          </div>

          <div class="churn-stats-grid">
            ${renderMetricCard('This Month', formatCurrency(monthlyStats.totalProfit, true), `${monthlyStats.orderCount} order${monthlyStats.orderCount === 1 ? '' : 's'} logged`, 'accent-profit')}
            ${renderMetricCard('Cash Tied Up', formatCurrency(allStats.outstandingPurchaseVolume), `${allStats.pendingPaymentCount} order${allStats.pendingPaymentCount === 1 ? '' : 's'} awaiting payment`)}
            ${renderMetricCard('Tracking Queue', String(allStats.pendingTrackingCount), `${allStats.trackingOverdueCount} overdue after 3 days`, allStats.trackingOverdueCount > 0 ? 'accent-warning' : '')}
            ${renderMetricCard('Cards In Wallet', String(cards.length), selectedCardId ? `${cards.find((card) => card.id === selectedCardId)?.name || cards[0]?.name || ''}` : 'Add a card to start')}
          </div>
        </section>

        ${renderSignalBar(allStats)}

        <div class="churn-layout">
          ${isDesktopView ? walletColumn + ordersColumn : ordersColumn + walletColumn}
        </div>
      </div>
    </div>
  `;
}

function startEditingCard(cardId) {
  const card = getChurnCards().find((entry) => entry.id === cardId);
  if (!card) return;

  editingCardId = cardId;
  cardDraft = createCardDraft({
    name: card.name || '',
    cashbackRate: Number(card.cashbackRate || 0).toFixed(2),
    cashbackType: card.cashbackType || 'statement-credit'
  });
  window.dispatchEvent(new CustomEvent('viewchange'));
}

function startEditingOrder(orderId) {
  const order = getChurningOrderById(orderId);
  if (!order) return;

  editingOrderId = orderId;
  orderDraft = createOrderDraft({
    store: order.store || '',
    purchaseAmount: centsToInput(order.purchaseAmount),
    reimbursementAmount: centsToInput(order.reimbursementAmount),
    cardId: order.cardId || '',
    purchaseDate: order.purchaseDate || todayStr()
  });
  window.dispatchEvent(new CustomEvent('viewchange'));
}

function resetCardComposer() {
  editingCardId = null;
  cardDraft = createCardDraft();
}

function resetOrderComposer() {
  editingOrderId = null;
  orderDraft = createOrderDraft();
}

function toggleOrderStatus(orderId, statusKey) {
  const order = getChurningOrderById(orderId);
  if (!order) return;

  const nextValue = !order[statusKey];
  const updates = { [statusKey]: nextValue };

  if (statusKey === 'paid') {
    updates.paidDate = nextValue ? todayStr() : null;
  }

  updateChurningOrder(orderId, updates);
  window.dispatchEvent(new CustomEvent('viewchange'));
}

export function initChurningEvents() {
  document.getElementById('cancel-card-edit')?.addEventListener('click', () => {
    resetCardComposer();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  document.getElementById('cancel-order-edit')?.addEventListener('click', () => {
    resetOrderComposer();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  document.getElementById('churn-card-form')?.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('churn-card-name')?.value.trim() || '';
    const cashbackRate = document.getElementById('churn-card-rate')?.value || '';
    const cashbackType = document.getElementById('churn-card-type')?.value || 'statement-credit';

    if (!name || Number(cashbackRate) <= 0) {
      showToast('Add a card name and a cashback rate greater than 0.', {
        variant: 'error',
        title: 'Card details'
      });
      return;
    }

    if (editingCardId) {
      updateChurnCard(editingCardId, { name, cashbackRate: Number(cashbackRate), cashbackType });
    } else {
      saveChurnCard({ name, cashbackRate: Number(cashbackRate), cashbackType });
    }

    resetCardComposer();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  document.getElementById('churn-order-form')?.addEventListener('submit', (event) => {
    event.preventDefault();

    const store = document.getElementById('churn-store')?.value.trim() || '';
    const purchaseAmountInput = document.getElementById('churn-purchase-amount')?.value || '';
    const reimbursementAmountInput = document.getElementById('churn-reimbursement-amount')?.value || purchaseAmountInput;
    const cardId = document.getElementById('churn-card-select')?.value || '';
    const purchaseDate = document.getElementById('churn-purchase-date')?.value || todayStr();

    if (!store || !cardId) {
      showToast('Choose a store and card before saving an order.', {
        variant: 'error',
        title: 'Order details'
      });
      return;
    }

    const purchaseAmount = dollarsToCents(purchaseAmountInput);
    const reimbursementAmount = dollarsToCents(reimbursementAmountInput);

    if (purchaseAmount <= 0) {
      showToast('Enter a purchase amount greater than 0.', {
        variant: 'error',
        title: 'Order details'
      });
      return;
    }

    const payload = {
      store,
      purchaseAmount,
      reimbursementAmount,
      cardId,
      purchaseDate
    };

    if (editingOrderId) {
      updateChurningOrder(editingOrderId, payload);
    } else {
      saveChurningOrder(payload);
    }

    resetOrderComposer();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  document.querySelectorAll('[data-churn-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedFilter = button.dataset.churnFilter;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  document.querySelectorAll('[data-edit-card]').forEach((button) => {
    button.addEventListener('click', () => {
      startEditingCard(button.dataset.editCard);
    });
  });

  document.querySelectorAll('[data-delete-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const cardId = button.dataset.deleteCard;
      const shouldDelete = await confirmAction({
        title: 'Delete card',
        message: 'Delete this card from your wallet?',
        confirmLabel: 'Delete card',
        tone: 'danger'
      });
      if (!shouldDelete) return;

      const deleted = deleteChurnCard(cardId);
      if (!deleted) {
        showToast('This card is already linked to existing orders and cannot be deleted yet.', {
          variant: 'error',
          title: 'Delete blocked'
        });
        return;
      }

      if (editingCardId === cardId) {
        resetCardComposer();
      }

      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  document.querySelectorAll('[data-edit-order]').forEach((button) => {
    button.addEventListener('click', () => {
      startEditingOrder(button.dataset.editOrder);
    });
  });

  document.querySelectorAll('[data-delete-order]').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.dataset.deleteOrder;
      const shouldDelete = await confirmAction({
        title: 'Delete order',
        message: 'Delete this churning order?',
        confirmLabel: 'Delete order',
        tone: 'danger'
      });
      if (!shouldDelete) return;

      deleteChurningOrder(orderId);

      if (editingOrderId === orderId) {
        resetOrderComposer();
      }

      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  document.querySelectorAll('[data-toggle-status]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleOrderStatus(button.dataset.orderId, button.dataset.toggleStatus);
    });
  });
}
