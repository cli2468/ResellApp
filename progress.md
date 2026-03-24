# Vision - Reseller Dashboard App | Progress Tracker

---

## PERMANENT (Completed & Shipped)

### Core Architecture
- **Tech Stack**: Vanilla JS + Vite + PWA (`vite-plugin-pwa`) - no framework bloat
- **Styling**: Custom CSS with a dark Vision UI system
- **Routing**: Custom hash-based SPA router with directional page transitions (forward/reverse slide)
- **Storage**: localStorage with versioned schema (`v3`) - supports migration from v1 and now stores reselling + churning data
- **Auth**: Firebase Auth (Google sign-in) with graceful fallback when Firebase is unconfigured
- **Cloud Sync**: Firestore real-time sync per user across `users/{uid}/lots`, `users/{uid}/churningOrders`, and `users/{uid}/churnCards`
- **PWA**: Service worker, manifest, offline caching, "Add to Home Screen" support, standalone display
- **Fonts**: DM Sans + JetBrains Mono via Google Fonts (cached for offline)

### Data Model (Lot + Sales System)
- **Lots**: name, unitCost (per-unit, not total), quantity, remaining, purchaseDate, returnDeadline, sales[]
- **Sales**: linked to lot, platform, unitsSold, salePrice, shippingCost, fees (auto-calculated), dateSold
- **Profit Formula**: `salePrice - (unitCost * unitsSold) - platformFees - shippingCost`
- **Platform Fees**: Facebook 0%, eBay 13.5% (auto-deducted)
- **Quantity Tracking**: Per-unit cost basis, remaining units auto-decrement, lots archive when fully sold

### Data Model (Churning)
- **Churning Orders**: store, purchaseAmount, reimbursementAmount, card snapshot, cashbackType, cashbackAmount, profit, purchaseDate, paidDate, status flags
- **Churn Cards**: name, cashback %, cashback type (statement credit / points-for-cash)
- **Profit Formula**: `reimbursement - purchaseAmount + cashback`
- **Workflow Tracking**: Tracking uploaded -> Delivered -> Paid, with overdue tracking flags after 3 days

### Views (5 Routes)
1. **Dashboard (`/`)** - Hero profit number, revenue/profit chart (Chart.js), time-range filtering (7D/30D/90D/All), return alerts, KPI cards, and churning summary
2. **Inventory (`/inventory`)** - Tabbed view (Unsold/Sold/All), search + sort, expandable lot cards, inline sale recording, sale editing/deleting, lot editing/deleting, CSV import/export
3. **Churning (`/churning`)** - Credit card cashback arbitrage tracker with card wallet, reimbursement profit math, order status workflow, and task filters
4. **Add Inventory (`/add`)** - Bento picker UI (OCR / Manual / CSV), screenshot upload with OCR parsing, manual entry fallback
5. **Sales Log (`/sales`)** - Filterable/sortable sales table, date range picker, expandable sale rows, inline editing

### Desktop vs Mobile
- **Responsive breakpoint**: 1024px
- **Desktop**: Sidebar navigation, dedicated `DesktopDashboardView`, `DesktopInventoryView`, and responsive Churning layout
- **Mobile**: Bottom tab navigation, card-based layouts, touch-optimized modals, slide transitions

### OCR Engine (Tesseract.js)
- Client-side OCR - no backend needed, works offline
- Universal receipt parsing (Amazon, Target, Walmart, Woot, etc.)
- Extracts: item name, total cost, quantity, platform
- Smart heuristics: product indicator words, known brand names, address/navigation exclusion
- Minimum score threshold to prevent garbage results
- Fallback to manual entry on parse failure

### Components
- **BottomNav**: Mobile tab bar with active state tracking
- **Sidebar**: Desktop nav with collapsible state, auth-aware (login/logout)
- **LoginModal**: Google sign-in modal
- **DemoTour**: Guided walkthrough for first-time desktop visitors (4 steps: KPIs, Chart, Add Inventory, Channel Analytics)

### Services
- **calculations.js**: Fee calculation, reselling + churning profit formulas, monthly stats aggregation, currency formatting
- **chartData.js**: Sales aggregation by day for Chart.js rendering
- **csvImport.js**: CSV parsing + import with header mapping, template generation
- **demoData.js**: Procedurally generated demo data for reselling + churning
- **storage.js**: localStorage CRUD with demo mode interception, schema migration, return deadline tracking, churning cards/orders
- **firebaseSync.js**: Firestore CRUD + real-time snapshot listeners for lots + churning collections
- **uiHelpers.js**: Platform badge rendering
- **animations.js**: Ripple effects, count-up animations, celebration effects

### Polish & UX
- Glitch-style currency preloader animation
- Demo mode with onboarding overlay, demo badge, toast notifications
- First-visit mobile prompt suggesting desktop for demo
- Responsive resize handling (re-renders on breakpoint crossing)
- Return window alerts (3-day warning for lots nearing 30-day return deadline)
- Churning overdue flags for orders where tracking is not uploaded within 3 days

### Deployment
- Vite build with configurable base path (`VITE_BASE` env var)
- GitHub Pages deployment via GitHub Actions
- Vercel-compatible (dynamic base path)

---

## ACTIVE (In Progress / Known Issues / Next Up)

### Known Issues
- [ ] **OCR name parsing still unreliable** - Works well for Amazon, struggles with Woot, some Target formats. Grabs shipping addresses or navigation headers instead of product names on some receipts. The scoring heuristic is good but not perfect across all retailers.
- [ ] **No "Simplify Name" feature** - User wants "Brand + Item" (e.g. "Nordivale Fireplace") but OCR returns full titles or garbage. Manual editing works but adds friction.
- [ ] **manifest.json mismatch** - `dist/manifest.json` / generated web manifest still carries older naming in some build output instead of Vision branding everywhere

### Churning Tab (Initial Version Shipped)
Credit card cashback arbitrage tracker now lives as its own tab in Vision and is visible from the dashboard on both mobile and desktop.

**Context**: Chris buys items (Amazon, Best Buy, etc.) on behalf of a buying group, ships to their address, gets reimbursed the purchase price (sometimes less, sometimes more). Profit = cashback rewards from the credit card used. The buying group has their own app/system for deal alerts, tracking uploads, and payment - Vision only tracks the money math and task status they do not provide.

**Workflow**: Alert -> Commit qty -> Buy -> Shipping confirmation -> Upload tracking -> Delivers -> Paid (1-2 weeks later)

**Data Model - Churning Order**:
- [x] Store (Amazon, Best Buy, etc.)
- [x] Purchase amount
- [x] Reimbursement amount (usually = purchase price, sometimes less or more)
- [x] Card used (dropdown - each card has a saved cashback %)
- [x] Cashback type per card: statement credit or points-for-cash (set once in card setup)
- [x] Auto-calculated profit: `reimbursement - purchaseAmount + (purchaseAmount * cashback%)`
- [x] Status checklist: `[ ] Tracking uploaded` -> `[ ] Delivered` -> `[ ] Paid`
- [x] Purchase date + paid date (for cash flow tracking)

**Card Management**:
- [x] Simple card setup: Name, cashback %, cashback type (statement credit / points)
- [x] Starts with 1 card, designed to support multiple later
- [x] Card selector dropdown on each new order
- [x] Edit existing cards
- [x] Prevent deleting cards already linked to orders

**Dashboard Integration**:
- [x] "Churning this month: $X profit across Y orders"
- [x] Separate from reselling profit but visible on same dashboard
- [x] Alert/filter: "N orders awaiting tracking upload" / "N orders awaiting payment"
- [x] Orders where tracking not uploaded within 3 days get flagged

**Delivered in this first pass**:
- [x] Responsive Churning view for mobile + desktop
- [x] Demo data for churning so the tab/dashboard are not empty in demo mode
- [x] Firestore sync for churning orders + cards alongside existing lot sync
- [x] Historical card snapshot per order so editing a card later does not rewrite old profit

**Still open / possible follow-ups**:
- [ ] Richer analytics inside the Churning tab (trend chart, rolling 30D history, cashflow timeline)
- [ ] Better payment follow-up tools (expected payout date / aging buckets)
- [ ] Faster batch entry if monthly volume grows beyond the current manual workflow

**Intentionally NOT building (for now)**:
- Amazon account integration (no public API, fragile scraping, not worth it at 5-10 orders/month)
- Email parsing for tracking numbers or payment confirmations (same - automation cost >> time saved)
- Committed vs purchased qty tracking (buying group's system handles this)
- Deal alert mirroring (buying group's app handles this)
- When volume hits 30+/month, revisit email automation

### Planned Features (from original SOP / design doc)
- [ ] **CSV Tax Export** - "Export Tax Report" button generating CSV with: Year, Month, Item, Platform, Units, Revenue, Fees, Shipping, Cost, Profit. Filterable by date range. (Data model already supports this - just needs the export UI)
- [ ] **More platform support** - Currently only Facebook (0%) and eBay (13.5%). Design doc mentions Amazon, Shopify, StockX, Whatnot. Demo data already uses these platforms but the fee calculation only handles 2.
- [ ] **Smarter OCR fallback UX** - Auto-select text in name field on OCR failure so user can immediately type replacement. Clear button (X) inside the field. Larger zoomable image preview.
- [ ] **Return window "Mark Returned" action** - Alert exists on desktop dashboard but the full "return or commit" workflow (write-off remaining qty as loss) needs refinement
- [ ] **Mobile-specific improvements** - The design doc emphasized "parking lot optimized" (bright sunlight, one-handed use). Current mobile UI works but could be further optimized for outdoor use.

### Technical Debt
- [ ] **localStorage 5MB limit** - Fine for now, but reselling + churning data both live there and there is still no migration path to IndexedDB. The original SOP recommended IndexedDB.
- [ ] **No automated tests** - Still zero tests. Core profit calculation, churning math, and OCR parsing are prime candidates for unit tests.
- [ ] **Chart.js loaded via CDN** - `chart.umd.min.js` loaded from jsdelivr in `index.html`, not bundled. Works but adds external dependency for offline.
- [ ] **counter.js in src/** - Appears to be a Vite starter file leftover, unused.
- [ ] **javascript.svg in src/** - Another Vite starter leftover.
