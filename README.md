# Ayyara Rebirth — Admin

Private business dashboard. React 19 + Vite 8, TypeScript, Tailwind CSS v4, React Router 8, TanStack Query. Deploys to Vercel; installable PWA in Phase 6.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:5173
```

Sign in with the owner account created by the backend's `npm run db:seed` (credentials come from `OWNER_*` in `Backend/.env`).

Implemented: login, forced password change for temporary passwords, Users & Permissions (users, roles, per-user grant/deny), Audit Logs, Account & security, and **Stock** — one page listing each perfume with its sizes, MRP, selling price and quantity in the godown; **Add purchase** (creates new perfumes/sizes inline), **Edit** (photos, description, website visibility, sizes & prices), **Correct quantity**, per-size **History** and **Purchase history** (owner-only costs); **Orders** (status tabs, detail panel with timeline, pack / dispatch with tracking / deliver, cancel unpaid orders) **Offline Orders** (create in-person / phone sales with prefilled prices, record payment later, cancel with restock), **Customers** (order history and spend; contact details masked without the personal-data permission), **Payments & Transactions** (totals, filters, CSV export) and **Refunds** (issued from an order: money only, cancel & restock, or returned; “Check status” for pending refunds). Other modules show their roadmap until built.

## Structure

- `src/app/navigation.ts` — single source for modules, routes, icons and required permissions
- `src/app/router.tsx` — routes (lazy-loaded), auth and permission guards
- `src/components/layout` — app shell, collapsible sidebar, mobile drawer, theme toggle, user menu
- `src/components/ui` — Button, Badge, Panel, PageHeader, EmptyState, Field
- `src/features/auth` — session query, guards
- `src/lib/api.ts` — fetch wrapper (`credentials: 'include'`, no tokens in JS)

## Security model

- Auth uses an **HTTP-only, Secure, SameSite** cookie set by the backend; nothing sensitive is kept in browser storage.
- Hiding nav items / pages is cosmetic. The backend checks permissions on every request.
- Deploy admin and API on subdomains of the **same domain** (e.g. `admin.` and `api.`) so the cookie is first-party.
- `noindex` meta + `robots.txt` disallow all.
- `vercel.json` sends the security headers: a content security policy (`script-src 'self'`, API calls only to this site and `*.ayyararebirth.com`), one-year HSTS, no framing. Loading anything from a new host means adding it there.
- The `/api` rewrite in `vercel.json` is for staging only and must be removed before launch (see the backend's `deploy/README.md`).

## Dashboard, reports and notifications

- **Dashboard** (`/`) shows what needs action now (orders to pack, offline money to collect, low stock), then KPIs, a sales chart (online and offline stacked), best sellers, latest orders and low stock. The range defaults to the last 7 days. Days are in India time.
- **Reports & Analytics** (`/reports`) adds a group-by control (day/week/month), sales by perfume, orders by status, stock movement and a period table, plus **Sales CSV / Products CSV** export (`reports.export`). Profit, cost and stock value appear only with `reports.view_financial`. Sales of perfumes with no purchase cost are left out of profit and flagged.
- **Notifications** (`/notifications`) lets staff switch each customer email on or off, preview it, see the delivery log and resend failed emails.
- Charts use Recharts: a sales trend area chart, an online vs offline pie and a sales-by-perfume bar chart, using the `CHART_COLORS` order in `src/features/reports/charts.tsx`. The trend chart has a table view.

## Style guide

- Canvas `#f9fafb`, text `#0a0a0a`, Inter. Numbers, money and codes use `font-mono`.
- **KPI cards** (`StatTile`, also exported as `KpiCard`) are white cards. Pick an accent with `color` (`blue`, `emerald`, `orange`, `purple`, `indigo`, `teal`, `rose`, `gray`), and optionally add `highlight`, `pill` or `link`. Use `SectionCard` and `ModuleCard` from `Panel.tsx` for sections. `PageHeader` renders the title card and takes its icon from the sidebar item.
- **Cards** are `rounded-xl border-gray-100 bg-white shadow-sm`, titles `text-sm font-bold text-gray-800`.
- **Buttons** are `rounded-xl text-xs font-bold`, 38px tall: primary is neutral-900, secondary white outlined, danger `#b31732`.
- **Inputs** are `rounded-xl border-neutral-200`, 38px tall. They use 16px text on phones so iOS doesn't zoom on focus.
- **Table headers** are 10px bold uppercase; cells are 12px (global rules in `index.css`).
- Scrollbars are thin and rounded, and number inputs have no spinners.

## Installable app (PWA)

`vite-plugin-pwa` generates the manifest and service worker on `npm run build`. Staff can **Install app** from the header (Chrome/Edge/Android; on iOS use Share → Add to Home Screen).

- Only the app shell (JS/CSS/icons) is cached. **API responses are never cached** (`NetworkOnly`) because they hold customer and business data.
- When a new version is deployed, staff get a "new version is ready" prompt and choose when to reload.
- Icons are in `public/pwa-*.png` and `apple-touch-icon.png`. They and `favicon.svg` use the official AB monogram; the sidebar and sign-in logos come from `src/components/brand/logo-paths.ts` (vector paths traced from the brand artwork).
- The service worker only runs in production builds (`npm run build && npm run preview`), not in `npm run dev`.
- **Dates and dropdowns:**
  - Use `DateRangePicker` or `DatePicker` from `components/ui/DatePicker.tsx`, never `<input type="date">`. Pass `FILTER_PRESETS` (clearable list filters) or `REPORT_PRESETS`.
  - `Select` in `controls.tsx` is a styled listbox: same `<option>` children and `e.target.value` as a native select, with keyboard and type-ahead support.
  - Both open as native top-layer popovers (`components/ui/Popover.tsx`), so they work inside dialogs. Escape closes the popover only.
