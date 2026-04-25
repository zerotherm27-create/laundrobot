import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const C = { brand: '#38a9c2', dark: '#111827', mid: '#374151', muted: '#6B7280', border: '#E5E7EB', bg: '#F9FAFB', green: '#059669', greenBg: '#DCFCE7', amber: '#92400E', amberBg: '#FEF9C3' };

const s = StyleSheet.create({
  page:        { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: C.dark, backgroundColor: '#fff' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 18, borderBottom: `1px solid ${C.border}` },
  logo:        { width: 48, height: 48, borderRadius: 6, marginBottom: 6, objectFit: 'contain' },
  shopName:    { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  shopMeta:    { fontSize: 9, color: C.muted, marginBottom: 2 },
  invTitle:    { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.brand, textAlign: 'right' },
  invRef:      { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.mid, textAlign: 'right', marginTop: 4 },
  invMeta:     { fontSize: 9, color: C.muted, textAlign: 'right', marginTop: 2 },
  badge:       { marginTop: 8, alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  badgeTxt:    { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  secLabel:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.muted, marginBottom: 8, letterSpacing: 1 },
  custName:    { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.dark, marginBottom: 3 },
  custMeta:    { fontSize: 9, color: C.mid, marginBottom: 2 },
  tHead:       { flexDirection: 'row', backgroundColor: C.bg, padding: '8 10', borderRadius: 4, marginBottom: 4 },
  tHeadTxt:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.muted },
  tRow:        { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10, borderBottom: `0.5px solid #F3F4F6` },
  tRowAlt:     { backgroundColor: '#FAFAFA' },
  col1:        { flex: 3 },
  col2:        { flex: 1, textAlign: 'center' },
  col3:        { flex: 1.2, textAlign: 'right' },
  totWrap:     { alignItems: 'flex-end', marginTop: 10 },
  totRow:      { flexDirection: 'row', marginBottom: 4 },
  totLbl:      { fontSize: 9, color: C.muted, width: 110, textAlign: 'right', marginRight: 20 },
  totVal:      { fontSize: 9, color: C.mid, width: 80, textAlign: 'right' },
  grandRow:    { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTop: `1.5px solid ${C.border}` },
  grandLbl:    { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.dark, width: 110, textAlign: 'right', marginRight: 20 },
  grandVal:    { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.brand, width: 80, textAlign: 'right' },
  notes:       { marginTop: 24, padding: '10 14', backgroundColor: C.bg, borderRadius: 4 },
  notesTxt:    { fontSize: 9, color: C.mid, marginTop: 4 },
  footer:      { position: 'absolute', bottom: 24, left: 40, right: 40, borderTop: `0.5px solid ${C.border}`, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt:   { fontSize: 8, color: '#9CA3AF' },
});

function fmt(n) {
  return `Php ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Returns just the quantity number for a service row.
// Weight-based → weight value. Qty-multiplier field → its value. Otherwise → 1.
// Addon fields carry unit_price so they are excluded.
function qtyDisplay(weight, customSelections) {
  if (weight) return String(weight);
  const selections = customSelections
    ? (typeof customSelections === 'string' ? JSON.parse(customSelections) : customSelections)
    : [];
  const numField = selections.find(f =>
    f.unit_price == null &&
    f.value !== '' &&
    f.value != null &&
    !isNaN(parseFloat(f.value)) &&
    parseFloat(f.value) > 0
  );
  return numField ? String(numField.value) : '1';
}

export default function InvoiceDocument({ order, shop }) {
  const deliveryFee    = Number(order.delivery_fee || 0);
  const promoDiscount  = Number(order.promo_discount || 0);
  const grandTotal     = Number(order.price || 0);
  const servicesSubtotal = grandTotal - deliveryFee + promoDiscount;

  const isMulti = order.services && order.services.length > 1;
  const serviceRows = isMulti
    ? order.services.map((sv, i) => ({
        name:  sv.service_name || '—',
        unit:  qtyDisplay(sv.weight, sv.custom_selections),
        price: i === 0 ? Number(sv.price) - deliveryFee : Number(sv.price),
      }))
    : [{
        name:  order.service_name || '—',
        unit:  qtyDisplay(order.weight, order.custom_selections),
        price: servicesSubtotal,
      }];

  const invoiceId  = order.booking_ref || order.id;
  const invoiceDate = new Date(order.created_at).toLocaleDateString('en-PH', { dateStyle: 'long' });
  const isPaid      = order.paid;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            {shop?.logo_url && <Image style={s.logo} src={shop.logo_url} />}
            <Text style={s.shopName}>{shop?.name || 'Laundry Shop'}</Text>
            {shop?.shop_address   && <Text style={s.shopMeta}>{shop.shop_address}</Text>}
            {shop?.contact_number && <Text style={s.shopMeta}>{shop.contact_number}</Text>}
          </View>
          <View>
            <Text style={s.invTitle}>INVOICE</Text>
            <Text style={s.invRef}>#{invoiceId}</Text>
            <Text style={s.invMeta}>Date: {invoiceDate}</Text>
            <View style={[s.badge, { backgroundColor: isPaid ? C.greenBg : C.amberBg }]}>
              <Text style={[s.badgeTxt, { color: isPaid ? C.green : C.amber }]}>
                {isPaid ? '\u2713 PAID' : '\u29d6 UNPAID'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Billed To ── */}
        <View style={{ marginBottom: 22 }}>
          <Text style={s.secLabel}>BILLED TO</Text>
          <Text style={s.custName}>{order.customer_name || '—'}</Text>
          {order.customer_phone   && <Text style={s.custMeta}>{order.customer_phone}</Text>}
          {order.customer_email   && <Text style={s.custMeta}>{order.customer_email}</Text>}
          {(order.address || order.customer_address) &&
            <Text style={s.custMeta}>{order.address || order.customer_address}</Text>}
          {order.pickup_date &&
            <Text style={s.custMeta}>
              Pickup: {new Date(order.pickup_date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>}
        </View>

        {/* ── Services Table ── */}
        <View style={{ marginBottom: 4 }}>
          <Text style={s.secLabel}>ORDER DETAILS</Text>
          <View style={s.tHead}>
            <Text style={[s.tHeadTxt, s.col1]}>Service</Text>
            <Text style={[s.tHeadTxt, s.col2]}>Qty / Unit</Text>
            <Text style={[s.tHeadTxt, s.col3]}>Amount</Text>
          </View>
          {serviceRows.map((row, i) => (
            <View key={i} style={[s.tRow, i % 2 === 1 && s.tRowAlt]}>
              <Text style={[{ fontSize: 10 }, s.col1]}>{row.name}</Text>
              <Text style={[{ fontSize: 10, color: C.mid }, s.col2]}>{row.unit}</Text>
              <Text style={[{ fontSize: 10, color: C.mid }, s.col3]}>{fmt(row.price)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={s.totWrap}>
          <View style={s.totRow}>
            <Text style={s.totLbl}>Subtotal</Text>
            <Text style={s.totVal}>{fmt(servicesSubtotal)}</Text>
          </View>
          {deliveryFee > 0 && (
            <View style={s.totRow}>
              <Text style={s.totLbl}>Delivery Fee</Text>
              <Text style={s.totVal}>{fmt(deliveryFee)}</Text>
            </View>
          )}
          {promoDiscount > 0 && (
            <View style={s.totRow}>
              <Text style={[s.totLbl, { color: C.green }]}>
                Promo{order.promo_code ? ` (${order.promo_code})` : ''}
              </Text>
              <Text style={[s.totVal, { color: C.green }]}>-{fmt(promoDiscount)}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandLbl}>Grand Total</Text>
            <Text style={s.grandVal}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {order.notes && (
          <View style={s.notes}>
            <Text style={[s.secLabel, { marginBottom: 0 }]}>NOTES</Text>
            <Text style={s.notesTxt}>{order.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>Generated by LaundroBot</Text>
          <Text style={s.footerTxt}>{shop?.name} · {invoiceDate}</Text>
        </View>

      </Page>
    </Document>
  );
}
