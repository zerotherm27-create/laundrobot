# LaundroBot Onboarding Guide

Welcome to LaundroBot! This guide walks you through everything you need to do to get your laundry business accepting orders through Facebook Messenger, Instagram, and your own online booking link.

**Setup takes about 30–60 minutes end-to-end.**

---

## Quick-Start Checklist

Use this to track your progress:

- [ ] 1. Sign up and start your 14-day free trial
- [ ] 2. Add your business logo, contact details, and store hours
- [ ] 3. Add your laundry services and pricing
- [ ] 4. Set up your delivery zones
- [ ] 5. Connect your Facebook Page via the "Connect Facebook Page" button in Settings
- [ ] 6. Add your Instagram Business Account ID (optional but recommended)
- [ ] 7. Test the Messenger bot with a real Facebook message
- [ ] 8. Set up online payments via Xendit
- [ ] 9. Turn on the AI chatbot
- [ ] 10. Add FAQs so the bot can answer common questions
- [ ] 11. Invite your staff

---

## Step 1 — Sign Up

1. Go to **[laundrobot.app](https://laundrobot.app)** and click **"Start Free Trial"**.
2. Fill in your business name, email address, and a password (at least 8 characters).
3. Click **"Create Account"** — your 14-day free trial starts immediately.

You will be logged in and taken to your dashboard. No credit card is needed during the trial.

> **Subscription Plans**
> After your trial, choose a plan to keep your account active:
> - **Starter** — ₱999/month (or ₱9,990/year)
> - **Pro** — ₱5,499/month (or ₱54,990/year) — includes custom domain, white-label booking form, up to 10 branches, and priority support

---

## Step 2 — Configure Your Shop

Go to **Settings** in the left sidebar and fill in the following:

### Business Logo
Click **"Upload logo"** and choose a PNG or JPG file (max 2 MB). Your logo appears on customer invoices and the booking form.

### Order Notifications
Enter the **email address** where you want to receive new order alerts and payment confirmations.

### Customer Contact Number
Enter your shop's **phone number** (e.g., `09XX XXX XXXX`). Customers see this on their order confirmation screen so they can call or text you.

### Shop Address
Enter your **full address** (e.g., 123 Main St, Barangay, City, Province). This appears on invoices.

### Store Hours & Booking Window

| Field | What it controls |
|---|---|
| **Store Opens** | Earliest time slot customers can select |
| **Store Closes** | Latest time slot customers can select |
| **Same-Day Booking Cutoff** | After this time, today's date is no longer available; customers must book for tomorrow |

**Example:** Store Opens `07:00`, Booking Cutoff `15:00`, Store Closes `20:00` — customers can book same-day pickups until 3 PM.

### Minimum Order Amount
Enter the minimum order total (in ₱) a customer must reach before they can check out. Leave blank to accept any amount.

### Walk-In QR Payment
If you accept GCash or Maya for walk-in customers, upload your QR code image to any image hosting service (Google Drive, Imgur, etc.) and paste the direct image link here. This QR will appear on the walk-in POS payment screen.

Click **"Save Settings"** when done.

---

## Step 3 — Add Blocked Dates (Optional)

Still in Settings, scroll down to **"Blocked Dates"** and block any dates your shop will be closed (holidays, staff days off, etc.). Customers will not be able to book for those dates.

---

## Step 4 — Add Your Services & Pricing

Go to **Services** in the sidebar.

### Create Categories First
Categories group your services (e.g., "Wash Only", "Wash & Dry", "Dry Cleaning", "Special Items"). Click **"+ Add Category"**, enter a name, and save.

### Add Services
For each service you offer, click **"+ Add Service"** and fill in:

| Field | Example |
|---|---|
| **Name** | "Regular Wash & Dry" |
| **Category** | Wash & Dry |
| **Price** | 120 |
| **Unit** | per kg |
| **Description** | "Machine washed and tumble dried" |
| **Image** | Optional photo of the service |

Repeat for each service. You can drag services to reorder them, and toggle any service active or inactive.

> **Tip:** Start with your 3–5 most popular services. You can add more anytime.

---

## Step 5 — Set Up Delivery Zones

Go to **Delivery Zones** in the sidebar.

### Option A: Zone-Based Delivery (Flat Fees)
Best if you deliver to specific barangays or areas with fixed fees.

1. Click **"+ Add Zone"**
2. Enter the zone name (e.g., "Barangay Poblacion") and the flat delivery fee (e.g., ₱50)
3. Add as many zones as needed

### Option B: Distance-Based Delivery (Brackets)
Best if your delivery fee increases with distance.

1. First, set your **shop location** by searching your address on the map
2. Then add distance brackets:
   - 0–5 km → ₱50
   - 5–10 km → ₱100
   - 10–20 km → ₱150

You can use both options together if needed.

---

## Step 6 — Connect Facebook Messenger

This is the most important step — it links your Facebook Page to the LaundroBot chatbot so customers can order via Messenger.

### Before you start
- Your business must have an existing **Facebook Page** (not a personal profile)
- You must be an **Admin** of that Page
- Log into LaundroBot with the same Facebook account that manages your Page

### 6a. Click "Connect Facebook Page"

1. Go to **Settings** in your LaundroBot dashboard
2. Scroll to the **"Connect Facebook Page"** card
3. Click the blue **"Connect Facebook Page"** button
4. A Facebook login popup will appear — log in and click **"Continue"** when asked to grant permissions

> **Note:** Facebook will ask for permission to manage your Pages and send messages. These permissions are required for the bot to work.

### 6b. Select your Page

After logging in, LaundroBot will show a list of all Facebook Pages you admin. Select your laundry business Page and click **"Save & Connect Page"**.

The bot is now connected and the Messenger menu (**Book Now**, **My Orders**, **FAQs**) is set up automatically.

### 6c. Test the connection

1. Go to your Facebook Page
2. Click **"Send Message"**
3. Tap **"Get Started"**
4. You should see: *"Hi [Your Name]! Welcome to [Your Shop]. Tap 'Get Started' to book your laundry pickup!"*
5. Tap **"Book Now"** — the booking form should open inside Messenger

> **Note:** The greeting and Get Started button only appear for customers who have **never messaged your Page before**. Existing followers can open the menu by tapping the **☰ icon** at the bottom-left of the chat window.

If anything goes wrong, scroll down in Settings to **"Facebook Messenger Menu"** and click **"Reset Messenger Menu"** to re-apply the bot configuration. If the problem persists, email **hello@laundrobot.app**.

---

## Step 7 — Connect Instagram Direct Messages

Instagram DM ordering lets customers place orders by messaging your Instagram Business account — the same bot flow as Messenger.

> **Important:** Instagram DM access requires Meta to approve the `instagram_manage_messages` permission for your app. The LaundroBot team manages this app-level approval. Once approved, you can activate it by following the steps below.

### 7a. Find your Instagram Business Account User ID

1. Go to **[Meta Business Suite](https://business.facebook.com)** → **Settings** → **Accounts** → **Instagram Accounts**
2. Click on your Instagram account
3. Your **Account ID** is shown — it's a long number (e.g., `17841400000000000`)

Alternatively, ask the LaundroBot team and they can look it up for you.

### 7b. Add it to your settings

1. Go to **Settings** in your LaundroBot dashboard
2. Scroll to **"Instagram Messaging"**
3. Paste your **Instagram Business User ID** into the field
4. Click **"Save Settings"**

> **Current status:** Instagram DM replies are pending Meta App Review approval. Once approved, both sending and receiving messages will work automatically. The LaundroBot team will notify you when this is live.

---

## Step 8 — Enable Online Payments via Xendit

Xendit lets your customers pay online using GCash, Maya, credit/debit cards, bank transfers, and e-wallets — directly from the booking form or a payment link you send to them.

### 8a. Create a Xendit account

1. Go to **[xendit.co](https://xendit.co)** and sign up for a business account
2. Complete their verification process (requires business documents)
3. Once verified, you will have access to the Xendit Dashboard

### 8b. Get your API key

1. In the Xendit Dashboard, go to **Settings** → **Developers** → **API Keys**
2. Click **"Generate secret key"**
3. Choose **"Money-in products"** permissions
4. Copy the key — it starts with `xnd_production_...`

### 8c. Send your API key to the LaundroBot team

Email **hello@laundrobot.app** with:

- Your **Xendit Secret API Key**
- Your **LaundroBot account email**

The team will add your key to your account configuration.

### 8d. What happens after setup

Once configured, your customers will see a **"Pay Online"** option in the booking form. When they pay, you receive:

- An email confirmation with the order details
- A Messenger message sent to the customer confirming payment
- The order automatically marked as **Paid** on your Kanban board

> **Note:** Xendit charges a processing fee per transaction (typically 2.5–3.5%). Check your Xendit dashboard for the current rates.

---

## Step 9 — Enable the AI Chatbot

The AI chatbot (powered by Google Gemini) handles customer questions outside of the booking flow — things like "What are your prices?", "Do you offer express service?", or "Where are you located?" — in English, Tagalog, and Taglish, 24/7.

### 9a. Turn on AI replies

1. Go to **Settings** in your dashboard
2. Scroll to **"AI Messenger Replies"**
3. Toggle **"AI replies"** to ON
4. Click **"Save Settings"**

> **How it works:** When a customer sends a message that is not part of the booking flow, the AI reads your FAQs and service list to answer their question. If it cannot answer, it shows the main menu.

### 9b. Set the AI pause duration

When you (or a staff member) manually replies to a customer from the Facebook Page inbox, the AI automatically pauses so you can handle the conversation personally. You can set how many hours the AI stays paused:

- **Recommended:** 2 hours
- Set to **0** to disable the pause (AI will resume immediately after any manual reply)

### 9c. Custom AI Instructions (Pro plan only)

On the Pro plan, you can give the AI custom instructions to shape its personality and behavior. Examples:

```
Laging sumagot sa Tagalog. Maging magalang at mainit sa puso.
Huwag mag-usap tungkol sa ibang laundry shops.
Palaging magtapos ng mensahe ng "Salamat sa inyong tiwala! 🙏"
```

Add these in **Settings** → **AI Messenger Replies** → **AI Instructions**.

---

## Step 10 — Add FAQs

FAQs are the main knowledge base the AI uses to answer customer questions. Go to **FAQs** in the sidebar.

Click **"+ Add FAQ"** and enter:
- **Question:** e.g., "How long does delivery take?"
- **Answer:** e.g., "Delivery takes 1–2 hours within our delivery zones. Same-day pickup is available until 3 PM."

Add as many FAQs as you can — the more you add, the better the AI will perform.

### AI-Suggested FAQs

Once you have had real conversations with customers, go to **FAQs** and click **"AI Suggest"**. LaundroBot will analyze your recent conversations and suggest questions you should add. Review each suggestion and click **"Add"** to save it.

---

## Step 11 — Invite Your Staff

Go to **Users** in the sidebar and click **"+ Invite Staff"**. Enter their email address. They will receive a login link and can start managing orders immediately.

> Staff members have access to the Kanban board, Orders, Customers, and Messaging sections. Only the account owner (admin) can change settings, services, or payment configuration.

---

## Step 12 — How Customers Place Orders

Once everything is set up, your customers can order in three ways:

### Via Facebook Messenger
1. Customer goes to your Facebook Page and clicks **"Send Message"**
2. They tap **"Get Started"** (first-time users) or tap **"🛒 Book Now"** in the menu
3. A booking form opens inside Messenger
4. They choose a service, enter their details (address, pickup date, etc.), and submit
5. You receive an order notification email, and the order appears on your Kanban board

### Via Your Booking Link
Share the link **`laundrobot.app/book/[your-tenant-id]`** anywhere — Facebook posts, WhatsApp groups, SMS, QR codes on your flyers. Customers can book without needing Messenger.

> Your booking link can be found by opening the booking form from your dashboard.

### Via the Walk-In POS
For customers who call or walk in, go to **Walk-in** in the sidebar. Fill in their details and create the order directly — no Messenger needed.

---

## Step 13 — Managing Orders (Kanban Board)

Go to **Kanban** (your main dashboard) to see all orders.

Orders move through these statuses:

| Status | Meaning |
|---|---|
| **NEW ORDER** | Just received, not yet assigned to a rider/staff |
| **ASSIGNED** | Rider assigned, pickup scheduled |
| **READY FOR PICKUP** | Laundry is done, ready for delivery |
| **COMPLETED** | Order delivered and done |
| **CANCELLED** | Order was cancelled |

**To update an order:**
- **Drag** the order card to move it to the next column
- Click an order card to **add notes**, **mark as paid**, or **send a Messenger update** to the customer
- Click **"Generate Payment Link"** to send the customer a Xendit payment link via Messenger

---

## Step 14 — Sending Promotions to Customers

Go to **Messaging** in the sidebar to send a broadcast message to all your customers (or filtered by order status).

**Example blast:** *"🎉 This weekend only: 10% off all orders! Book now at m.me/YourPageName"*

> **Note:** Only customers who have previously messaged your Facebook Page can receive blast messages (Meta policy).

---

## Step 15 — Promo Codes (Growth & Pro Plans)

Go to **Settings** → **Promo Codes** to create discount codes customers can apply at checkout.

Configure:
- **Code** (e.g., `WELCOME50`)
- **Discount** — fixed amount (e.g., ₱50 off) or percentage (e.g., 10% off)
- **Minimum order amount** (optional)
- **Maximum uses** (optional, blank = unlimited)
- **Expiry date** (optional)

---

## Troubleshooting

### Messenger bot is not responding
- Confirm the LaundroBot team has set up your Facebook Page (Step 6d)
- Check that your Page Access Token is still valid — tokens can expire if you change your Facebook password
- Make sure your Page is published (not in Draft mode)

### "Reset Messenger Menu" shows an error
- This usually means your Page Access Token has expired or does not have the correct permissions
- Email hello@laundrobot.app and include the error message

### The booking form is not loading in Messenger
- This is a domain whitelisting issue — contact hello@laundrobot.app to resolve it

### Customers do not see the Get Started button
- The Get Started button only appears for users who have **never** messaged your Page before
- Existing followers will see the chat directly — tell them to tap **☰** to open the menu

### Payments are not being recorded
- Confirm your Xendit API key is set up (Step 8c)
- Xendit payments can take a few minutes to process after a customer pays

### AI is not answering questions
- Confirm AI replies are toggled ON in Settings
- Add more FAQs — the AI relies on your FAQs to answer accurately
- Check that the GEMINI_API_KEY is configured by the LaundroBot team (server-side)

---

## Need Help?

- **Email:** hello@laundrobot.app
- **Messenger:** m.me/laundrobot (if available)
- **Facebook Page setup, Xendit integration, or technical issues:** Always include your LaundroBot account email in your message so we can look up your account quickly.
