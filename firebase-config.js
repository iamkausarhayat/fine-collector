/**
 * Firebase Client Configuration & App Check Settings
 * Project: Fine Collector (GitHub Pages)
 *
 * NOTE: The web configuration below is public by design.
 * Firebase web credentials act as project identifiers and are safe on GitHub Pages
 * because all security is strictly enforced server-side by Cloud Firestore Security Rules,
 * Firebase Authentication, and App Check.
 *
 * TO CONFIGURE YOUR APP:
 * 1. Open Firebase Console (https://console.firebase.google.com/)
 * 2. Go to Project settings > General
 * 3. Under "Your apps", select your Web App
 * 4. Under "SDK setup and configuration", select "Config"
 * 5. Copy the exact apiKey, messagingSenderId, and appId values into the object below.
 *    (Do not change authDomain, projectId, or storageBucket if using default naming).
 */
window.__FC_FIREBASE_CONFIG__ = {
  apiKey: "AIzaSyA5FIgcrRT3oLm14tej6MSw4DoPDZcAiXI",
  authDomain: "fine-collector.firebaseapp.com",
  databaseURL: "https://fine-collector-default-rtdb.firebaseio.com",
  projectId: "fine-collector",
  storageBucket: "fine-collector.firebasestorage.app",
  messagingSenderId: "562810659222",
  appId: "1:562810659222:web:acde54f52100f428f2bdb7"
};

/**
 * Google reCAPTCHA v3 Site Key for Firebase App Check
 * When ready to enforce App Check:
 * 1. Register your domain in Google reCAPTCHA v3 Admin Console.
 * 2. Paste the reCAPTCHA v3 site key string below.
 * 3. Keep as an empty string "" until registered.
 */
window.__FC_RECAPTCHA_SITE_KEY__ = "";
