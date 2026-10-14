# 💰 Fine Collector - Class 8:00 AM Late Tracker

**Fine Collector** is a production-grade web application deployed on GitHub Pages designed for tracking and managing late arrivals for 8:00 AM classes. It combines a real-time student late dashboard with a server-enforced, zero-trust administrative workflow powered by Google Cloud Firestore, Firebase Authentication, and Firebase App Check.

---

## 🌟 Key Features

- **Public Student Late Dashboard:** Real-time visibility into late records, total collected fines, pending dues, and today's tardy counts.
- **Dual Light / Dark Mode:** Sleek modern interface with persistence via `fc_theme` in local storage.
- **Server-Enforced Access Control:** Every write, read, and administrative action is verified exclusively by Cloud Firestore Security Rules.
- **Zero Exposed Secrets:** No passwords, PINs, secret keys, or service credentials exist in client-side code, markup, or local storage.
- **Clean DevTools Surface:** Code is strictly encapsulated within an IIFE with all DOM interactions bound via event listeners. Global references (`firebase`, `db`, `auth`, `togglePayment`) remain completely `undefined` in the browser console.

---

## 🔐 Authentication & Admin Workflow (Phase 2)

The application supports two administrative roles: **Master Mind (Kausar Hayat)** and authorized **Sub-Admins**.

### 1. Master Mind (System Owner: Kausar Hayat)
- **Login:** Master Mind logs in directly via the **"Master Mind Login"** link using the single dedicated email `master@fine-collector.app` and a strong passcode (minimum 8 characters).
- **Passcode Management:** Passcodes are managed and changed exclusively inside the Google Firebase Authentication Console.
- **Client Lockout:** After 3 consecutive incorrect attempts, the client initiates a 5-minute cooldown timer.
- **Master Portal Capabilities:**
  1. **Pending Requests:** Real-time stream of incoming authorization requests with one-click **Allow Access**, **Reject**, or **Assign Key**.
  2. **Active Admins:** View all currently approved sub-admins with the ability to instantly **Delete Admin** (immediately revoking their Firestore permissions).
  3. **Private Keys:** Register custom 6-digit Private Keys directly into Firebase Authentication. Keys are shown only once upon creation and are never stored in Firestore.
  4. **Activity & Audit Logs:** Tamper-proof real-time audit trail of all late entries, payment status updates, edits, deletions, and administrative logins.

### 2. Sub-Admin Request Workflow (Without Key)
1. A candidate enters their **Full Name** in the Admin Login modal and leaves the Private Key field blank.
2. The client signs in anonymously and writes a pending request document to `/admin_requests/{uid}`.
3. The candidate sees the **"Wait for Master Mind Permission"** screen featuring a 5-minute live countdown timer.
4. The client listens in real time to `/admins/{uid}`:
   - When Master Mind clicks **"Allow Access"**, the screen immediately unlocks, granting Sub-Admin rights.
   - If Master Mind clicks **"Reject"** (or deletes the request), the candidate is transitioned to the **Access Denied** screen with a "Try Again" option.
   - If 5 minutes elapse without approval, the request times out automatically.

### 3. Sub-Admin Direct Login (With 6-Digit Private Key)
1. If Master Mind has assigned a 6-digit Private Key, the admin enters their **Full Name** and **6-Digit Key**.
2. The client securely computes `slug(name) + "@fine-collector.app"` internally (the email is never shown in the UI) and authenticates via Firebase Auth.
3. If credentials match and `/admins/{uid}` exists, access is unlocked instantly.

### 4. Automatic Session Inactivity Logout
- To prevent unauthorized physical access to unattended devices, sessions automatically log out after **10 minutes** of inactivity.
- An audit log entry is recorded to `/admin_audit_logs` prior to calling `auth.signOut()`.

---

## 🛡️ Security Architecture & Server Rules

### 1. Cloud Firestore Rules
Cloud Firestore rules enforce a strict zero-trust model:
- `students`: Publicly readable; create, update, and delete require verified `isAdmin()` membership and strict student schema validation.
- `admins`: Readable only by the document owner or Master Mind; writeable only by Master Mind.
- `admin_requests`: Creatable only by the requesting user as `pending`; readable by the owner or Master Mind; updateable and deletable only by Master Mind.
- `admin_audit_logs`: Append-only for approved admins (`adminUid == request.auth.uid`); readable only by Master Mind; update and delete are permanently blocked.
- All other paths: Blocked by default (`allow read, write: if false;`).

### 2. Deny-by-Default on Other Firebase Services
- **Realtime Database:** Completely disabled via `database.rules.json` (`{ "rules": { ".read": false, ".write": false } }`).
- **Cloud Storage:** Completely disabled via `storage.rules` (`allow read, write: if false;`).

### 3. App Check & API Key Hardening
- **Firebase App Check:** Integrated with Google reCAPTCHA v3 provider to ensure requests originate exclusively from the legitimate web application.
- **API Key Restrictions:** The public web API key is restricted in Google Cloud Console by HTTP referrer (`https://iamkausarhayat.github.io/*`) and scoped strictly to Identity Toolkit, Token Service, and Cloud Firestore APIs.

---

## 📁 Repository Structure

```
.
├── index.html                  # Accessible web markup without inline event handlers
├── app.js                      # Encapsulated application logic and Firebase integration (IIFE)
├── firebase-config.js          # Public web configuration and App Check settings
├── style.css                   # Dual light/dark theme styling and UI components
├── firestore.rules             # Production Cloud Firestore Security Rules
├── database.rules.json         # Realtime Database deny-all configuration
├── storage.rules               # Cloud Storage deny-all configuration
├── MASTER_RULES_TO_PASTE.txt   # Ready-to-paste security rules for Firebase Console
├── MASTER_ACCESS_GUIDE.md      # Step-by-step onboarding guide for Master Mind
├── SECURITY_SETUP.md           # Console hardening checklist (App Check, API Key, Auth)
└── README.md                   # Project documentation and architectural overview
```

---

## 🚀 Setup & Deployment

1. Review and publish the rules in `MASTER_RULES_TO_PASTE.txt` inside the Firebase Console.
2. Follow `MASTER_ACCESS_GUIDE.md` to create the master user account and initial Firestore admin document.
3. Follow `SECURITY_SETUP.md` to complete App Check registration, API key referrer restrictions, and Auth provider settings.
4. Replace the placeholders in `firebase-config.js` with your active project credentials.
5. Push to GitHub Pages and access your live late tracker.
