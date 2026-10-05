# 💰 Fine Collector - Class 8:00 AM Late Tracker

Fine tracking web app designed for managing late arrival records with multi-device synchronization and high-security Master Admin controls.

---

## 🔐 Master Admin & Multi-Device Security Architecture

### 👑 1. Master Admin (Owner)
- **Primary Owner Email:** `iamkausarhayat@gmail.com`
- **Master Security Passkey / Code:** `4545` (Aap app ke andar se kabhi bhi badal sakte hain).
- **Default Master PIN:** `9922`
- **Master Rights:**
  - Sirf Kausar Hayat Master PIN change kar sakte hain.
  - Kisi bhi new mobile ya computer se aane wale admin ko **"Allow (Approve)"** ya **"Reject"** kar sakte hain.
  - Kisi bhi pehle se approved admin ko kabhi bhi **"Revoke / Remove"** karke foran bahar nikaal sakte hain.
  - Har new admin request aur unauthorized PIN change attempt ka email alert foran `iamkausarhayat@gmail.com` par receive hota hai.

---

### 🛡️ 2. Sub-Admin (Co-Admin / CR) Permissions
- Jab aap kisi dost ko Master PIN batayenge:
  1. Wo apne mobile/laptop par PIN daalega.
  2. Foran login nahi hoga! Screen par aayega: *"Admin PIN Verified! Enter your name to request Master Admin approval"*.
  3. Wo apna naam likh kar request bhejega.
  4. Aapke mobile par **Real-time Alert Banner** aayega aur aapke email (`iamkausarhayat@gmail.com`) par foran notification aayegi.
  5. Jab aap **"Allow Access"** dabayenge, tabhi us bande ka device foran unlock hoga!
  6. Sub-admin late entry add kar sakta hai aur payment tick kar sakta hai, lekin **wo Master PIN change NAHI kar sakta**, na hi dusre admins ko approve kar sakta hai.
  7. Agar sub-admin PIN change karne ki koshish karega, toh system foran block karega aur aapko alert email bhej dega!

---

### 🔑 3. Kausar Hayat (Master Owner) Login Kaise Karein?
1. App mein **"Admin Login"** button dabayein.
2. Aap direct PIN wale box mein bhi **`4545`** daal kar Enter kar sakte hain, ya **"👑 Master Owner (Kausar)"** tab mein **`4545`** daal sakte hain.
3. Bas! Aapka device permanent Master Owner ban jayega.

---

### 📱 4. Authorized Admins Ko Manage Aur Remove Kaise Karein?
1. Master Admin login karne ke baad top bar mein **"Manage Admins"** button dabayein.
2. **Pending Requests Tab:** Yahan new requests dikhengi jinhein aap ek click par **"Allow Access"** ya **"Reject"** kar sakte hain.
3. **Approved Admins Tab:** Yahan active sub-admins ki list dikhegi. Kisi ko bhi nikaalne ke liye **"Revoke / Remove"** dabayein — wo banda usi second logout ho jayega!
4. **Security & Alerts Tab:** Yahan aap apna Master Passkey badal sakte hain aur email notification test kar sakte hain.

---

## ☁️ Cloud Sync (Google Firebase)
Master PIN aur Admin Devices Google Firebase Realtime Database se live connected hain. Jab aap Master PIN badalte hain, toh woh sabhi devices par usi second automatically update ho jata hai!

