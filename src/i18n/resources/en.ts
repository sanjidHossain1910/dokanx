import { flowsEn } from "./flows";
import { purchaseEn } from "./purchase";
import { businessEn } from "./business";
import { inventoryEn } from "./inventory";
import { posEn } from "./pos";
import { setupEn } from "./setup";
import { profileSettingsEn } from "./profileSettings";
const en = {
  flows: flowsEn,
  profileSettings: profileSettingsEn,
  setup: setupEn,
  business: businessEn,
  pos: posEn,
  purchase: purchaseEn,
  inventory: { title: "Inventory", products: "Products", ...inventoryEn },
  common: { appName: "DokanX", loading: "Loading...", language: "Language" },
  buttons: { next: "Next", skip: "Skip", getStarted: "Get Started", save: "Save", cancel: "Cancel" },
  auth: { login: "Log in", remember_me: "Remember me", signup: "Create account", email: "Email address", password: "Password", password_paceholder: "Enter your password", phone_number: "Phone number", phone_number_placeholder: "Enter your phone number", login_title: "Welcome Back", login_subtitle: "Sign in to continue managing your business." },
  welcome: {
    title: "Welcome to DokanX", description: "Manage your business with confidence.",
    slides: {
      business: { title: "Manage Your Business Smarter", description: "Manage inventory, sales, purchases, accounting and reports from one place." },
      inventory: { title: "Track Every Product with Ease", description: "Keep track of inventory, manage sales and receive low stock alerts." },
      insights: { title: "Grow with Smart Insights", description: "Analyze reports and make better business decisions." },
    },
  },
  dashboard: {
    showAmount: "Show {{label}}", hideAmount: "Hide {{label}}", amountHidden: "Amount hidden", autoHideHint: "Automatically hides again after 20 seconds.",
    title: "Dashboard", sales: "Sales", overview: "Here's your business overview.", morning: "Good Morning", afternoon: "Good Afternoon", evening: "Good Evening", night: "Good Night",
    today: "Today's Summary", purchase: "Purchase", profit: "Profit", expense: "Expense", quickActions: "Quick Actions", customers: "Customers", buy: "Purchase",
    inventory: "Inventory Status", totalProducts: "Total Products", lowStock: "Low Stock", outOfStock: "Out of Stock", viewAll: "View All", week: "Sales This Week", weeklyTotal: "Total this week",
    alerts: "Low Stock Alerts", remaining: "{{quantity}} remaining", noAlerts: "Your shelves are looking good!", noAlertsBody: "No products need restocking right now.", noSales: "Your next sale starts the story.", noSalesBody: "Record a sale to see your weekly trend here.",
    noProducts: "Let's get your shop ready", noProductsBody: "Add your first product, then record sales and follow your business here.",
    yesterday: "{{value}} vs yesterday", grossNote: "Sales − tax − recorded product cost − expenses", noEntries: "No entries today", local: "Saved on this device", notifications: "Notifications", openNotifications: "Open notifications, {{quantity}} unread", openProfile: "Open profile", noNotifications: "You're all caught up", markRead: "Mark all as read", stockNotice: "{{name}} needs restocking. {{quantity}} remaining.",
    theme: "Appearance", light: "Light", dark: "Dark", system: "System", themeHint: "System follows your device's appearance.", themeError: "Theme applied, but could not save your preference. Try again.", chooseLanguage: "Choose language", closeLanguage: "Close language menu", chartDescription: "Weekly sales: {{values}}. Total {{total}}.",
    addCustomer: "Add customer", customerName: "Customer name", phone: "Phone number (optional)", noCustomers: "Keep your regulars close. Add your first customer.", invalidCustomer: "Enter a name and a valid phone number, or leave the phone blank.", duplicateCustomer: "This phone number is already saved.",
    recordPurchase: "Record purchase", unitCost: "Unit cost (BDT)", invalidPurchase: "Choose a product, a positive quantity in its selected unit and a valid cost.", noPurchases: "No purchases recorded yet.", purchaseHint: "Purchases add stock and update the average unit cost. Previous sales keep their recorded cost.",
    recordExpense: "Record expense", expenseName: "Expense description", expenseAmount: "Amount (BDT)", invalidExpense: "Enter a description and a positive amount with up to 2 decimal places.", noExpenses: "No expenses recorded yet.",
  },
  profile: { title: "Profile", edit: "Edit profile", logout: "Log out" },
  errors: { generic: "Something went wrong. Please try again.", network: "Please check your internet connection." },
  validation: { required: "This field is required.", email: "Enter a valid email address." },
  settings: { title: "Settings", language: "App language" },
  reports: { title: "Reports", sales: "Sales report", profit: "Profit report" },
} as const;

export default en;


