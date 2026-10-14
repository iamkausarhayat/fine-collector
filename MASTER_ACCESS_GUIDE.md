# Master Mind Access Guide - Fine Collector

This guide explains how to initialize and log into the **Master Page** as the System Owner (**Kausar Hayat**).

---

## Step 1: Create the Master User in Firebase Authentication

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`fine-collector`).
2. In the left navigation menu, navigate to **Build** > **Authentication**.
3. Under the **Users** tab, click the **Add user** button.
4. Enter the exact master email address:
   - **Email**: `master@fine-collector.app`
5. Enter your secure master passcode (must be at least 8 characters).
6. Click **Add user**.

---

## Step 2: Copy the User UID

1. Locate the newly created user `master@fine-collector.app` in the Authentication table.
2. Under the **User UID** column, copy the UID string (e.g., `8dF92kL1...`).

---

## Step 3: Create the Master Document in Cloud Firestore

1. In the left navigation menu, navigate to **Build** > **Firestore Database**.
2. Click **Start collection** (or click into the `admins` collection if it already exists):
   - **Collection ID**: `admins`
3. Click **Next**.
4. In the document creation dialog:
   - **Document ID**: Paste the exact UID you copied in Step 2.
5. Add the following fields:
   - Field: `role` | Type: `string` | Value: `master`
   - Field: `name` | Type: `string` | Value: `Kausar Hayat`
6. Click **Save**.

---

## Step 4: Open the Site & Log In

1. Open the Fine Collector website in your browser:
   `https://iamkausarhayat.github.io/fine-collector/`
2. Click the **Admin Login** button in the top-right header.
3. In the modal, click the gold link at the bottom: **"👑 Master Mind (Kausar Hayat) Login"**.
4. Type your Master Passcode into the password field.
5. Click **Verify as Master Mind**.

---

## Step 5: What You Should See (Master Page)

Upon successful verification:
- A welcome toast notification appears: `"Welcome Master Mind (Kausar Hayat)"`.
- The top header banner updates with the gold **👑 Master Admin** badge.
- The **Manage Admins** button appears in the banner.
- Clicking **Manage Admins** opens the Master Portal containing the **4 Management Tabs**:
  1. **Pending Requests**: Review incoming live access requests from sub-admins with options to **Allow Access**, **Reject**, or **Assign Key**.
  2. **Active Admins**: View all currently approved sub-admins with the ability to instantly **Delete Admin** (revoking all server permissions).
  3. **Private Keys**: Issue custom 6-digit Private Keys registered in Firebase Auth with one-time display.
  4. **Activity & Audit Logs**: Real-time tamper-proof audit trail of all student records created, payment status updates, edits, deletions, and logins.

---

## Step 6: Troubleshooting & Common Issues

| Error / Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"User is not configured as Master Mind"** | The Firestore document in `/admins/<UID>` is missing or has the wrong role. | Verify that `/admins/<UID>` exists in Firestore, that the Document ID matches the Auth UID exactly, and `role` is set to `master`. |
| **"Invalid credentials / user not found"** | Email misspelled or wrong passcode. | Confirm the email in Firebase Auth is exactly `master@fine-collector.app` and re-enter your passcode. |
| **"Too many failed attempts. Locked for 5 minutes"** | Client lockout triggered after 3 incorrect passcode entries. | Wait for the 5-minute countdown to expire, or reload the page in a fresh tab. |
| **"Permission denied" on Firestore actions** | Firestore Security Rules not published or UID mismatch. | Copy the rules from `MASTER_RULES_TO_PASTE.txt` and publish them in the Firestore Rules console. |

---

## Step 7: How to Change Your Passcode Later

For maximum security, there is no password change form exposed on the web. Passcode changes are performed exclusively inside Google's secure console:

1. Open [Firebase Console](https://console.firebase.google.com/) > **Authentication** > **Users**.
2. Find `master@fine-collector.app`.
3. Click the three dots (⋮) on the right side of the row.
4. Select **Reset password** (sends email link) or delete and re-create the user with the new passcode while preserving the same UID in Firestore.
