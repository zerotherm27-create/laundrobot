# LaundroBot Onboarding Guide

Welcome to LaundroBot! This guide walks you through everything you need to get your laundry business accepting orders through Facebook Messenger, Instagram, and your own online booking link.

**Setup takes about 30–60 minutes end-to-end.**

---

## Quick-Start Checklist

- [ ] 1. Configure your shop details, store hours, and open days
- [ ] 2. Connect your Facebook Page (enables Messenger bot)
- [ ] 3. Add your services and pricing
- [ ] 4. Enable online payments (Xendit or QR Code)
- [ ] 5. Set up delivery zones
- [ ] 6. Enable the AI chatbot
- [ ] 7. Add FAQs
- [ ] 8. Invite your staff
- [ ] 9. Test the bot — send yourself a message on Facebook
- [ ] 10. *(Optional)* Connect Instagram DMs
- [ ] 11. *(Pro only)* Set up your custom domain and white-label booking form

---

## Step 1 — Configure Your Shop

Go to **Settings** in the left sidebar and fill in the following sections.

### Business Logo *(Pro plan only)*
Upload your logo (PNG or JPG, max 2 MB). It appears on the top of your booking form and on customer invoices. On Starter and Growth plans the upload is locked — you'll see an upgrade prompt instead.

### Shop Address
Enter your full address (e.g., `123 Main St, Barangay, City, Province`). Shown on invoices.

### Customer Contact Number
Enter your shop's phone number (e.g., `09XX XXX XXXX`). Customers see this on their order confirmation screen so they can call or text you.

### Store Hours & Booking Window

| Field | What it controls |
|---|---|
| **Open Days** | Days of the week your shop accepts bookings |
| **Store Opens** | Earliest time slot customers can book |
| **Store Closes** | Latest time slot customers can book |
| **Same-Day Booking Cutoff** | After this time, today is no longer bookable — customers must pick tomorrow |

**Open Days** — Toggle each day (Sun through Sat) to set when you're open. Closed days are automatically skipped on the booking form; customers cannot select them.

**Example:** Store Opens `07:00`, Cutoff `15:00`, Store Closes `20:00` — customers can book same-day pickups until 3 PM. If all slots on a day are past the cutoff, the form jumps to the next available open day automatically.

### Blocked Dates
In the same section, click **"+ Block Date"** to mark specific dates your shop will be closed — holidays, staff days off, etc. Customers won't be able to book those dates. Add a reason (optional) so it's easy to remember later.

### Minimum Order Amount
Enter the minimum cart total (in ₱) a customer must reach before they can check out. Leave blank to accept any amount.

Click **"Save Settings"** when done.

---

## Step 2 — Connect Your Facebook Page

This links your Facebook Page to the LaundroBot chatbot so customers can order via Messenger.

### Before you start
- You need an existing **Facebook Page** (not a personal profile)
- You must be an **Admin** of that Page

### Connect the Page

1. Go to **Settings** → scroll to **"Connect Facebook Page"**
2. Click the blue **"Connect Facebook Page"** button
3. A Facebook login popup appears — log in and grant the requested permissions
4. Select your laundry business Page from the list
5. Click **"Save & Connect Page"**

The bot is now live and the Messenger menu (**Book Now**, **My Orders**, **FAQs**) is set up automatically.

> **Note:** Facebook asks for permission to manage your Pages and send messages — these are required for the bot to work.

### Test the connection

1. Go to your Facebook Page and click **"Send Message"**
2. Tap **"Get Started"**
3. You should see a welcome greeting and the **"Book Now"** button
4. Try tapping **"Book Now"** — the booking form should open inside Messenger

> The **Get Started** button only appears for users who have **never** messaged your Page before. Existing followers can open the menu by tapping the **☰ icon** at the bottom-left of the chat window.

If anything goes wrong, scroll to **"Facebook Messenger Menu"** in Settings and click **"Reset Messenger Menu"** to re-apply the bot configuration. If the issue persists, email **hello@laundrobot.app**.

---

## Step 3 — Add Services & Pricing

Go to **Services** in the sidebar.

### Create Categories First
Categories group your services (e.g., "Wash Only", "Wash & Dry", "Dry Cleaning", "Special Items"). Click **"+ Add Category"**, enter a name, and save.

### Add Services
For each service, click **"+ Add Service"** and fill in:

| Field | Example |
|---|---|
| **Name** | "Regular Wash & Dry" |
| **Category** | Wash & Dry |
| **Price** | 120 |
| **Unit** | per kg |
| **Description** | "Machine washed and tumble dried" *(optional)* |
| **Image** | *(optional)* |

Repeat for each service. You can drag services to reorder them and toggle any active or inactive.

> **Tip:** Start with your 3–5 most popular services. You can add more anytime.

---

## Step 4 — Enable Online Payments

LaundroBot supports two payment modes — choose one that fits your setup.

### Option A — Xendit (Recommended, fully automated)

Customers pay via GCash, Maya, credit/debit cards, or e-wallets directly from the booking form. Payment confirmation is automatic.

1. Sign up at **[xendit.co](https://xendit.co)** and complete their verification
2. In the Xendit Dashboard go to **Settings → Developers → API Keys → Generate secret key** (choose "Money-in products")
3. Copy the key — it starts with `xnd_production_...`
4. In LaundroBot → **Settings → Online Payment Method**, select **"Xendit"**, paste your key, and click **"Save Settings"**

The key is validated before saving. Once set, a **"Pay Online"** button appears in the booking form. When a customer pays, the order is automatically marked **Paid** on your Kanban board and the customer receives a Messenger confirmation.

> Xendit charges a processing fee per transaction (typically 2.5–3.5%). Check your Xendit dashboard for current rates.

### Option B — GCash / Maya QR Code (Manual confirmation)

Use this if you don't have a Xendit account yet or prefer customers to scan your existing merchant QR.

1. In **Settings → Online Payment Method**, select **"QR Code"**
2. Upload your GCash or Maya merchant QR image in the **"Payment QR Code"** section
3. Click **"Save Settings"**

After a customer submits a booking, your QR code is shown on screen for them to scan and pay. They then upload a payment screenshot. You review it in **Orders**, click **"View Screenshot"**, and click **"Confirm Payment"** to mark the order paid.

> With QR Code mode, payments are **not automated** — you must confirm each one manually.

### Switching Between Modes
You can switch at any time in **Settings → Online Payment Method**. Existing orders are not affected.

---

## Step 5 — Set Up Delivery Zones

Go to **Delivery Zones** in the sidebar.

### Option A — Zone-Based (Flat Fees)
Best for shops that deliver to specific barangays or areas.

1. Click **"+ Add Zone"**
2. Enter the zone name (e.g., "Barangay Poblacion") and a flat delivery fee (e.g., ₱50)
3. Add as many zones as needed

### Option B — Distance-Based (Brackets)
Best if your delivery fee increases with distance.

1. Set your **shop location** by searching your address on the map
2. Add distance brackets, e.g.:
   - 0–5 km → ₱50
   - 5–10 km → ₱100
   - 10–20 km → ₱150

You can use both options together.

---

## Step 6 — Enable the AI Chatbot

The AI chatbot (powered by Google Gemini) handles customer questions outside of the booking flow — prices, turnaround times, locations, etc. — in English, Tagalog, and Taglish, 24/7.

1. Go to **Settings → "AI Messenger Replies"**
2. Toggle **"AI replies"** ON
3. Click **"Save Settings"**

When a customer asks something that isn't part of the booking flow, the AI reads your FAQs and service list to answer. If it can't answer, it falls back to the main menu.

> **Daily reply limits:**
> - Starter: 100 replies/day
> - Growth: 500 replies/day
> - Pro: unlimited
>
> The counter resets at midnight. When the limit is reached, the bot falls back to the standard button menu for the rest of the day.

### AI Pause (when you reply manually)
When you or a staff member reply directly from the Facebook Page inbox, the AI pauses automatically so you can handle the conversation. You can set how many hours it stays paused (recommended: 2 hours) in **Settings → AI Pause Duration**.

### Custom AI Instructions *(Pro plan only)*
Give the AI a personality and custom rules. Add these in **Settings → AI Messenger Replies → AI Instructions**. Example:

```
Laging sumagot sa Tagalog. Maging magalang at mainit sa puso.
Huwag mag-usap tungkol sa ibang laundry shops.
Palaging magtapos ng mensahe ng "Salamat sa inyong tiwala! 🙏"
```

---

## Step 7 — Add FAQs

FAQs are the primary knowledge base the AI uses to answer customer questions.

Go to **FAQs** in the sidebar → click **"+ Add FAQ"** → enter a question and answer.

**Examples to start with:**
- "How long does laundry take?" → "Turnaround is 4–6 hours for standard wash & dry."
- "Do you offer pick-up and delivery?" → "Yes, within our delivery zones. Add your address when booking."
- "What payment methods do you accept?" → "GCash, Maya, and credit/debit cards online. Cash accepted for walk-in."

Add as many as you can — the more FAQs you have, the more accurately the AI will answer.

### AI-Suggested FAQs
Once you have real customer conversations, click **"AI Suggest"** in the FAQs page. LaundroBot analyzes your recent chats and suggests questions you should add. Review each one and click **"Add"** to save.

---

## Step 8 — Invite Your Staff

Go to **Users** in the sidebar → click **"+ Invite Staff"** → enter their email address.

They'll receive a login link and can start managing orders immediately. Staff have access to the Kanban board, Orders, Customers, and Messaging. Only the account owner (admin) can change settings, services, or payment configuration.

---

## Step 9 — Test the Bot

Before going live, do a full test yourself:

1. Open your Facebook Page and click **"Send Message"**
2. Tap **"Get Started"** — you should see the welcome message
3. Tap **"Book Now"** — the booking form should open
4. Complete a test booking and verify:
   - Closed days are skipped in the date picker
   - Blocked dates are not selectable
   - The correct payment method appears
   - You receive an order notification email
   - The order appears on your Kanban board
5. If using Xendit, generate a test payment link and verify the flow

---

## Step 10 — Connect Instagram Direct Messages *(Optional)*

Instagram DM ordering lets customers place the same bot-powered orders through your Instagram Business account.

> **Important:** Instagram DM access requires Meta to approve the `instagram_manage_messages` permission. The LaundroBot team manages this. Contact **hello@laundrobot.app** if it isn't working yet.

### Find your Instagram Business Account ID

1. Go to **[Meta Business Suite](https://business.facebook.com) → Settings → Accounts → Instagram Accounts**
2. Click your account — your **Account ID** is the long number shown (e.g., `17841400000000000`)

Alternatively, ask the LaundroBot team to look it up for you.

### Add it to your settings

1. Go to **Settings → "Instagram Messaging"**
2. Paste your Instagram Business User ID
3. Click **"Save Settings"**

---

## How Customers Place Orders

Once everything is set up, customers can order in three ways:

### Via Facebook Messenger
1. Customer goes to your Facebook Page → clicks **"Send Message"**
2. Taps **"Get Started"** (first-timers) or **"🛒 Book Now"** in the menu
3. Fills out the booking form, submits
4. Order appears on your Kanban board and you receive an email notification

### Via Your Booking Link
Share **`laundrobot.app/book/[your-tenant-id]`** on Facebook posts, WhatsApp, SMS, flyers — anywhere. Customers can book without Messenger.

> **Pro plan:** If you have a custom domain (e.g., `book.yourshop.com`), that URL works as your booking link directly.

### Via Walk-In POS
Go to **Walk-in** in the sidebar for customers who call in or come in person. Fill in their details and create the order directly — no Messenger needed.

---

## Managing Orders (Kanban Board)

Go to **Kanban** to see all active orders. Orders move through:

| Status | Meaning |
|---|---|
| **NEW ORDER** | Just received, not yet actioned |
| **FOR PICK UP** | Pickup scheduled, waiting on rider or customer |
| **PROCESSING** | Laundry is being cleaned |
| **FOR DELIVERY** | Done, out for delivery |
| **COMPLETED** | Order delivered and closed |

**Updating orders:** Drag cards between columns or use the **◀ ▶** arrows. Click an order to view full details, edit the service/price/notes, set a delivery date, or generate an invoice.

**Payments:**
- **Xendit:** Click **"Generate Payment Link"** → send to customer → order auto-marks Paid when they pay
- **QR Code:** Click **"View Screenshot"** → review proof → click **"Confirm Payment"**

**Invoices:** Click **"Download PDF"** or **"Send to Email"** on any order.

---

## Sending Promotions

Go to **Messaging** in the sidebar to broadcast a message to all your customers (or filter by order status).

**Example:** *"🎉 This weekend only: 10% off all orders! Book now: laundrobot.app/book/[your-id]"*

> Only customers who have previously messaged your Facebook Page can receive blast messages (Meta policy).

---

## Promo Codes *(Growth & Pro plans)*

Go to **Settings → Promo Codes** to create discount codes customers enter at checkout.

Configure the code, discount type (fixed ₱ or percentage), minimum order, max uses, and expiry date.

---

## Pro Features

| Feature | Description |
|---|---|
| **Business Logo** | Shown on invoices and the booking form |
| **Custom Domain** | Branded URL for your booking form (e.g., `book.yourshop.com`) |
| **White Label** | Removes the "Powered by LaundroBot" footer |
| **Custom AI Instructions** | Fine-tune the bot's language, tone, and behavior |
| **Unlimited AI replies** | No daily cap |
| **Up to 10 branches & 10 staff** | |
| **Priority support** | |

### Setting Up a Custom Domain

1. Go to **Settings → "Custom Domain & White Label"**
2. Enter your domain (e.g., `book.yourshop.com`) and save
3. At your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) add a CNAME record:

| Type | Name | Value |
|---|---|---|
| CNAME | `book` | `cname.vercel-dns.com` |

4. Email **hello@laundrobot.app** with your domain so the team can activate it (takes ~5 min after DNS propagates)

DNS propagation typically takes 5–30 minutes. Once live, your custom URL loads the booking form directly.

---

## Troubleshooting

**Messenger bot is not responding**
- Check that your Page is published (not in Draft mode)
- Page Access Tokens can expire if you change your Facebook password — reconnect via Settings → Connect Facebook Page

**Booking form not loading in Messenger**
- Go to Settings → Facebook Messenger Menu → click **"Reset Messenger Menu"**
- This re-pushes the domain whitelist to Facebook and usually fixes it immediately

**Customers don't see the Get Started button**
- The button only appears for users who have never messaged your Page
- Existing followers tap **☰** to open the menu

**Open days not saving / still showing wrong days**
- Make sure you click **"Save Settings"** after toggling the day buttons — they don't auto-save

**Payments not recording (Xendit)**
- Confirm your Xendit API key is saved in Settings
- Payments can take a few minutes to process after the customer pays

**Customer uploaded a screenshot but I can't see it**
- Go to Orders, open the order, and look for the **QR Payment** section in the detail panel — it only appears for unpaid QR-mode orders

**AI is not answering questions**
- Confirm AI replies are toggled ON and saved in Settings
- Add more FAQs — the more detail you provide, the better the AI performs

---

## Need Help?

**Email:** hello@laundrobot.app

Always include your **LaundroBot account email** when contacting support so we can look up your account quickly.
