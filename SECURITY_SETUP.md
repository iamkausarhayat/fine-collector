# Production Security Hardening Checklist - Fine Collector

Complete the following numbered checklist in Google Cloud and Firebase consoles to fully lock down project infrastructure.

---

## 1. Firebase App Check Enforcement (Section D)

Firebase App Check verifies that incoming traffic originates exclusively from your legitimate web application, preventing bots, unauthorized scripts, and API abuse.

- [ ] **1.1 Register reCAPTCHA v3**:
  1. Visit the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin).
  2. Create a new site label: `fine-collector`.
  3. Select **reCAPTCHA type**: **reCAPTCHA v3**.
  4. Add domains:
     - `iamkausarhayat.github.io`
     - `localhost` (optional, for local development testing only).
  5. Copy the **Site Key** and replace the placeholder in `firebase-config.js` (`__FC_RECAPTCHA_SITE_KEY__`).

- [ ] **1.2 Register App Check Provider in Firebase**:
  1. Open [Firebase Console](https://console.firebase.google.com/) > **Build** > **App Check**.
  2. Under the **Apps** tab, locate your Web App.
  3. Click **Register** or **Manage**, choose **reCAPTCHA v3**, paste your reCAPTCHA Secret Key, and save.

- [ ] **1.3 Enable Cloud Firestore Enforcement**:
  1. In the **App Check** dashboard, click on the **Cloud Firestore** row under **APIs**.
  2. Click the **Enforce** button.
  3. Confirm the modal prompt to strictly reject any requests that lack a valid App Check token.

- [ ] **1.4 Enable Authentication Enforcement**:
  1. In the **App Check** dashboard, click on the **Firebase Authentication** row under **APIs**.
  2. Click **Enforce** and confirm.

---

## 2. Google Cloud API Key Restriction (Section E)

> **Architectural Note on Web API Keys:**
> In Firebase, web API keys are project identifiers that are bundled into client-side JavaScript by design. A web API key alone confers **zero** administrative power. With backend Security Rules, App Check, and the API restrictions configured below, extracting the API key from source code is completely useless to an attacker.

- [ ] **2.1 Navigate to Google Cloud Credentials**:
  1. Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
  2. Select your Firebase project from the top dropdown (`fine-collector`).
  3. Under **API Keys**, locate the **Browser key (auto created by Firebase)**.

- [ ] **2.2 Apply Application / HTTP Referrer Restrictions**:
  1. Click the edit icon (pencil) next to the API Key.
  2. Under **Set an application restriction**, select **Websites (HTTP referrers)**.
  3. Under **Website restrictions**, click **Add**:
     - `https://iamkausarhayat.github.io/*`
  4. Remove all other wildcards and local URLs after production deployment.

- [ ] **2.3 Apply API Scope Restrictions**:
  1. On the same page, scroll down to **API restrictions**.
  2. Select **Restrict key**.
  3. In the dropdown, check ONLY the following 3 APIs:
     - **Identity Toolkit API** (for Email/Password and Anonymous Authentication)
     - **Token Service API** (for Firebase STS token refresh)
     - **Cloud Firestore API** (for Firestore database reads and writes)
  4. Ensure no other APIs (such as Cloud Functions, Cloud Storage, or Realtime Database) are selected.
  5. Click **Save**.

---

## 3. Firebase Authentication Hardening (Section F)

- [ ] **3.1 Restrict Sign-In Providers**:
  1. Open [Firebase Console](https://console.firebase.google.com/) > **Build** > **Authentication** > **Sign-in method**.
  2. Ensure **Email/Password** is **Enabled** (Email link / passwordless should be Disabled).
  3. Ensure **Anonymous** is **Enabled** (required for sub-admin permission requests).
  4. Ensure all other providers (Google, Facebook, Phone, GitHub, Twitter, etc.) are **Disabled**.

- [ ] **3.2 Turn On Email Enumeration Protection**:
  1. In **Authentication** > **Settings** tab.
  2. Scroll down to **User account linking** and **Security**.
  3. Toggle **Email enumeration protection** to **Enabled**.
  4. This prevents attackers from testing whether specific email addresses exist in the project.

- [ ] **3.3 Restrict Authorized Domains**:
  1. In **Authentication** > **Settings** tab > **Authorized domains**.
  2. Review the list of authorized domains.
  3. Keep ONLY:
     - `iamkausarhayat.github.io`
     - `<project-id>.firebaseapp.com`
  4. Delete `localhost` and any staging domains once testing is complete.

- [ ] **3.4 Configure Session Duration & Inactivity**:
  1. Client-side inactivity auto-logout is enforced at **10 minutes** via `app.js` using `firebase.auth().signOut()`.
  2. For enterprise-grade token revocation, set Firebase ID Token lifetimes to the minimum allowed duration in the Google Cloud Identity Platform settings.
