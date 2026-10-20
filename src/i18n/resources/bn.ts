import { flowsBn } from "./flows";
import { purchaseBn } from "./purchase";
import { businessBn } from "./business";
import { inventoryBn } from "./inventory";
import { posBn } from "./pos";
import { setupBn } from "./setup";
import { profileSettingsBn } from "./profileSettings";
const bn = {
  flows: flowsBn,
  profileSettings: profileSettingsBn,
  setup: setupBn,
  business: businessBn,
  pos: posBn,
  purchase: purchaseBn,
  inventory: { title: "ইনভেন্টরি", products: "পণ্য", ...inventoryBn },
  common: { appName: "DokanX", loading: "লোড হচ্ছে...", language: "ভাষা" },
  buttons: { next: "পরবর্তী", skip: "এড়িয়ে যান", getStarted: "শুরু করুন", save: "সংরক্ষণ করুন", cancel: "বাতিল করুন" },
  auth: { login: "লগ ইন", signup: "অ্যাকাউন্ট তৈরি করুন", email: "ইমেইল ঠিকানা", password: "পাসওয়ার্ড", remember_me: "মনে রাখুন", password_paceholder: "পাসওয়ার্ড লিখুন", phone_number: "ফোন নম্বর", phone_number_placeholder: "ফোন নম্বর লিখুন", login_title: "আবার স্বাগতম", login_subtitle: "ব্যবসা পরিচালনা করতে সাইন ইন করুন।" },
  welcome: {
    title: "DokanX-এ স্বাগতম", description: "আত্মবিশ্বাসের সঙ্গে আপনার ব্যবসা পরিচালনা করুন।",
    slides: {
      business: { title: "আরও স্মার্টভাবে ব্যবসা পরিচালনা করুন", description: "এক জায়গা থেকে ইনভেন্টরি, বিক্রয়, কেনাকাটা, হিসাব এবং রিপোর্ট পরিচালনা করুন।" },
      inventory: { title: "সহজে প্রতিটি পণ্যের হিসাব রাখুন", description: "ইনভেন্টরি ও বিক্রয় ট্র্যাক করুন এবং কম স্টকের সতর্কতা পান।" },
      insights: { title: "স্মার্ট ইনসাইটে ব্যবসা বাড়ান", description: "রিপোর্ট বিশ্লেষণ করে আরও ভালো ব্যবসায়িক সিদ্ধান্ত নিন।" },
    },
  },
  dashboard: {
    showAmount: "{{label}} দেখান", hideAmount: "{{label}} লুকান", amountHidden: "টাকার পরিমাণ লুকানো আছে", autoHideHint: "২০ সেকেন্ড পরে নিজে থেকে আবার লুকাবে।",
    title: "ড্যাশবোর্ড", sales: "বিক্রয়", overview: "আপনার ব্যবসার আজকের সারসংক্ষেপ।", morning: "সুপ্রভাত", afternoon: "শুভ দুপুর", evening: "শুভ সন্ধ্যা", night: "শুভ রাত্রি",
    today: "আজকের হিসাব", purchase: "ক্রয়", profit: "লাভ", expense: "খরচ", quickActions: "দ্রুত কাজ", customers: "ক্রেতাগণ", buy: "পণ্য ক্রয়",
    inventory: "স্টকের অবস্থা", totalProducts: "মোট পণ্য", lowStock: "কম স্টক", outOfStock: "স্টক শেষ", viewAll: "সব দেখুন", week: "এই সপ্তাহের বিক্রয়", weeklyTotal: "এই সপ্তাহে মোট",
    alerts: "কম স্টকের সতর্কতা", remaining: "বাকি {{quantity}}টি", noAlerts: "আপনার স্টক ঠিক আছে!", noAlertsBody: "এই মুহূর্তে কোনো পণ্যের স্টক বাড়াতে হবে না।", noSales: "পরের বিক্রয় থেকেই শুরু হোক।", noSalesBody: "সাপ্তাহিক চিত্র দেখতে একটি বিক্রয় যোগ করুন।",
    noProducts: "চলুন দোকানটি সাজিয়ে নিই", noProductsBody: "প্রথম পণ্য যোগ করুন, বিক্রয় লিখুন আর এখানেই ব্যবসার হিসাব দেখুন।",
    yesterday: "গতকালের তুলনায় {{value}}", grossNote: "বিক্রয় − কর − বিক্রীত পণ্যের সংরক্ষিত খরচ − ব্যয়", noEntries: "আজ কোনো হিসাব নেই", local: "এই ডিভাইসে সংরক্ষিত", notifications: "বিজ্ঞপ্তি", openNotifications: "বিজ্ঞপ্তি খুলুন, অপঠিত {{quantity}}টি", openProfile: "প্রোফাইল খুলুন", noNotifications: "সব খবর দেখে ফেলেছেন", markRead: "সব পড়া হয়েছে", stockNotice: "{{name}}-এর স্টক বাড়াতে হবে। বাকি {{quantity}}টি।",
    theme: "অ্যাপের রং", light: "হালকা", dark: "গাঢ়", system: "সিস্টেম", themeHint: "সিস্টেম বাছলে ডিভাইসের রং অনুসরণ করবে।", themeError: "রং বদলেছে, কিন্তু পছন্দটি সংরক্ষণ হয়নি। আবার চেষ্টা করুন।", chooseLanguage: "ভাষা বাছুন", closeLanguage: "ভাষার মেনু বন্ধ করুন", chartDescription: "সাপ্তাহিক বিক্রয়: {{values}}। মোট {{total}}।",
    addCustomer: "ক্রেতা যোগ করুন", customerName: "ক্রেতার নাম", phone: "ফোন নম্বর (ঐচ্ছিক)", noCustomers: "নিয়মিত ক্রেতাদের তথ্য রাখতে প্রথম ক্রেতা যোগ করুন।", invalidCustomer: "নাম ও সঠিক ফোন নম্বর লিখুন, অথবা ফোনের ঘর খালি রাখুন।", duplicateCustomer: "এই ফোন নম্বর ইতিমধ্যে সংরক্ষিত আছে।",
    recordPurchase: "ক্রয় সংরক্ষণ", unitCost: "প্রতি পণ্যের ক্রয়মূল্য (টাকা)", invalidPurchase: "পণ্য বাছুন, নির্বাচিত এককে শূন্যের বেশি পরিমাণ ও সঠিক মূল্য লিখুন।", noPurchases: "এখনো কোনো ক্রয় লেখা হয়নি।", purchaseHint: "ক্রয়ে স্টক ও গড় ক্রয়মূল্য বদলায়। আগের বিক্রয়ের সংরক্ষিত খরচ বদলায় না।",
    recordExpense: "খরচ লিখুন", expenseName: "খরচের বিবরণ", expenseAmount: "পরিমাণ (টাকা)", invalidExpense: "বিবরণ ও সর্বোচ্চ ২ দশমিকে ধনাত্মক পরিমাণ লিখুন।", noExpenses: "এখনো কোনো খরচ লেখা হয়নি।",
  },
  profile: { title: "প্রোফাইল", edit: "প্রোফাইল সম্পাদনা", logout: "লগ আউট" },
  errors: { generic: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।", network: "আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।" },
  validation: { required: "এই ঘরটি পূরণ করা আবশ্যক।", email: "সঠিক ইমেইল ঠিকানা লিখুন।" },
  settings: { title: "সেটিংস", language: "অ্যাপের ভাষা" },
  reports: { title: "রিপোর্ট", sales: "বিক্রয় রিপোর্ট", profit: "লাভ রিপোর্ট" },
} as const;

export default bn;


