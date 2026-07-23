const en = {
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
  dashboard: { title: "Dashboard", sales: "Sales", overview: "Business overview" },
  profile: { title: "Profile", edit: "Edit profile", logout: "Log out" },
  errors: { generic: "Something went wrong. Please try again.", network: "Please check your internet connection." },
  validation: { required: "This field is required.", email: "Enter a valid email address." },
  settings: { title: "Settings", language: "App language" },
  inventory: { title: "Inventory", products: "Products", lowStock: "Low stock" },
  reports: { title: "Reports", sales: "Sales report", profit: "Profit report" },
} as const;

export default en;
