// ─────────────────────────────────────────────────────────────────────────────
// ORDER PRICE MODEL — single source of truth for all display calculations
//
//   orders.price         = service subtotal ONLY (variants + add-ons, no delivery)
//   orders.delivery_fee  = zone/distance delivery charge (separate column)
//   orders.promo_discount = discount applied to row 0 of the booking
//
//   Grand total = price + delivery_fee − promo_discount
//
// ⚠️  Never subtract delivery_fee from price for display — price is already
//     service-only. If this invariant changes, update ONLY this file.
// ─────────────────────────────────────────────────────────────────────────────

/** Service subtotal for one order row (no delivery, no promo) */
export function orderServicePrice(order) {
  return Number(order.price || 0);
}

/** Grand total for one order row */
export function orderRowTotal(order) {
  return orderServicePrice(order)
    + Number(order.delivery_fee || 0)
    - Number(order.promo_discount || 0);
}

/** Grand total for a booking group (all rows summed) */
export function bookingGrandTotal(group) {
  const servicesTotal = (group.services?.length > 0
    ? group.services.reduce((s, o) => s + Number(o.price || 0), 0)
    : Number(group.price || 0));
  return servicesTotal
    + Number(group.delivery_fee || 0)
    - Number(group.promo_discount || 0);
}
