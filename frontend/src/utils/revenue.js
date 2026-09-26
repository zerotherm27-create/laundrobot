// One definition of revenue for every screen (mirrors NET in backend/routes/finance.js — keep them in sync):
//   revenue = money the customer paid on orders that were NOT cancelled = price + delivery_fee − promo_discount.
// All dates are Asia/Manila calendar dates, never the browser's time zone.

export const manilaToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Manila calendar date (YYYY-MM-DD) of an order's created_at. */
export const orderManilaDate = o => new Date(new Date(o.created_at).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

/** Amount the customer paid for this row (before deciding whether it counts as revenue). */
export const rowNet = o => Number(o.price || 0) + Number(o.delivery_fee || 0) - Number(o.promo_discount || 0);

/** True when the row counts toward revenue: paid and not cancelled. */
export const isRevenueRow = o => !!o.paid && o.status !== 'CANCELLED';

/** Revenue contributed by one row (0 when it does not count). */
export const rowRevenue = o => (isRevenueRow(o) ? rowNet(o) : 0);

/** { from, to, label } for a Reports/Finance period; day / week (last 7 days) / month / year are calendar-based. */
export function periodRange(period, today = manilaToday()) {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  if (period === 'day')   return { from: today, to: today, label: today };
  if (period === 'week')  { const from = addDays(today, -6); return { from, to: today, label: `${from} to ${today}` }; }
  if (period === 'year')  return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}`, label: `${y}-${mm}-01 to ${y}-${mm}-${String(last).padStart(2, '0')}` };
}
