# 💰 Fine Collector - Class 8:00 AM Late Tracker

Fine tracking web app designed for managing late arrival records with multi-device synchronization and high-security Master Admin controls.

---

## 🔐 Master Admin & Multi-Device Security Architecture

### 👑 1. Master Admin (Owner)
- **Primary Owner Email:** `iamkausarhayat100@gmail.com`
- **Master Admin Password:** `4545` (Sirf Master Owner app ke andar se badal sakta hai).
- **Master Rights:**
  - Sirf Kausar Hayat (`iamkausarhayat100@gmail.com`) Admin Password change kar sakte hain.
  - Kisi bhi new mobile ya computer se aane wale admin ko **"Allow (Approve)"** ya **"Reject"** kar sakte hain (email link se ya app ke andar se).
  - Kisi bhi approved admin ko kabhi bhi **"Delete / Remove Admin"** karke foran kick out / lock out kar sakte hain.
  - Har new admin request ka email alert foran `iamkausarhayat100@gmail.com` par receive hota hai jismein 1-Click Approval link hota hai.

---

### 🛡️ 2. Sub-Admin (Co-Admin / CR) Permissions
- Jab koi aur banda kisi mobile par Admin banne ki koshish karega:
  1. Wo apna Full Name aur Password `4545` daalega.
  2. Foran login NAHI hoga! Screen par Live Waiting card aayega: *"Waiting for Kausar Hayat's Approval (iamkausarhayat100@gmail.com)"*.
  3. Kausar Hayat ke email (`iamkausarhayat100@gmail.com`) par foran alert jayega aur Master Admin ke screen par pop-up notification aayegi.
  4. Jab Kausar Hayat email ke link par ya app mein **"Allow Access"** dabayenge, tab ja kar us bande ka device foran unlock hoga aur wo **Sub-Admin** banega!
  5. Wo banda **kabhi bhi Master Admin NAHI ban sakta**.
  6. Sub-admin sirf late entry add kar sakta hai aur payment status update kar sakta hai. **Wo password change NAHI kar sakta**, na hi kisi aur ko admin bana sakta hai, na hi records delete kar sakta hai.

---

### 🔑 3. Kausar Hayat (Master Owner) Login Kaise Karein?
1. App mein **"Admin Login"** button dabayein.
2. Niche **"👑 Master Owner (Kausar Hayat) Login"** link par click karein.
3. Apna Password **`4545`** daal kar Verify dabayein.
4. Aapka device permanent Master Owner authenticate ho jayega.

---

### 📱 4. Authorized Admins Ko Dekhna Aur Delete / Remove Karna:
1. Master Admin login karne par top banner mein live count show hota hai: **"Active Admins: X"**.
2. **"Manage Admins"** button dabayein:
   - **Pending Requests Tab:** Yahan new requests aati hain jinhein aap **"Allow Access"** ya **"Reject"** kar sakte hain.
   - **Active Admins Tab:** Yahan sabhi active admins ki list unke Naam aur Mobile/Laptop ke sath dikhti hai. Kisi ko bhi nikaalne ke liye **"Delete Admin"** dabayein — wo banda usi second logout aur lock out ho jayega!
   - **Password & Alerts Tab:** Yahan se Master Admin apna password badal sakte hain jo central server ke through sabhi devices par live update ho jata hai.

---

## ☁️ Cloud Sync (Google Firebase)
Master PIN aur Admin Devices Google Firebase Realtime Database se live connected hain. Jab aap Master PIN badalte hain, toh woh sabhi devices par usi second automatically update ho jata hai!

