// First-visit intro cards for every tab. One entry per page key (see PAGES in App.jsx).
// Keep tips to 3-4 short lines in plain language and use the exact button/label text shown on the page.
// `action` lets a card open something on its page: PageIntro fires window event `action.event`.
export const PAGE_HELP = {
  Overview: {
    title: 'Overview',
    purpose: 'Your shop at a glance: today\'s orders and sales, and your booking link.',
    tips: [
      'Copy your booking link and share it with customers so they can book without an account.',
      'Check the numbers each morning to see what came in overnight.',
      'Finish the "Getting started" checklist in the sidebar so bookings start flowing.',
    ],
  },
  Kanban: {
    title: 'Kanban Board',
    purpose: 'Every active order is a card. Move it along as you work on it.',
    tips: [
      'The columns are New, For Pick Up, Processing, For Delivery and Completed.',
      'Drag a card to the next column (or use its buttons) to update its status.',
      'Customers who booked through Messenger can be notified when you move an order, so they always know where their laundry is.',
      'Click a card to see the full order and print a receipt.',
    ],
    gotcha: 'Customers who booked on the web form or at the counter have no Messenger chat, so they are not messaged automatically.',
  },
  Orders: {
    title: 'Orders',
    purpose: 'The full list of every order, so you can search, filter and check payments.',
    tips: [
      'Search by name, order ID or booking ref, and filter by status, date or amount.',
      'A booking with several services is shown as one booking with one booking number.',
      'You can send a customer an update by Messenger or email straight from an order.',
      'Cancelling a paid order puts it in Finance → Refunds so you can track the refund.',
    ],
  },
  Customers: {
    title: 'Customers',
    purpose: 'Everyone who has ordered from you, in one place.',
    tips: [
      'Search for a customer by name, phone or email.',
      'Click a customer to open their details.',
      'Customers are saved automatically when they book, so you never need to type them in twice.',
    ],
  },
  Services: {
    title: 'Services',
    purpose: 'What you sell and how it is priced. This is what customers pick when they book.',
    tips: [
      'Create a category first (for example "Wash & Fold"), then add services inside it.',
      'Each service has a price and a unit, like "per kg" or "per piece".',
      'Use Custom Fields for sizes, quantities and add-ons like fabric softener.',
    ],
    gotcha: 'Pricing has a few rules that are easy to get wrong. The tutorial walks you through them with examples.',
    action: { label: 'Open the tutorial', event: 'lb:open-services-tutorial' },
  },
  Messaging: {
    title: 'Messaging',
    purpose: 'Talk to your customers on Messenger: take over chats from the bot and send announcements.',
    tips: [
      'When a customer asks for a person, the chat waits here for you. Reply, then use "Release to AI" to hand it back to the bot.',
      'Use "Send blast message" to message all your Messenger customers at once, for example a holiday closure.',
      'Blast history shows what you sent and how many people received it.',
    ],
    gotcha: 'Messenger only lets you message someone within 24 hours of their last message, so a blast reaches recent customers only.',
  },
  FAQs: {
    title: 'FAQs',
    purpose: 'Questions and answers the AI bot uses to reply to your customers.',
    tips: [
      'Click "+ Add FAQ" and write a common question and its answer (prices, hours, pickup times).',
      'The better your answers, the fewer messages you have to reply to yourself.',
      'Turn on AI replies in Settings so the bot uses these answers.',
    ],
  },
  WalkIn: {
    title: 'Walk-in',
    purpose: 'A quick point-of-sale for customers who come to your shop.',
    tips: [
      'Pick the services, enter the details and take payment by cash or QR.',
      'Walk-in orders are recorded as paid and appear on your Kanban board.',
      'It keeps working if your internet drops. Orders wait and sync when you are back online.',
      'You can print a receipt on a Bluetooth thermal printer with the RawBT app.',
    ],
  },
  DeliveryZones: {
    title: 'Delivery Settings',
    purpose: 'How much you charge for pickup and delivery.',
    tips: [
      'Add delivery areas with a fixed fee for each, or price by distance from your shop.',
      'Set your shop address in Settings first, because distance pricing measures from it.',
      'Skip this if you only take drop-off orders.',
    ],
  },
  Reports: {
    title: 'Reports',
    purpose: 'See where your orders come from and how many customers come back.',
    tips: [
      'The source breakdown shows web, Messenger, walk-in and manual orders.',
      'Retention shows how many customers order again, which is a good measure of happy customers.',
    ],
  },
  Finance: {
    title: 'Finance',
    purpose: 'Your sales, expenses and profit.',
    tips: [
      'Today: Dashboard, Daily Sales and Refunds.',
      'Deep dive: Pricing Guide, Expenses, Monthly Summary and Insights.',
      'Add your expenses so Net Profit is accurate.',
      'Cancelled orders are not counted in revenue.',
    ],
    gotcha: 'Some tabs are only available on higher plans. You will see an upgrade note on those.',
  },
  Inventory: {
    title: 'Inventory',
    purpose: 'Track supplies like detergent, softener and gas.',
    tips: [
      'Add each item with its unit and a low-stock reminder level.',
      'Use stock in and stock out to record deliveries and daily usage.',
      'Use Formulas to make a service use up stock automatically, for example 50 ml of detergent per load.',
    ],
    gotcha: 'Add your inventory items first. Formulas need them.',
  },
  Users: {
    title: 'User Management',
    purpose: 'Give your staff their own logins.',
    tips: [
      'Click "+ Add User", enter their email and a password, and choose which tabs they can use.',
      'Staff only see the tabs you allow.',
      'Your plan limits how many logins you can have, including yours.',
    ],
  },
  Branches: {
    title: 'Branches',
    purpose: 'Run more than one location from the same account.',
    tips: [
      'Each branch has its own orders, services and settings.',
      'Switch between branches from the sidebar.',
      'How many branches you can have depends on your plan.',
    ],
  },
  Settings: {
    title: 'Settings',
    purpose: 'Set up your shop, bookings, payments and the bot.',
    tips: [
      'Work from the top: Shop Identity, Booking & Operations, Online Payments, AI & Automation.',
      'Messaging & Integrations is where you connect your Facebook Page.',
      'Instagram messaging is coming soon.',
    ],
    gotcha: 'Some settings are only available on higher plans.',
  },
};
