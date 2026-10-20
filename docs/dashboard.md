# Home dashboard implementation

## New UI

- `components/dashboard/HomeDashboard.tsx`: offline dashboard composition, live local date, loading/error/empty states and safe-area spacing.
- `DashboardHeader.tsx`, `Cards.tsx`, `WeeklySalesChart.tsx`, `LowStockAlert.tsx`: reusable header, animated cards, accessible SVG chart and replenishment alerts.
- `components/ui/ThemePicker.tsx`: immediate Light/Dark/System selection in Profile.
- `app/business/purchases.tsx`, `customers.tsx`, `expenses.tsx`, `notifications.tsx`: working local destinations for dashboard actions. The bell displays actual local stock alerts, not remote push notifications.

## Data and theme

- `src/dashboard/selectors.ts`: pure daily/weekly aggregation, recorded COGS and expenses, inventory counts, notification read signatures. Local calendar dates are used; the week starts Monday. Low stock is 1–5 units; zero stock is counted separately.
- `src/dashboard/format.ts`: Bangla/English number, BDT and date locale helpers.
- `src/theme/tokens.ts`, `ThemeProvider.tsx`: centralized palette, system appearance subscription and serialized local preference writes. `global.css` exposes semantic NativeWind colors through CSS variables, so manual themes work on web as well as native.
- `src/store/business.ts`: backward-compatible optional collections for purchases, customers and expenses; weighted purchase cost updates without rewriting historical sales.
- `src/store/repository.ts`: `BusinessRepository.read/write` contract. A future Expo SQLite adapter can implement this contract and be passed to `BusinessProvider` without changing dashboard selectors or components. SQLite itself is not installed.

## Existing files integrated

The Home route now renders the new dashboard. Root layout adds a theme provider and themed status/navigation background. Shared business screens, fields, language menu, bottom sheet and the existing tab bar respond to the palette. The five-tab structure, central blue action button and authentication behavior are preserved. English and Bangla resources remain in the existing i18n system. No dependencies or Expo configuration were changed for this dashboard.

## App-wide appearance correction

The theme now wraps the entire app, including startup and error states. Expo Router's own ThemeProvider receives the selected palette; root, nested stacks and tab scenes all set an explicit page background. Native `expo-system-ui` updates the root window, and React Native Appearance follows the selected mode (or resets to `unspecified` for System in the installed React Native version).

On web, `app/+html.tsx` applies the stored appearance before hydration. The first React render uses a deterministic palette until local preferences load, preventing server light CSS variables from remaining on a dark screen. `syncPlatformTheme.web.ts` updates html/body/root colors, browser color scheme and the shared CSS variables, including portal content. Both paths use centralized tokens.

Login, Signup, Welcome, checkbox, shared input, input keyboard/selection colors and the language menu's pressed state now follow the palette. Authentication handlers and session behavior were not changed. Theme regression tests cover hydration initialization, explicit/system modes and shared screen/document variables. Browser QA checks eight routes in both modes, including a full reload on the Login route.

## Remaining integration work

- Authentication is deferred in the existing project, so no authenticated owner name exists. The saved shop name is shown; replace this source with the authenticated owner's display name when available.
- No separate design image was attached with the request; the supplied layout and palette specification was used.
- All figures use local records. Empty stores show zero totals and helpful empty states. No production mock fixtures or invented percentage comparisons were added.
- Customer management currently supports adding and listing contacts. Purchases support a single product per entry. Returns, customer balances, multi-item purchases, taxes, cloud sync, subscriptions and remote notifications are outside this dashboard implementation.
- Average stock cost is stored in integer poisha and rounded per unit. A future accounting ledger may require exact inventory cost pools and additional tax/return rules.
- Native Android/iOS camera and device-specific text rendering still need device QA; browser previews do not replace that check.

## Validation

`npm run typecheck`, `npm run lint`, `npm test` (17 passing tests), and Expo web and Android JavaScript production exports. Domain tests cover local midnight/week boundaries, profit independent of purchases, weighted costs, legacy storage validation, inventory/read state, Bangla currency formatting and app-wide theme behavior. Browser checks cover 320/390/430px layouts, light/dark appearance, language changes, purchase and expense totals, customer creation, persisted preferences and screen-reader selection states. An Android bundle export is not an installed APK or a physical-device test.
