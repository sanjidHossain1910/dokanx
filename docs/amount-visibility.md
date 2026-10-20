# Temporary amount visibility

Home's Sales, Purchase, Profit and Expense cards, the weekly sales total/chart and Reports' monetary summaries start hidden. Each has an independent eye button. Revealing an amount starts a 20-second timer; pressing the button again hides it immediately. A later reveal starts a fresh timer.

Leaving the screen, backgrounding the app or hiding/blurring the browser also hides revealed figures. Timers and event subscriptions are cleaned up. Reveal state is not persisted. Product/stock counts remain visible, and POS prices and receipt amounts retain their normal transaction behavior.

Hidden figures are replaced in the rendered content rather than visually blurred. Sales comparisons and chart values/accessibility descriptions are omitted while hidden. Existing calculations and stored business data are unchanged.

Implementation: `src/dashboard/useAmountVisibility.ts`, `components/dashboard/AmountVisibilityButton.tsx`, `components/dashboard/Cards.tsx`, `components/dashboard/WeeklySalesChart.tsx`, `components/business/Dashboard.tsx`, and existing English/Bangla resources.

Validation: TypeScript, lint and web production export passed. Browser checks confirmed default masking, independent profit reveal followed by automatic hiding after a real 21-second wait, immediate manual sales hiding without navigation, screen-change hiding, Reports' hidden/revealed totals and omission of weekly chart values/accessibility descriptions while hidden.

![Hidden summary cards](previews/dashboard-amounts-hidden.png)
