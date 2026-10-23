import { conflictsBn } from "./conflicts";
import { accountBn } from "./account";
import { accountSyncBn } from './accountSync';
import { cloudBackupBn } from "./cloudBackup";
import { dueBn } from "./due";
import { restockBn } from "./restock";
import { securityBn } from "./security";
import { stockCountBn } from "./stockCount";
import { profitBn } from "./profit";
import { sellingBn } from "./selling";
import { flowsBn } from "./flows";
import { purchaseBn } from "./purchase";
import { businessBn } from "./business";
import { inventoryBn } from "./inventory";
import { posBn } from "./pos";
import { setupBn } from "./setup";
import { profileSettingsBn } from "./profileSettings";
const bn = { conflicts: conflictsBn, accountSync:accountSyncBn, cloudBackup: cloudBackupBn, account: accountBn, due: dueBn, restock: restockBn,
  security: securityBn,
  stockCount: stockCountBn,
  profit: profitBn,
  selling: sellingBn,
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
    businessSummary: "ব্যবসার সারাংশ",
    salesSinceStart: "শুরু থেকে মোট বিক্রি",
    netMargin: "নিট লাভের হার",
    costsShare: "পণ্যের খরচ + অন্যান্য খরচ",
    marginDescription: "নিট লাভের হার: {{value}}",
    marginNote: "লাভের হার = খরচ বাদে লাভ ÷ কর ছাড়া বিক্রি। রেখায় লাভের অংশ দেখানো হয়; লোকসান হলে ঋণাত্মক শতাংশ দেখাবে।",
    openBreakdown: "আদায় ও বাকির বিস্তারিত",
    closeBreakdown: "বিস্তারিত বন্ধ করুন",
    billCollected: "আদায়", billDue: "এখনো বাকি",
    lifetime: "সর্বকালের মোট হিসাব",
    allTime: "সব সময়",
    totalSales: "মোট বিক্রি",
    totalProfit: "মোট লাভ",
    totalDue: "এখনো বাকি",
    totalReceived: "মোট আদায়",
    cashReceived: "নগদ আদায়",
    digitalReceived: "ডিজিটাল আদায়",
    netProfitHint: "কর, রিটার্ন ও খরচ বাদে",
    dueHint: "ক্রেতাদের বর্তমান মোট বাকি",
    receivedHint: "নগদ + ডিজিটাল, ফেরত বাদে",
    cashHint: "বিক্রি + বাকি আদায় − নগদ ফেরত",
    digitalHint: "বিকাশ, নগদ ও কার্ড · ফেরত বাদে",
    receiptsNote: "আদায়ের হিসাবে পরে পাওয়া বাকি টাকাও আছে; ফেরত দেওয়া টাকা বাদ যায়। নগদ আদায় ক্যাশবক্সের বর্তমান টাকা নয়—কেনাকাটা ও খরচসহ হিসাব ক্যাশ ডে-তে দেখুন।",
    legacyReceiptsNote: "পুরোনো যেসব বিক্রির পেমেন্ট রেকর্ড নেই, সেগুলো বিক্রি ও লাভে আছে; নগদ বা ডিজিটাল আদায়ে ধরা হয়নি।",
    dueSales: "বাকি / আংশিক পরিশোধের বিক্রি দেখুন",
    paymentFilter: {"all": "সব পেমেন্ট", "outstanding": "বাকি / আংশিক", "paid": "সম্পূর্ণ পরিশোধ"},
    showAmount: "{{label}} দেখান", hideAmount: "{{label}} লুকান", amountHidden: "টাকার পরিমাণ লুকানো আছে", autoHideHint: "{{seconds}} সেকেন্ড পরে নিজে থেকে আবার লুকাবে।",
    title: "ড্যাশবোর্ড", sales: "বিক্রয়", overview: "আপনার ব্যবসার আজকের সারসংক্ষেপ।", morning: "সুপ্রভাত", afternoon: "শুভ দুপুর", evening: "শুভ সন্ধ্যা", night: "শুভ রাত্রি",
    today: "আজকের হিসাব", purchase: "ক্রয়", profit: "লাভ", expense: "খরচ", quickActions: "দ্রুত কাজ", customers: "ক্রেতাগণ", buy: "পণ্য ক্রয়",
    bestSellers: "বেশি বিক্রি হওয়া পণ্য", bestSellersHint: "গত ৩০ দিনে সবচেয়ে বেশি বার বিক্রি হয়েছে", soldInSales: "{{quantity}}টি বিক্রয়ে ছিল", noBestSellers: "বিক্রয় সম্পন্ন হলে এখানে বেশি বিক্রি হওয়া পণ্য দেখাবে।",
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
