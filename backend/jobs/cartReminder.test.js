const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'cartReminder.js'), 'utf8');

// BKG-000308: the reminder's "Complete Booking" link had no ?psid=, so the web booking was never
// tied to the Messenger user, the cart stayed unconverted and reminders kept firing after payment.
test('cart reminder booking link carries the customer PSID', () => {
  assert.match(src, /\/book\/\$\{cart\.tenant_id\}\?psid=\$\{cart\.fb_user_id\}/);
});

// Safety net: a customer with a non-cancelled order after the cart started is never reminded,
// even if the cart was not flagged converted.
test('cart reminder query skips customers who already booked after the cart', () => {
  assert.match(src, /NOT EXISTS \(\s*SELECT 1 FROM orders o[\s\S]*cu\.fb_id = ca\.fb_user_id[\s\S]*o\.created_at > ca\.created_at[\s\S]*status != 'CANCELLED'/);
});
