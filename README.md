# 💰 Fine Collector - Class 8:00 AM Late Tracker

Fine tracking web app designed for managing late arrival records with multi-device live synchronization, Master Mind controls, and full real-time audit logging.

---

## 🔐 Master Admin & Multi-Device Security Architecture

### 👑 1. Master Mind (Owner - Kausar Hayat)
- **Authority:** Kausar Hayat (Master Mind) has exclusive full authority over the system.
- **Master Admin Password:** `4545` (Sirf Master Owner app ke andar se badal sakta hai).
- **Master Rights:**
  - Sirf Kausar Hayat Admin Password change kar sakte hain.
  - Kisi bhi device se aane wale admin ko Master Page ke andar se **"Allow Access"** ya **"Reject"** kar sakte hain.
  - Kisi bhi approved admin ko kabhi bhi **"Delete / Remove Admin"** karke foran kick out / lock out kar sakte hain.
  - Admin ke exact name ke mutabiq unique **4-digit Private Key** assign kar sakte hain.
  - **Live Audit Trail:** Master Page par har admin ki live activity dekh sakte hain (kis time login kiya, kya CRUD changes kiye, kon sa record add, edit, delete ya pay kiya).

---

## 🛡️ 2. Sub-Admin Login & Mastermind Approval Flow

### Step 1: Pehli Dafa Entry & Mastermind Approval
1. New admin apna Full Name aur Password `4545` daalta hai.
2. **Koi email nahi jaati!** Live waiting screen open hoti hai: *"Wait for Master Mind Permission"*.
3. Request foran Master Mind ke screen aur **Admin Access Management (Pending Requests)** mein show hoti hai.
4. Master Mind jaise hi **"Allow Access"** dabata hai, us bande ka screen usi waqt unlock ho jata hai aur wo Sub-Admin ban jata hai.

### Step 2: Logout & Private Key Re-entry
1. Jab wo banda admin page se **Logout** karega, toh uski direct access lock ho jayegi.
2. Master Mind us bande ke exact name (e.g. `Ali Khan`) ke liye ek **4-digit Private Key** (e.g. `7890`) generate kar deta hai.
3. Jab wo banda dobara login karega:
   - Apna wahi exact Name
   - Admin Password `4545`
   - Master Mind ki banai hui **Private Key**
4. Teeno cheezein match hote hi usko direct access mil jayegi!

---

## 📊 3. Master Mind Real-Time Activity & Audit Logs (Master Page)

Master Page ke andar **"Activity & Audit Logs"** tab mein Master Mind ko sabhi details real-time show hoti hain:
- **Login / Access History:** Kis time kis admin ne kis device se private key ke sath access kiya.
- **Create (Add) Logs:** Kis admin ne kis time kis student ka record add kiya (fine, arrival time, date, status).
- **Update (Payment / Edit) Logs:** Kis student ko kis time "Paid" ya "Pending" mark kiya gaya, ya record edit kiya gaya.
- **Delete Logs:** Kis student ka late record kis time delete kiya gaya.
- **Logout Logs:** Kis time kis admin ne logout kiya.
- **Filter by Admin:** Kisi bhi specific admin ka poora timeline ek click par filter karke dekhein.

---

## ☁️ Cloud Sync (Google Firebase Realtime Database)
Records, Security PIN, Devices, Private Keys, aur Audit Logs 24/7 Firebase Realtime Database se live synchronized hain.
