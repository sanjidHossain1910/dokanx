export const cloudBackupEn = {
  intervalTitle: "Backup interval",
  intervalInput: "Minutes between automatic syncs",
  everyMinutes: "Every {{minutes}} min",
  minutesOption: "{{minutes}} min",
  intervalHint: "Choose 2–1440 whole minutes. Runs while the app is open; missed checks resume when reopened. Manual Sync now is always available.",
  queue: "Waiting: {{pending}} · Sending: {{processing}} · Needs review: {{conflict}}",
  title: "Cloud backup",
  publish: {
    title: "Back up this phone’s shop",
    hint: "Restored a .dokanx file? Review this phone’s shop and upload it to your account.",
    review: "Review phone data for cloud backup",
    confirm: "Upload & enable automatic backup",
    retry: "Retry upload",
    first: "A first cloud backup will be created for this shop. Other shops in your account are kept separately.",
    replace: "This phone’s data will become this shop’s latest cloud backup. The previous saved versions will remain available. Records are replaced, not merged.",
    device: "This phone will be the backup device. Stop using the previous phone for this shop. After a verified upload, automatic backup checks follow your selected interval while the app is open.",
    success: "Uploaded and verified. Automatic backup is enabled.",
    downloadAlternative: "Want the saved cloud data instead? Use Sync to download it. This replaces the account’s phone data after saving a safety copy.",
  },
  intro:
    "Keep a recovery copy of your shop, products, photos and complete transaction history.",
  account: "Connect an account",
  link: "Link this shop",
  accountHint:
    "Log in and link this shop from Account & Cloud. Offline use remains available.",
  auto: "Automatic sync",
  reviewCloud: "Review cloud data",
  autoRestore: "Automatically download changes",
  autoRestoreHint: "When enabled, scheduled sync also brings newer cloud records to this phone. Sync now checks both directions. Unfinished carts and app security stay on this phone.",
  interval:
    "Every {{minutes}} minutes while the app is open, transfer only changed records and new photos. Each changed sync keeps a recovery snapshot on the server.",
  now: "Sync now",
  working: "Syncing changes…",
  last: "Last successful sync",
  never: "No successful backup yet",
  off: "Automatic backup is off",
  on: "Automatic backup is on",
  versions: "Saved backups",
  refresh: "Refresh list",
  empty: "No verified backups yet.",
  download: "Download backup file",
  downloadHint:
    "Download a .dokanx file to keep or restore using Backup & Restore. Automatic downloads follow the setting above.",
  products: "Products",
  invoices: "Sales",
  photos: "Photos",
  privacy:
    "Includes shop information, payment settings, photos and business records. App PIN, login credentials and phone security are excluded.",
  dev: "Test setup: copies are stored on your PC server. Hosted cloud storage is not connected yet.",
  otherDevice:
    "Another phone is the backup device for this shop. You can download its backups here.",
  errors: {
    invalidSyncInterval: "Enter a whole number from 2 to 1440 minutes.",
    backupBusy: "A sync is running. Wait for it to finish.",
    syncConflict: "The same record changed on two devices. Sync paused to protect both copies. Save a backup file before reviewing the cloud data.",
    syncInvalidMerge: "These changes cannot be combined safely. Your phone data is unchanged; review the cloud data before continuing.",
    syncDownloadRequired: "Cloud changes are waiting. Use Sync now, or enable automatic downloads.",
    syncReset: "Cloud data was replaced. Save your phone backup, then use Account Sync to review and download the latest copy.",
    syncMissingAsset: "A photo upload is incomplete. Try Sync now again.",
    backupFileMissing: "The downloaded file is no longer available. Download it again.",
    backupSaveFailed: "Could not save to that folder. Download again and choose a writable folder.",
    backupShareUnavailable: "The system file sharing menu is unavailable on this phone.",
    backupUploadType: "The server rejected the upload format. Reload the app and try again.",
    backupFailed:
      "Backup could not finish. Your phone data is safe; try again.",
    backupDifferentDevice:
      "Another phone is the backup device for this shop. Download is available; automatic device transfer is not enabled yet.",
    backupHeadChanged:
      "Cloud history has changed. Backup stopped to protect the existing copy. Review the saved backups.",
    backupKeyConflict:
      "This upload no longer matches its original request. The saved backup was preserved.",
    backupStorageFull:
      "Backup storage is full. The latest saved copies are preserved.",
    backupExpired: "This upload has expired. Please try again.",
    backupTempMissing:
      "The phone cleared a temporary upload file. Try again to prepare a new backup.",
    backupRestored:
      "Local data was restored. Uploads are paused. Review phone data above to upload it, or use Sync to download the saved cloud data.",
    backupSettings:
      "Backup settings could not be read or saved. Your local business data is unchanged.",
    backupUnavailable: "Backup storage is currently unavailable.",
    backupContextChanged: "Account or shop changed. Open this screen again.",
    invalidBackup: "The backup file is incomplete or invalid.",
    missingAsset:
      "A product photo or QR image is missing. Restore the missing image and try again.",
    invalidResponse: "The server did not confirm a valid completed backup.",
  },
};
export const cloudBackupBn = {
  intervalTitle: "ব্যাকআপের সময়ের ব্যবধান",
  intervalInput: "কত মিনিট পরপর automatic sync হবে",
  everyMinutes: "প্রতি {{minutes}} মিনিটে",
  minutesOption: "{{minutes}} মিনিট",
  intervalHint: "২–১৪৪০ পূর্ণ মিনিট বেছে নিন। App খোলা থাকলে কাজ করবে; বন্ধ থাকার সময়ের check আবার খুললে হবে। চাইলে যেকোনো সময় Sync now করুন।",
  queue: "অপেক্ষায়: {{pending}} · পাঠানো হচ্ছে: {{processing}} · যাচাই প্রয়োজন: {{conflict}}",
  title: "Cloud backup",
  publish: {
    title: "ফোনের দোকান cloud-এ রাখুন",
    hint: ".dokanx file restore করেছেন? ফোনের দোকান যাচাই করে আপনার account-এ upload করুন।",
    review: "Cloud backup-এর জন্য ফোনের data দেখুন",
    confirm: "Upload ও automatic backup চালু করুন",
    retry: "আবার upload করুন",
    first: "এই দোকানের প্রথম cloud backup তৈরি হবে। Account-এর অন্য দোকানগুলো আলাদা থাকবে।",
    replace: "ফোনের data এই দোকানের সর্বশেষ cloud backup হবে। আগের সংরক্ষিত version-গুলো থাকবে। পুরোনো ও নতুন হিসাব মেশানো হবে না।",
    device: "এই ফোন থেকে পরের backup হবে। এই দোকানের জন্য আগের ফোন ব্যবহার বন্ধ রাখুন। Upload যাচাই হলে app খোলা থাকলে আপনার নির্ধারিত ব্যবধানে automatic backup check হবে।",
    success: "Upload ও যাচাই সম্পূর্ণ। Automatic backup চালু হয়েছে।",
    downloadAlternative: "Cloud-এর data নামাতে চাইলে Sync করুন। Safety copy রেখে এই account-এর ফোনের data বদলাবে।",
  },
  intro: "দোকান, পণ্য, ছবি ও সম্পূর্ণ লেনদেনের একটি recovery copy রাখুন।",
  account: "Account যুক্ত করুন",
  link: "এই দোকান যুক্ত করুন",
  accountHint:
    "Account & Cloud থেকে login করে এই দোকান যুক্ত করুন। Offline ব্যবহার চালু থাকবে।",
  auto: "Automatic sync",
  reviewCloud: "Cloud-এর data যাচাই করুন",
  autoRestore: "Cloud-এর পরিবর্তন নিজে থেকে নামান",
  autoRestoreHint: "চালু থাকলে নির্ধারিত সময়ের sync-এ cloud-এর পরিবর্তন ফোনেও আসবে। Sync now দুই দিকেই check করে। অসমাপ্ত cart ও security ফোনেই থাকবে।",
  interval: "App খোলা থাকলে প্রতি {{minutes}} মিনিটে পরিবর্তিত data ও নতুন ছবি sync হবে। পরিবর্তন না থাকলে নতুন backup তৈরি হবে না।",
  now: "এখন Sync করুন",
  working: "পরিবর্তন sync হচ্ছে…",
  last: "শেষ সফল sync",
  never: "এখনো সফল backup হয়নি",
  off: "Automatic backup বন্ধ",
  on: "Automatic backup চালু",
  versions: "সংরক্ষিত backup",
  refresh: "তালিকা দেখুন",
  empty: "এখনো যাচাই করা backup নেই।",
  download: "Backup file নামান",
  downloadHint:
    ".dokanx file নামিয়ে রাখুন অথবা Backup & Restore দিয়ে restore করুন। Automatic download উপরের setting অনুযায়ী হবে।",
  products: "পণ্য",
  invoices: "বিক্রি",
  photos: "ছবি",
  privacy:
    "দোকানের তথ্য, payment settings, ছবি ও ব্যবসার হিসাব থাকবে। App PIN, login credentials ও ফোনের security যাবে না।",
  dev: "Test setup: backup আপনার PC server-এ থাকবে। Hosted cloud storage এখনো যুক্ত হয়নি।",
  otherDevice:
    "অন্য ফোন এই দোকানের backup করছে। এখানে সেই backup নামাতে পারবেন।",
  errors: {
    invalidSyncInterval: "২ থেকে ১৪৪০-এর মধ্যে পূর্ণ মিনিট লিখুন।",
    backupBusy: "Sync চলছে। শেষ হলে আবার চেষ্টা করুন।",
    syncConflict: "একই record দুই device-এ বদলেছে। দুই কপি রক্ষা করতে sync থেমেছে। Cloud data দেখার আগে ফোনের backup file রাখুন।",
    syncInvalidMerge: "এই পরিবর্তনগুলো নিরাপদে মেলানো যাচ্ছে না। ফোনের data অক্ষত আছে; cloud-এর data যাচাই করুন।",
    syncDownloadRequired: "Cloud-এ নতুন পরিবর্তন আছে। এখন Sync করুন অথবা automatic download চালু করুন।",
    syncReset: "Cloud-এর data নতুন করে বসানো হয়েছে। ফোনের backup রেখে Account Sync দিয়ে সর্বশেষ copy যাচাই করে নামান।",
    syncMissingAsset: "ছবির upload শেষ হয়নি। আবার Sync করুন।",
    backupFileMissing: "Download করা file পাওয়া যাচ্ছে না। আবার download করুন।",
    backupSaveFailed: "ওই folder-এ save হয়নি। আবার download করে অন্য folder বেছে নিন।",
    backupShareUnavailable: "এই ফোনে system file share menu পাওয়া যাচ্ছে না।",
    backupUploadType: "Server upload-এর format গ্রহণ করেনি। App reload করে আবার চেষ্টা করুন।",
    backupFailed: "Backup শেষ হয়নি। ফোনের data নিরাপদ আছে; আবার চেষ্টা করুন।",
    backupDifferentDevice:
      "অন্য ফোন এই দোকানের backup করছে। Backup নামাতে পারবেন; device transfer এখনো চালু হয়নি।",
    backupHeadChanged:
      "Cloud-এর history বদলেছে। আগের copy রক্ষা করতে backup থামানো হয়েছে। সংরক্ষিত backup দেখুন।",
    backupKeyConflict:
      "Upload আগের request-এর সঙ্গে মিলছে না। সংরক্ষিত backup অক্ষত আছে।",
    backupStorageFull: "Backup storage পূর্ণ। আগের সফল backup অক্ষত আছে।",
    backupExpired: "এই upload-এর সময় শেষ। আবার চেষ্টা করুন।",
    backupTempMissing:
      "ফোনের temporary upload file মুছে গেছে। আবার চেষ্টা করলে নতুন backup তৈরি হবে।",
    backupRestored:
      "Local data restore হয়েছে, upload বন্ধ আছে। উপরের review দিয়ে ফোনের data upload করুন, অথবা Sync দিয়ে cloud-এর data নামান।",
    backupSettings:
      "Backup settings পড়া বা save করা যায়নি। ব্যবসার local data অপরিবর্তিত আছে।",
    backupUnavailable: "Backup storage এখন পাওয়া যাচ্ছে না।",
    backupContextChanged: "Account বা দোকান বদলেছে। Screen আবার খুলুন।",
    invalidBackup: "Backup file অসম্পূর্ণ অথবা সঠিক নয়।",
    missingAsset:
      "কোনো পণ্যের ছবি বা QR পাওয়া যায়নি। ছবিটি ঠিক করে আবার চেষ্টা করুন।",
    invalidResponse: "Server সঠিকভাবে backup সম্পূর্ণ হওয়ার নিশ্চয়তা দেয়নি।",
  },
};
