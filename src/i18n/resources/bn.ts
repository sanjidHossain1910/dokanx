const bn = {
  common: { appName: "DokanX", loading: "লোড হচ্ছে...", language: "ভাষা" },
  buttons: { next: "পরবর্তী", skip: "এড়িয়ে যান", getStarted: "শুরু করুন", save: "সংরক্ষণ করুন", cancel: "বাতিল করুন" },
  auth: { login: "লগ ইন", signup: "অ্যাকাউন্ট তৈরি করুন", email: "ইমেইল ঠিকানা", password: "পাসওয়ার্ড" },
  welcome: {
    title: "DokanX-এ স্বাগতম", description: "আত্মবিশ্বাসের সঙ্গে আপনার ব্যবসা পরিচালনা করুন।",
    slides: {
      business: { title: "আরও স্মার্টভাবে ব্যবসা পরিচালনা করুন", description: "এক জায়গা থেকে ইনভেন্টরি, বিক্রয়, কেনাকাটা, হিসাব এবং রিপোর্ট পরিচালনা করুন।" },
      inventory: { title: "সহজে প্রতিটি পণ্যের হিসাব রাখুন", description: "ইনভেন্টরি ও বিক্রয় ট্র্যাক করুন এবং কম স্টকের সতর্কতা পান।" },
      insights: { title: "স্মার্ট ইনসাইটে ব্যবসা বাড়ান", description: "রিপোর্ট বিশ্লেষণ করে আরও ভালো ব্যবসায়িক সিদ্ধান্ত নিন।" },
    },
  },
  dashboard: { title: "ড্যাশবোর্ড", sales: "বিক্রয়", overview: "ব্যবসার সারসংক্ষেপ" },
  profile: { title: "প্রোফাইল", edit: "প্রোফাইল সম্পাদনা", logout: "লগ আউট" },
  errors: { generic: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।", network: "আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।" },
  validation: { required: "এই ঘরটি পূরণ করা আবশ্যক।", email: "সঠিক ইমেইল ঠিকানা লিখুন।" },
  settings: { title: "সেটিংস", language: "অ্যাপের ভাষা" },
  inventory: { title: "ইনভেন্টরি", products: "পণ্য", lowStock: "কম স্টক" },
  reports: { title: "রিপোর্ট", sales: "বিক্রয় রিপোর্ট", profit: "লাভ রিপোর্ট" },
} as const;

export default bn;
