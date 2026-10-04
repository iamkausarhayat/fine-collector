# 💰 Fine Collector - Class 8:00 AM Late Tracker

Yeh web app aap aur aapke dost ke liye banayi gayi hai taake aap 8:00 AM class ke late aane wale students ka fine (Rs. 100) asaani se manage aur track kar sakein.

---

## 🌟 Main Features:

1. **Top Summary Cards (Sab ke liye visible):**
   - **Total Collected:** Total kitne paise jama ho chuke hain (Green).
   - **Pending Fine:** Kitne paise baqi hain (Red).
   - **Total Late Students:** Kitne students late aaye (aur aaj kitne aaye).

2. **8:10+ AM Rule:**
   - 8:00 AM se 8:10 AM ke darmiyan exact time likhein (e.g. 8:03 AM).
   - 10 minute ke baad aane walon ke liye **"8:10+ AM"** ka quick button dabayein.

3. **Admin vs Student Permissions:**
   - **Students (Public Link):** Sirf dekh sakte hain (Read-Only). Koi student data chhed ya badal nahi sakta.
   - **Admin (Aap aur Aapka Dost):** Secret PIN daal kar login honge. Entry add kar sakte hain, paise aane par **Tick Mark (Paid)** kar sakte hain, edit ya delete kar sakte hain.
   - **Default Admin PIN:** `8000` (aap app ke andar se kabhi bhi badal sakte hain).

4. **WhatsApp Direct Share Button:**
   - Ek click par Mam aur class group ke liye auto-formatted WhatsApp summary report generate hoti hai jismein link bhi shamil hota hai!

---

## 🚀 1. Apne Computer Par Abhi Test Kaise Karein?

Aap simply `index.html` file par double click karke kisi bhi browser (Chrome, Edge) mein open kar sakte hain, ya VS Code Live Server use kar sakte hain.

---

## 🌐 2. 24/7 Free Online Host Kaise Karein? (Taake PC band hone par bhi chale)

Aapko apna computer on rakhne ki bilkul zaroorat nahi hai. Aap ise **Vercel** ya **GitHub Pages** par 100% free upload kar sakte hain:

### Option A: Vercel (Sab se aasan tareeqa - 1 Minute)
1. [Vercel.com](https://vercel.com) par free account banayein.
2. "Add New Project" par click karein aur is folder (`money collect`) ko drag & drop karein ya GitHub se connect karein.
3. Vercel aapko ek free link de dega (jaise `https://fine-collector.vercel.app`).
4. Yeh link WhatsApp class group mein share kar dein!

---

## ☁️ 3. Real-Time Cloud Database (Google Firebase) - 100% Free

Jab aap aur aapka dost alag alag mobile phones se entry ya tick karenge, toh data Google Firebase ke zariye real-time sync hoga:

1. [Firebase Console](https://console.firebase.google.com) par jayein (Apni Gmail se login karein).
2. "Add Project" click karein aur naam rakhein (e.g. `fine-collector`).
3. Left menu se **Build > Realtime Database** par click karein aur **"Create Database"** dabayein.
4. **Rules** tab mein ja kar yeh rules set karein:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
5. Realtime Database ka URL copy karein (jaise `https://fine-collector-default-rtdb.firebaseio.com`).
6. App ke andar **Admin Login** karein > **"Cloud DB"** button dabayein > Database URL paste karke **"Connect Cloud Database"** par click karein!

Bas! Ab aapka computer 24 ghante band bhi rahega, tab bhi data 100% live cloud par rahega aur sabhi students ko har waqt dikhega.
