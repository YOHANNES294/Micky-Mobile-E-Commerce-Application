# Micky Mobile Ethiopia - Mobile Marketplace Application

An e-commerce marketplace application for Samsung, iPhone, and premium mobile devices in Ethiopia, integrated with the official **Chapa Payment Gateway** for fast and secure digital payments (Telebirr, CBE Birr, Awash, Bank Cards).

---

## Features
- **Device Catalog**: Browse Samsung and iPhone devices with complete technical specifications (RAM, storage, battery, SIM, 5G/4G).
- **Secure Authentication**: Customer and Admin authentication via Supabase Auth with Row Level Security (RLS).
- **Chapa Payment Gateway Integration**:
  - Secure backend transaction initialization (`POST /api/payments/chapa/initialize`).
  - Server-side verification with Chapa API (`GET /api/payments/chapa/verify`).
  - Webhook listener with signature validation (`POST /api/payments/chapa/webhook`).
  - Customer checkout modal with order summary and instant redirection to Chapa hosted payment.
  - Return result screen (`/checkout/result`) with real-time status resolution (Success, Pending, Failed, Cancelled).
  - Customer order history & tracking (`/client/orders` & `/client/orders/[id]`).
  - Admin dashboard tab for managing customer orders and verified transactions (`/admin`).
- **Idempotency & Anti-Fraud Security**:
  - Authoritative price lookup from database (client-side price tampering prevention).
  - High-entropy unique transaction references (`MICKY-TX-...`).
  - Strict server-side verification of payment status, amount, and `ETB` currency.
  - Duplicate callback protection and decoupled fulfillment status.
  - Timing-safe webhook signature verification (`Chapa-Signature` / `x-chapa-signature`).

---

## Chapa Payment Integration Architecture

```
[ Customer ]
     │
     ▼ (1. Select device & Click "Pay with Chapa")
[ CheckoutModal ] ───► POST /api/payments/chapa/initialize
                             │
                             ├─► Validate user session & look up inventory price
                             ├─► Create pending order & payment records
                             └─► POST https://api.chapa.co/v1/transaction/initialize
                                      │
                                      ▼
[ Chapa Hosted Checkout ] ◄──── (Returns checkout_url & redirects)
     │
     ├─► Customer pays with Telebirr, CBE Birr, or Bank Card
     │
     ├──► [Customer Browser] Redirect to /checkout/result?tx_ref=...
     │         │
     │         └─► GET /api/payments/chapa/verify?tx_ref=...
     │                  │
     │                  └─► GET https://api.chapa.co/v1/transaction/verify/{tx_ref}
     │                           │
     │                           └─► Reconcile status & mark order completed
     │
     └──► [Asynchronous Webhook] POST /api/payments/chapa/webhook
               │
               ├─► Verify Chapa-Signature (Timing-safe HMAC/Secret Hash)
               └─► Secondary server-to-server check before updating records
```

---

## Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

### Required Environment Variables:

| Variable | Description | Example / Default |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase backend service role key | `sb_secret_...` |
| `APP_BASE_URL` | Application root URL for callbacks and return redirects | `http://localhost:3000` or `https://yourdomain.com` |
| `CHAPA_SECRET_KEY` | Chapa API Secret Key (Keep private!) | `CHASECK_TEST-xxxxxxxxxxxxxxxx` |
| `CHAPA_BASE_URL` | Official Chapa API base URL | `https://api.chapa.co/v1` |
| `CHAPA_WEBHOOK_SECRET` | Secret Hash defined in Chapa Webhook settings | `your_webhook_secret_hash` |

---

## Database Setup

Execute the migration script in your Supabase SQL Editor:

1. Open `scripts/007_create_payments_and_update_orders.sql`.
2. Run the script in the Supabase Dashboard SQL Editor.
3. This creates the `payments` table, adds `currency`, `fulfillment_status`, customer fields, and establishes RLS policies and performance indexes.

---

## Running the Application

### 1. Install dependencies:
```bash
npm install
```

### 2. Run automated test suite:
```bash
npm test
```

### 3. Start development server:
```bash
npm run dev
```

### 4. Build for production:
```bash
npm run build
```

---

## Testing Chapa in Sandbox Mode

Chapa provides a dedicated sandbox environment to test payments without real money.

1. **Test Secret Key**:
   - Register an account on [Chapa Dashboard](https://dashboard.chapa.co).
   - In the dashboard, switch to **Test Mode**.
   - Copy your test secret key starting with `CHASECK_TEST-...`.
   - Set it in your `.env.local`:
     ```env
     CHAPA_SECRET_KEY=CHASECK_TEST-your_test_key
     ```

2. **Simulating Test Payments**:
   - Open any phone in the app and click **Buy Now / ይግዙ**.
   - Choose **Chapa Gateway**, fill in your details, and click **Pay with Chapa**.
   - On Chapa's hosted test page, you can simulate successful or failed payments using Chapa's test simulator options or test cards.
   - Upon completion, you will be redirected to `/checkout/result` where your transaction is automatically verified.

3. **Configuring Webhooks on Chapa**:
   - In your Chapa Dashboard, navigate to **Settings** $\rightarrow$ **Webhooks**.
   - Set the Webhook URL to: `https://yourdomain.com/api/payments/chapa/webhook` (for local development, use an ngrok or local tunnel URL).
   - Define a **Secret Hash** (e.g. `micky_mobile_webhook_secret_2026`).
   - Add the same string to your `.env.local` as `CHAPA_WEBHOOK_SECRET`.

---

## Steps to Enable Live Payments

To accept real payments in Ethiopia:
1. Complete merchant verification (KYC/business registration) on the [Chapa Dashboard](https://dashboard.chapa.co).
2. Switch from **Test Mode** to **Live Mode**.
3. Generate your live secret key (starts with `CHASECK-...`).
4. Update your production environment variable:
   ```env
   CHAPA_SECRET_KEY=CHASECK-live_secret_key_here
   CHAPA_WEBHOOK_SECRET=your_production_secret_hash
   APP_BASE_URL=https://your-production-domain.com
   ```
5. Configure the live webhook URL on the Chapa dashboard.
6. Verify an end-to-end small live test transaction.
