export const conflictsEn = {
  reallocated:
    "The new payment’s bill allocation has been adjusted to the latest unpaid bills. Payment amounts stay the same; existing cloud payments stay unchanged.",
  otherDueChange: "Other due changes on the other device: {{amount}}",
  paymentReview: "Compare payments from both devices",
  bill: "Bill",
  choice: {
    local: "Keep this phone’s payments · Due {{amount}}",
    cloud: "Keep the other device’s payments · Due {{amount}}",
    merge: "Keep both payments · Due {{amount}}",
  },
  beforePayments: "Due on this phone before its payments: {{amount}}",
  presence: {
    newLocal: "New payment recorded on this phone",
    newCloud: "New payment recorded on the other device",
    deletedCloud: "This payment was removed from the cloud copy",
    deletedLocal: "This payment was removed from this phone’s copy",
    localCopy: "Payment in this phone’s copy",
    cloudCopy: "Payment in the other device’s copy",
  },
  partialSync:
    "Only the changes needing review and their linked records are waiting. Other changes can continue syncing.",
  dashboard: {
    title: "Some changes need your review",
    count: "{{number}} changes waiting for review",
    body: "Some information changed differently on two devices. Compare the versions and choose what to keep. Other changes can keep syncing while you review these.",
    action: "Review & choose",
  },
  confirmLocalPayments:
    "Keep only this phone’s payment branch for this group? The other device’s new payments shown in this review will be removed from the active ledger. To retain both, choose Keep both payments instead.",
  keepBoth: "Keep both payments",
  mergeTitle: "Combine separate payments",
  mergeHint:
    "Separate payment records are kept together and the remaining due is recalculated. The same payment ID counts once.",
  confirmMerge:
    "Keep the separate payments from both devices and recalculate the remaining due? No payment will be counted twice. The original invoice stays unchanged.",
  combinedPaid: "These payments together: {{amount}}",
  remainingAfterMerge: "Remaining due: {{amount}}",
  mergeCalculation:
    "Cloud remaining due {{cloud}} − this phone’s additional payments {{local}}",
  paymentSide: {
    local: "This phone’s payment",
    cloud: "Other device’s payment",
    both: "Same payment on both devices",
  },
  mergeReason: {
    closedCashDay:
      "The cash day for this payment is already closed. Review that day’s cash records before combining.",
    unsupported:
      "These changes also include other edits. Payment-only changes can be combined; review the other edits separately.",
    missingBase:
      "The original balance is unavailable or does not match the payment records. These payments cannot safely be combined here.",
    editedPayment:
      "An existing payment was changed or deleted. Choose a version; these are not separate new payments.",
    overpayment:
      "Together these payments exceed the remaining due. Verify the amounts before continuing.",
    invalidLedger:
      "The combined payments do not match invoice allocations or cash-day records. Verify the ledger before combining.",
  },
  title: "Review changes",
  intro:
    "The same records changed on two devices. Compare the values and choose the version to keep.",
  open: "Review conflicting changes",
  empty: "No changes need review.",
  refresh: "Refresh review",
  local: "This phone",
  cloud: "Cloud version",
  original: "Before these changes",
  unknown: "The original value is unavailable for this older change.",
  keepLocal: "Keep this phone’s version",
  keepCloud: "Keep cloud version",
  changed: "{{count}} fields differ",
  related: "{{count}} linked records will be handled together.",
  linked:
    "Stock, sale and payment records are linked. This choice applies to the entire group. Review the quantities and totals before continuing.",
  confirm: "Keep this version?",
  confirmLocal:
    "The selected phone values will replace the cloud values shown here. Linked records are included.",
  confirmCloud:
    "Cloud values will replace this phone’s values for this group. Unuploaded local transactions in this group will be removed from the active shop.",
  safety:
    "A safety backup is saved on this phone before any choice. Other pending changes are kept.",
  saved:
    "Choice saved. This group can sync when connected; other pending reviews stay separate.",
  missing: "Not present",
  yes: "Yes",
  no: "No",
  photo: "Photo changed",
  settings: "Shop settings",
  record: "Record",
  details: "Details",
  same: "The values now match. Confirm either version to clear this review.",
  error:
    "Review could not finish. Your phone data has been kept. Retry when connected.",
  stale:
    "Data changed after this review opened. Refresh and compare the latest versions.",
  tooLarge:
    "This change group is too large to review here. Keep your safety backup and contact support.",
  fields: {
    balance: "Remaining due",
    allocations: "Applied to bills",
    stock: "Quantity",
    name: "Product name",
    price: "Selling price",
    cost: "Purchase price",
    wholesalePrice: "Wholesale price",
    barcode: "Barcode",
    category: "Category",
    unit: "Unit",
    photoUri: "Product photo",
    isFavorite: "Favourite",
    lowStockThreshold: "Low stock alert",
    quantity: "Quantity",
    amount: "Amount",
    total: "Total",
    notes: "Notes",
    note: "Note",
    record: "Record added or removed",
    shopName: "Shop name",
    ownerName: "Owner name",
    address: "Address",
    phone: "Phone number",
    photo: "Photo",
  },
};
export const conflictsBn = {
  reallocated:
    "বর্তমানে যে বিলগুলো বাকি আছে, নতুন পেমেন্ট তার সঙ্গে মিলিয়ে বসানো হয়েছে। টাকার পরিমাণ ও ক্লাউডে থাকা পুরোনো পেমেন্ট অপরিবর্তিত থাকবে।",
  otherDueChange: "অন্য ডিভাইসের অন্য বাকি পরিবর্তন: {{amount}}",
  paymentReview: "দুই ডিভাইসের পেমেন্ট মিলিয়ে নিন",
  bill: "বিল",
  choice: {
    local: "এই ফোনের পেমেন্ট রাখুন · বাকি {{amount}}",
    cloud: "অন্য ডিভাইসের পেমেন্ট রাখুন · বাকি {{amount}}",
    merge: "দুই পেমেন্টই রাখুন · বাকি {{amount}}",
  },
  beforePayments: "এই ফোনে পেমেন্টের আগে বাকি: {{amount}}",
  presence: {
    newLocal: "এই ফোনে যোগ করা নতুন পেমেন্ট",
    newCloud: "অন্য ডিভাইসে যোগ করা নতুন পেমেন্ট",
    deletedCloud: "ক্লাউডের কপি থেকে এই পেমেন্ট সরানো হয়েছে",
    deletedLocal: "এই ফোনের কপি থেকে এই পেমেন্ট সরানো হয়েছে",
    localCopy: "এই ফোনের কপিতে থাকা পেমেন্ট",
    cloudCopy: "অন্য ডিভাইসের কপিতে থাকা পেমেন্ট",
  },
  partialSync:
    "শুধু যাচাই বাকি পরিবর্তন ও তার সঙ্গে যুক্ত হিসাব অপেক্ষায় আছে। অন্য তথ্যের সিঙ্ক চলতে পারবে।",
  dashboard: {
    title: "কিছু পরিবর্তন মিলিয়ে নিতে হবে",
    count: "যাচাই বাকি: {{number}}টি পরিবর্তন",
    body: "দুই ডিভাইসে কিছু তথ্য আলাদাভাবে বদলেছে। মিলিয়ে কোনটি রাখবেন বেছে নিন। এই যাচাই বাকি থাকলেও অন্য তথ্যের সিঙ্ক চলতে পারবে।",
    action: "পরিবর্তন দেখে সিদ্ধান্ত নিন",
  },
  confirmLocalPayments:
    "এই গ্রুপে শুধু এই ফোনের পেমেন্টের সংস্করণ রাখবেন? এই যাচাইয়ে দেখানো অন্য ডিভাইসের নতুন পেমেন্টগুলো চালু খতিয়ান থেকে সরবে। দুটোই রাখতে চাইলে ‘দুই পেমেন্টই রাখুন’ বেছে নিন।",
  keepBoth: "দুই পেমেন্টই রাখুন",
  mergeTitle: "আলাদা পেমেন্ট একসঙ্গে রাখুন",
  mergeHint:
    "আলাদা পেমেন্টগুলো রেখে বাকি নতুন করে হিসাব হবে। একই পেমেন্ট ID একবারই গণনা হবে।",
  confirmMerge:
    "দুই ডিভাইসের আলাদা পেমেন্টগুলো রেখে বাকি নতুন করে হিসাব করবেন? একই পেমেন্ট দুবার গণনা হবে না। মূল বিল অপরিবর্তিত থাকবে।",
  combinedPaid: "এই পেমেন্টগুলো একসঙ্গে: {{amount}}",
  remainingAfterMerge: "বাকি থাকবে: {{amount}}",
  mergeCalculation:
    "ক্লাউডে বর্তমান বাকি {{cloud}} − এই ফোনের অতিরিক্ত পেমেন্ট {{local}}",
  paymentSide: {
    local: "এই ফোনের পেমেন্ট",
    cloud: "অন্য ডিভাইসের পেমেন্ট",
    both: "দুই জায়গায় একই পেমেন্ট",
  },
  mergeReason: {
    closedCashDay:
      "এই পেমেন্টের দিনের ক্যাশ হিসাব বন্ধ করা আছে। একসঙ্গে রাখার আগে ওই দিনের ক্যাশ হিসাব যাচাই করুন।",
    unsupported:
      "এখানে পেমেন্টের সঙ্গে অন্য তথ্যও বদলেছে। শুধু পেমেন্টের পরিবর্তন একসঙ্গে রাখা যাবে; অন্য পরিবর্তন আলাদা যাচাই করুন।",
    missingBase:
      "আগের বাকি পাওয়া যাচ্ছে না বা পেমেন্টের সঙ্গে মিলছে না। এখানে নিরাপদে একসঙ্গে রাখা যাচ্ছে না।",
    editedPayment:
      "আগের একটি পেমেন্ট বদলানো বা মুছে ফেলা হয়েছে। এগুলো আলাদা নতুন পেমেন্ট নয়; একটি সংস্করণ বেছে নিন।",
    overpayment:
      "দুই পেমেন্ট একসঙ্গে রাখলে পাওনার চেয়ে বেশি হয়ে যায়। আগে টাকার পরিমাণ যাচাই করুন।",
    invalidLedger:
      "একসঙ্গে রাখলে পেমেন্টের বরাদ্দ বা দিনের ক্যাশ হিসাব মিলছে না। আগে খতিয়ান যাচাই করুন।",
  },
  title: "পরিবর্তন যাচাই",
  intro:
    "একই তথ্য দুই ডিভাইসে বদলেছে। মানগুলো মিলিয়ে কোন সংস্করণ রাখবেন বেছে নিন।",
  open: "দুই ডিভাইসের পরিবর্তন দেখুন",
  empty: "এখন কোনো পরিবর্তন যাচাই বাকি নেই।",
  refresh: "আবার যাচাই করুন",
  local: "এই ফোন",
  cloud: "ক্লাউডের সংস্করণ",
  original: "পরিবর্তনের আগের মান",
  unknown: "পুরোনো এই পরিবর্তনের আগের মান পাওয়া যাচ্ছে না।",
  keepLocal: "এই ফোনের সংস্করণ রাখুন",
  keepCloud: "ক্লাউডের সংস্করণ রাখুন",
  changed: "{{count}}টি ঘরের মান আলাদা",
  related: "সংযুক্ত {{count}}টি রেকর্ড একসঙ্গে রাখা হবে।",
  linked:
    "স্টক, বিক্রি ও পেমেন্টের তথ্য পরস্পর যুক্ত। এই সিদ্ধান্ত পুরো গ্রুপে প্রযোজ্য। এগোনোর আগে পরিমাণ ও টাকার হিসাব মিলিয়ে নিন।",
  confirm: "এই সংস্করণ রাখবেন?",
  confirmLocal:
    "এখানে দেখানো ক্লাউডের মানের জায়গায় এই ফোনের নির্বাচিত মান যাবে। সংযুক্ত রেকর্ডও এর অন্তর্ভুক্ত।",
  confirmCloud:
    "এই গ্রুপে ফোনের মানের জায়গায় ক্লাউডের মান বসবে। গ্রুপের যেসব স্থানীয় লেনদেন এখনো আপলোড হয়নি, সেগুলো চালু দোকানের হিসাব থেকে সরে যাবে।",
  safety:
    "যেকোনো সিদ্ধান্তের আগে এই ফোনে নিরাপত্তার জন্য একটি ব্যাকআপ রাখা হবে। অন্য অপেক্ষমাণ পরিবর্তনগুলো থাকবে।",
  saved:
    "সিদ্ধান্ত সংরক্ষিত। সংযোগ থাকলে এই পরিবর্তন সিঙ্ক হবে; অন্য বাকি যাচাই আলাদা থাকবে।",
  missing: "নেই",
  yes: "হ্যাঁ",
  no: "না",
  photo: "ছবি পরিবর্তিত",
  settings: "দোকানের সেটিংস",
  record: "রেকর্ড",
  details: "বিস্তারিত",
  same: "দুই পাশের মান এখন একই। যেকোনো সংস্করণ বেছে যাচাই শেষ করুন।",
  error: "যাচাই শেষ হয়নি। ফোনের তথ্য রাখা আছে। সংযোগ পেলে আবার চেষ্টা করুন।",
  stale: "যাচাই খোলার পরে তথ্য বদলেছে। নতুন মান দেখতে আবার যাচাই করুন।",
  tooLarge:
    "এই গ্রুপের পরিবর্তন এখানে যাচাই করার জন্য অনেক বড়। নিরাপত্তা ব্যাকআপ রেখে সহায়তা নিন।",
  fields: {
    balance: "অবশিষ্ট বাকি",
    allocations: "বিলের বিপরীতে পেমেন্ট",
    stock: "পরিমাণ",
    name: "পণ্যের নাম",
    price: "বিক্রয়মূল্য",
    cost: "ক্রয়মূল্য",
    wholesalePrice: "পাইকারি মূল্য",
    barcode: "বারকোড",
    category: "ক্যাটাগরি",
    unit: "একক",
    photoUri: "পণ্যের ছবি",
    isFavorite: "পছন্দের পণ্য",
    lowStockThreshold: "কম স্টকের সতর্কতা",
    quantity: "পরিমাণ",
    amount: "টাকার পরিমাণ",
    total: "মোট",
    notes: "বিবরণ",
    note: "নোট",
    record: "যোগ বা মুছে ফেলা রেকর্ড",
    shopName: "দোকানের নাম",
    ownerName: "মালিকের নাম",
    address: "ঠিকানা",
    phone: "ফোন নম্বর",
    photo: "ছবি",
  },
};
