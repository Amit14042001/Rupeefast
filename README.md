# RupeeFast — Android App

> Digital Micro Loan Platform · Borrower + Investor + Agent

**Version:** 1.0.0 · **Min Android:** 7.0 (API 24) · **Target:** Android 14 (API 34)

---

## What's Inside

A complete 3-sided fintech Android app with **45+ screens** across three user roles:

### 🟦 Borrower App
- Mobile OTP login
- Active loan dashboard with progress tracker
- Trust Score (AI credit score) viewer
- Loan application with real-time calculator (₹2,000–₹50,000)
- Repayment plan selection (Daily / Weekly / Monthly)
- KYC flow (Aadhaar eKYC → PAN → Selfie → Bank Account Aggregator)
- AI credit scoring animation (47 signals)
- Loan offer accept / e-sign
- Daily payment flow (UPI AutoPay / Manual / Agent collect)
- Full repayment schedule (100-day calendar)
- Transaction history
- Loyalty levels (Starter → Bronze → Silver → Gold)
- Group Loan / SHG (5-member community loans)
- Referral program (₹100 per referral)
- AI chat assistant (Claude-powered)
- Notifications center
- Profile & settings

### 🟩 Investor App
- Portfolio dashboard (₹ invested, monthly returns, default rate)
- Investment calculator (auto-diversification across borrowers)
- Risk bucket selection (🟢 SAFE / 🟡 MODERATE / 🔴 HIGH RISK)
- Real-time repayment graph
- Withdrawal flow
- Monthly statements & tax certificates
- Referral program (₹500 per investor)
- Notifications
- Profile

### 🟧 Agent App
- Daily task dashboard (collections, verifications, acquisitions)
- Collection workflow (GPS stamp + borrower OTP confirm)
- Borrower verification flow
- Recovery task management
- Earnings tracker (₹ per task + commissions)
- New borrower acquisition referral
- Performance leaderboard
- Profile

---

## How to Build

### Prerequisites
- **Android Studio** Hedgehog or newer (2023.1+)
- **JDK 17** (bundled with Android Studio)
- **Android SDK** API 34

### Steps

1. **Open project in Android Studio**
   ```
   File → Open → select `rupeefast-android/` folder
   ```

2. **Sync Gradle**  
   Android Studio will auto-sync. If prompted, click **Sync Now**.

3. **Run on device/emulator**
   - Connect Android device (Enable USB Debugging in Developer Options)
   - Click ▶ **Run** or press `Shift+F10`

4. **Build APK (Debug)**
   ```
   Build → Build Bundle(s)/APK(s) → Build APK(s)
   ```
   Output: `app/build/outputs/apk/debug/RupeeFast-1.0.0-debug.apk`

5. **Build APK (Release)**
   - Add your keystore file to `app/` folder
   - Update `signingConfigs.release` in `app/build.gradle`
   - ```
     Build → Generate Signed Bundle/APK → APK → (select keystore)
     ```

### Command Line Build
```bash
# Debug APK
./gradlew assembleDebug

# Release APK  
./gradlew assembleRelease

# Output location
app/build/outputs/apk/debug/RupeeFast-1.0.0-debug.apk
```

---

## AI Chat Setup (Optional)

The AI chat screen uses the Claude API. To enable it:

1. Get an API key from https://console.anthropic.com
2. Open `app/src/main/assets/index.html`
3. Find the `getAIReply` function and add your key:
   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'x-api-key': 'sk-ant-YOUR-KEY-HERE',
     'anthropic-version': '2023-06-01',
     'anthropic-dangerous-direct-browser-access': 'true'
   }
   ```
> ⚠️ For production, route API calls through your backend server — never expose API keys in client apps.

---

## App Architecture

```
MainActivity.java
  └── WebView (full screen, hardware accelerated)
       ├── file:///android_asset/index.html  (complete app UI)
       │    ├── Borrower screens (22 screens)
       │    ├── Investor screens (9 screens)
       │    └── Agent screens (11 screens)
       └── AndroidBridge (JS → Java)
            ├── onReady()
            ├── showToast(msg)
            └── vibrate()
```

**Why WebView?**  
The complete app UI is built in HTML/CSS/JS with pixel-perfect mobile design. The WebView approach:
- Preserves 100% of the original design fidelity
- Enables instant updates (just update `index.html`)
- Removes React Native/Flutter build complexity
- Works offline (all assets bundled)
- Full hardware acceleration enabled

---

## Screens List (45 total)

| # | Screen ID | Description |
|---|-----------|-------------|
| 1 | screen-home | Role selector splash |
| 2 | screen-b-login | Borrower login |
| 3 | screen-b-otp | OTP verification |
| 4 | screen-b-home | Borrower dashboard |
| 5 | screen-b-apply | Loan application + calculator |
| 6 | screen-b-kyc | KYC flow (4 steps) |
| 7 | screen-b-ai-score | AI credit scoring animation |
| 8 | screen-b-offer | Loan offer + e-sign |
| 9 | screen-b-score | Trust Score detail |
| 10 | screen-b-schedule | Repayment calendar |
| 11 | screen-b-pay | Payment flow |
| 12 | screen-b-history | Transaction history |
| 13 | screen-b-notif | Notifications |
| 14 | screen-b-loyalty | Loyalty levels + gamification |
| 15 | screen-b-referral | Referral program |
| 16 | screen-b-group | Group / SHG loans |
| 17 | screen-b-profile | Borrower profile |
| 18 | screen-b-settings | Settings & toggles |
| 19 | screen-b-ai | AI assistant chat |
| 20 | screen-i-login | Investor login |
| 21 | screen-i-home | Investor dashboard |
| 22 | screen-i-invest | Investment flow + risk buckets |
| 23 | screen-i-portfolio | Portfolio detail |
| 24 | screen-i-withdraw | Withdrawal flow |
| 25 | screen-i-statement | Monthly statement |
| 26 | screen-i-referral | Investor referral |
| 27 | screen-i-notif | Investor notifications |
| 28 | screen-i-profile | Investor profile |
| 29 | screen-a-login | Agent login |
| 30 | screen-a-home | Agent dashboard |
| 31 | screen-a-collect | Collection tasks |
| 32 | screen-a-verify | Verification tasks |
| 33 | screen-a-verify-detail | Borrower verification detail |
| 34 | screen-a-recovery | Recovery tasks |
| 35 | screen-a-recovery-detail | Recovery detail |
| 36 | screen-a-acquire | New borrower acquisition |
| 37 | screen-a-earnings | Agent earnings |
| 38 | screen-a-profile | Agent profile |

---

## Compliance Notes

> ⚠️ This is a UI prototype. Before going live, you must:

1. **RBI Registration** — Register as NBFC-P2P (min ₹2 Cr capital) or partner with licensed NBFC
2. **Data Privacy** — Implement DPDP Act 2023 consent flows for real data collection
3. **KYC APIs** — Integrate real Digilocker/Aadhaar/PAN verification APIs
4. **Payment Gateway** — Integrate Razorpay/Cashfree for real UPI AutoPay/NACH
5. **Account Aggregator** — Get Sahamati AA framework access
6. **Play Store** — Comply with Google Play's Financial Services policy (requires RBI license proof)

---

## Technology Stack (Production)
| Layer | Technology |
|-------|-----------|
| Mobile App | This Android app (WebView) |
| Backend API | Node.js + Python (FastAPI) |
| AI/ML | Python (credit scoring, fraud detection) |
| Database | PostgreSQL + Redis |
| Payments | Razorpay / Cashfree / Juspay |
| KYC | Digilocker + Aadhaar XML + Sahamati AA |
| Cloud | AWS / GCP (auto-scaling) |
| Communications | MSG91 / WhatsApp Business API |

---

*RupeeFast — Combine offline trust with online speed. That's the billion-dollar formula.*
