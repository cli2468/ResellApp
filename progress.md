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

### Audit / Critique Response (Priority Order)
This section tracks the codebase-wide quality pass that followed the `/audit` and `/critique` review.

**Completed from that pass**:
- [x] **Primary nav accessibility fixed** - Mobile bottom nav now has accessible labels and active-page state instead of anonymous icon-only buttons
- [x] **Custom sales dropdowns replaced with native controls** - Sales edit flow and desktop inventory sale drawer now use native `select` inputs instead of non-semantic custom dropdowns
- [x] **Chart accessibility improved** - Mobile and desktop dashboards now include textual chart summaries and canvas labels so trend/segmentation views are not visual-only
- [x] **Shared focus-state hardening** - Added stronger focus-visible treatment across nav, buttons, churning filters/status pills, and key interactive controls
- [x] **Blocking browser dialogs removed from app flows** - Replaced `alert()` / `confirm()` usage in login, churning, dashboard return actions, inventory, and add-lot flows with in-app toast + confirm dialog patterns
- [x] **Mobile churning route adapted** - Reordered the route phone-first, reduced cramped layout pressure, and fixed broken mobile status/action structure
- [x] **Mobile inventory + add-lot pass completed** - Tightened mobile inventory card/modals, stacked narrow-screen transactional grids, and normalized the mobile add-lot flow away from several inline layout fragments
- [x] **Add Lot + Inventory normalize/extract pass completed** - `src/views/AddLotView.js` and `src/views/InventoryView.js` now have zero inline `style=` fragments, with shared classes extracted for hidden file inputs, compact transactional form spacing, import feedback blocks, breakdown toggles, and lot-card entry states
- [x] **Desktop layout adapt/harden pass completed** - Replaced the most brittle desktop width locks with fluid ranges across dashboard, inventory, add-flow, and churning shells; added tighter-width breakpoints for dashboard stacking and wrapped desktop toolbars/headers to hold together better on mid-size laptops and zoomed screens
- [x] **Shared chrome visual quieting/distill pass completed** - Toned down the core teal/glass treatment across shared tokens, dashboard chrome, add-flow picker cards, and demo affordances; removed gradient-heavy heading treatment, softened panel/button emphasis, and reduced `src/views/DesktopDashboardView.js` to zero inline `style=` fragments by moving trend, tooltip, x-axis pill, and segmentation-row presentation back into reusable classes
- [x] **Cloud sync auth fallback hardened** - Unconfigured Firebase builds no longer throw during Google sign-in. The app now surfaces a readable configuration error instead of passing a null provider into Firebase Auth, and the initial auth boot path also runs through the local safe wrapper.
- [x] **Cloud sync bootstrap hardened** - Signing out now stores a per-user local backup before the active cache is cleared, and the first authenticated sync now seeds Firestore from local/backup data when the cloud account is empty instead of blindly overwriting the device with empty collections.

**Still open from that same review**:
- [ ] **Inline styling / design-system drift still needs a final shell cleanup** - Add Lot, Inventory, and Desktop Dashboard are off the main inline-style backlog now. The remaining hotspots are the smaller shell leftovers in `src/main.js` (`5` inline `style=` usages) and `src/components/LoginModal.js` (`2` inline `style=` usages).
  Impeccable skills: `/normalize` first to pull the remaining shell/UI affordances back onto the Vision token rails, then `/extract` to consolidate shared prompt/auth/demo fragments instead of keeping one-offs.
  Best order now: shell leftovers only.
- [x] **Visual language quieted and distilled** - The shared chrome now stays in the Vision dark family with more restrained teal usage, less decorative blur/gradient weight, calmer dashboard surfaces, and quieter onboarding/demo treatments.
- [x] **Rigid desktop layout widths adapted** - Dashboard content width, KPI/chart segmentation regions, inventory detail rails/search/header rows, add-inventory side rails, date popovers, and the desktop churning shell now use fluid sizing or tighter-screen breakpoints instead of the most fragile fixed desktop anchors.
- [ ] **Remaining shell consistency cleanup** - Shared shell components still have some one-off interaction code, including inline `onclick` handlers across `src/components/Sidebar.js`, `src/components/demoTour.js`, and `src/main.js` (mobile prompt/demo affordances).
  Impeccable skills: `/extract` to consolidate shared shell behaviors and `/normalize` to align auth/demo/prompt affordances with the same interaction language.
  Goal: move more shell behavior to event wiring/shared patterns instead of route-specific inline snippets.
- [ ] **Bundle / environment warnings remain** - Fresh `npm run build` on **March 24, 2026** still reports two issues: Node `20.17.0` is below Vite's recommended `20.19+`, and the main JS chunk is still **596.05 kB** after minification.
  Impeccable skill: `/optimize`.
  Likely work: lazy-load OCR/Tesseract-heavy paths, isolate Firebase/chart code where possible, and only touch `chunkSizeWarningLimit` after real chunking work has been attempted.

**Recommended audit closeout order**:
1. [x] `/normalize` + `/extract` on Add Lot and Inventory to eliminate the largest concentration of inline styling and one-off layout rules.
2. [x] `/adapt` + `/harden` on the desktop layout so width cleanup happens before the final visual pass.
3. [x] `/quieter` + `/distill` across shared chrome and dashboard surfaces once the structure is more flexible.
4. `/extract` + `/normalize` on Sidebar, DemoTour, and shell prompts to finish shared interaction consistency.
5. `/optimize` for build warnings, code-splitting, and environment cleanup once the UI structure is stable enough not to churn again.

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
- [ ] **Mobile-specific improvements** - Core mobile regressions were addressed in the audit-response pass, but the app still needs a broader "parking lot optimized" refinement pass for outdoor readability, thumb reach, and ultra-fast actions

### Technical Debt
- [ ] **localStorage 5MB limit** - Fine for now, but reselling + churning data both live there and there is still no migration path to IndexedDB. The original SOP recommended IndexedDB.
- [ ] **No automated tests** - Still zero tests. Core profit calculation, churning math, and OCR parsing are prime candidates for unit tests.
- [ ] **Chart.js loaded via CDN** - `chart.umd.min.js` loaded from jsdelivr in `index.html`, not bundled. Works but adds external dependency for offline.
- [ ] **counter.js in src/** - Appears to be a Vite starter file leftover, unused.
- [ ] **javascript.svg in src/** - Another Vite starter leftover.
