// ThermalReceipt.jsx
// Generates a 58mm thermal receipt (Job Order + Claim Receipt) and opens
// the browser print dialog via a Blob URL — no document.write(), no XSS risk.
// No backend required — all data comes from walk-in POS state.

// Escape user-supplied strings before inserting into HTML
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function fmt(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildReceiptHtml({ bookingRef, form, cart, appliedPromo, deliveryFee, deliveryZone, shopInfo }) {
  const now = new Date();
  const printedAt = now.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const cartTotal   = cart.reduce((s, i) => s + (i.itemTotal || 0), 0);
  const discount    = appliedPromo?.discount_amount ?? 0;
  const delivery    = Number(deliveryFee || 0);
  const grandTotal  = cartTotal + delivery - discount;

  const pickupDate  = form.pickup_date
    ? fmtDate(form.pickup_date.includes('T') ? form.pickup_date : form.pickup_date + 'T00:00:00')
    : '—';

  const shopName    = esc(shopInfo?.name || 'Laundry Shop');
  const shopAddr    = esc(shopInfo?.shop_address || '');
  const shopPhone   = esc(shopInfo?.contact_number || '');

  // Summary rows: one line per service (name + total) — used by both receipts
  const itemRows = cart.map(item =>
    `<div class="item-row"><div class="item-left">${esc(item.service_name)}</div><div class="item-right">${fmt(item.itemTotal)}</div></div>`
  ).join('');
  const jobItems = itemRows;
  const claimItems = itemRows;

  // Shared totals block (Subtotal / Delivery / Promo / TOTAL)
  const totalsHtml = `
    <div class="total-row"><span>Subtotal</span><span>${fmt(cartTotal)}</span></div>
    ${delivery > 0 ? `<div class="total-row"><span>Delivery${deliveryZone ? ` (${esc(deliveryZone)})` : ''}</span><span>${fmt(delivery)}</span></div>` : ''}
    ${discount > 0 ? `<div class="total-row"><span>Promo (${esc(appliedPromo.code)})</span><span>-${fmt(discount)}</span></div>` : ''}
    <div class="grand-total"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt ${esc(bookingRef)}</title>
<style>
  @page { size: 58mm auto; margin: 2mm; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    width: 54mm;
    color: #000;
    background: #fff;
  }

  .center   { text-align: center; }
  .bold     { font-weight: bold; }
  .large    { font-size: 14px; font-weight: bold; }
  .xlarge   { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  .small    { font-size: 9px; }
  .right    { text-align: right; }

  .section  { margin-bottom: 4px; }
  .block    { margin-bottom: 2px; }

  hr {
    border: none;
    border-top: 1px dashed #000;
    margin: 4px 0;
  }

  .cut-line {
    text-align: center;
    font-size: 10px;
    margin: 6px 0;
    letter-spacing: 1px;
  }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2px;
  }
  .item-left  { flex: 1; padding-right: 4px; }
  .item-right { white-space: nowrap; font-weight: bold; }
  .item-name  { font-weight: bold; }
  .item-detail{ font-size: 10px; color: #333; }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  .grand-total {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    font-weight: bold;
    margin-top: 4px;
    padding-top: 3px;
    border-top: 1px solid #000;
  }

  .paid-badge {
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    border: 2px solid #000;
    padding: 2px 6px;
    display: inline-block;
    margin: 2px auto;
  }
  .paid-wrap { text-align: center; margin: 4px 0; }

  .notes-box {
    border: 1px dashed #555;
    padding: 3px 4px;
    font-size: 10px;
    margin: 3px 0;
    word-break: break-word;
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════ -->
<!-- JOB ORDER                          -->
<!-- ═══════════════════════════════════ -->

<div class="section center bold" style="font-size:10px; letter-spacing:.5px; margin-bottom:2px;">JOB ORDER</div>

<div class="section center">
  <div class="bold" style="font-size:13px;">${shopName}</div>
  ${shopAddr ? `<div class="small">${shopAddr}</div>` : ''}
  ${shopPhone ? `<div class="small">${shopPhone}</div>` : ''}
</div>

<hr/>

<div class="section">
  <div class="total-row"><span class="bold">Ref#:</span><span class="bold">${bookingRef}</span></div>
  <div class="total-row"><span>Date:</span><span>${printedAt}</span></div>
</div>

<hr/>

<div class="section">
  <div class="block"><span class="bold">Customer: </span>${esc(form.name) || '—'}</div>
  <div class="block"><span class="bold">Phone: </span>${esc(form.phone) || '—'}</div>
  ${form.address ? `<div class="block"><span class="bold">Address: </span>${esc(form.address)}</div>` : ''}
  <div class="block"><span class="bold">Pickup: </span>${pickupDate}</div>
</div>

<hr/>

<div class="section">
  ${jobItems}
</div>

<hr/>

<div class="section">
  ${totalsHtml}
</div>

${form.notes ? `
<hr/>
<div class="notes-box"><span class="bold">Notes: </span>${esc(form.notes)}</div>
` : ''}

<hr/>
<div class="small center" style="margin-bottom:2px;">Printed: ${printedAt}</div>


<!-- ═══════════════════════════════════ -->
<!-- CUT LINE                           -->
<!-- ═══════════════════════════════════ -->

<div class="cut-line">- - - - ✂ CUT HERE ✂ - - - -</div>


<!-- ═══════════════════════════════════ -->
<!-- CLAIM RECEIPT                      -->
<!-- ═══════════════════════════════════ -->

<div class="section center bold" style="font-size:10px; letter-spacing:.5px; margin-bottom:2px;">CLAIM RECEIPT</div>

<div class="section center">
  <div class="bold" style="font-size:13px;">${shopName}</div>
  ${shopAddr ? `<div class="small">${shopAddr}</div>` : ''}
  ${shopPhone ? `<div class="small">${shopPhone}</div>` : ''}
</div>

<hr/>

<div class="section center">
  <div class="small" style="letter-spacing:.5px;">BOOKING REFERENCE</div>
  <div class="xlarge">${esc(bookingRef)}</div>
</div>

<hr/>

<div class="section">
  <div class="block"><span class="bold">Customer: </span>${esc(form.name) || '—'}</div>
  <div class="block"><span class="bold">Pickup: </span>${pickupDate}</div>
</div>

<hr/>

<div class="section">
  ${claimItems}
</div>

<hr/>

<div class="section">
  ${totalsHtml}
</div>

<div class="paid-wrap">
  <div class="paid-badge">✓ PAID &nbsp;•&nbsp; Walk-in</div>
</div>

<hr/>

<div class="center small" style="margin: 3px 0; line-height: 1.5;">
  Present this receipt when<br/>
  claiming your laundry.
</div>

<hr/>

<div class="center small" style="margin-top: 4px;">
  Thank you! See you again. 😊
</div>

</body>
</html>`;
}

export function printReceipt(data) {
  const html = buildReceiptHtml(data);

  // Build a Blob URL — avoids document.write() (XSS risk, deprecated)
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url  = URL.createObjectURL(blob);

  const w = window.open(url, '_blank', 'width=340,height=700,scrollbars=yes');
  if (!w) {
    URL.revokeObjectURL(url);
    alert('Please allow popups for this site to print receipts.');
    return;
  }

  w.addEventListener('load', () => {
    w.focus();
    w.print();
    w.addEventListener('afterprint', () => {
      w.close();
      URL.revokeObjectURL(url);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RawBT / ESC-POS path — for Bluetooth thermal printers (e.g. Xprinter XP-58)
//
// Bluetooth thermal printers don't register as OS print services, so
// window.print() can't reach them. RawBT (Android app) bridges the browser to
// the printer over classic Bluetooth and speaks ESC/POS. We build raw ESC/POS
// bytes, base64-encode them, and hand them to RawBT via its intent: URL scheme.
// On Chrome/Android this prints with no paper-size prompt; if RawBT isn't
// installed, the intent falls back to its Play Store page.
// ─────────────────────────────────────────────────────────────────────────────

const ESC = 0x1B, GS = 0x1D;
const LINE_WIDTH = 32; // Font A on 58mm = 32 chars per line

// Peso amounts: the ₱ glyph isn't in the printer's default codepage, so use "P"
function money(n) {
  return 'P' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

class EscPos {
  constructor() { this.bytes = []; this.cmd(ESC, 0x40); } // init
  cmd(...b) { this.bytes.push(...b); return this; }
  text(str) {
    const s = String(str ?? '').replace(/₱/g, 'P');
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.bytes.push(c > 0xFF ? 0x3F : c); // '?' for anything outside Latin-1
    }
    return this;
  }
  line(str = '') { return this.text(str).cmd(0x0A); }
  align(n)  { return this.cmd(ESC, 0x61, n); }          // 0 left, 1 center, 2 right
  bold(on)  { return this.cmd(ESC, 0x45, on ? 1 : 0); }
  size(n)   { return this.cmd(GS, 0x21, n); }            // GS ! n  (hi nibble=width, lo=height)
  feed(n = 1) { for (let i = 0; i < n; i++) this.bytes.push(0x0A); return this; }
  rule()    { return this.line('-'.repeat(LINE_WIDTH)); }
  // label left / value right padded to LINE_WIDTH
  row(left, right) {
    const l = String(left), r = String(right);
    const gap = Math.max(1, LINE_WIDTH - l.length - r.length);
    return this.line(l + ' '.repeat(gap) + r);
  }
  cut() { return this.feed(3).cmd(GS, 0x56, 0x42, 0x00); } // feed + partial cut (no-op on cutter-less XP-58)
  base64() {
    let bin = '';
    for (const b of this.bytes) bin += String.fromCharCode(b & 0xFF);
    return btoa(bin);
  }
}

function buildReceiptEscPos({ bookingRef, form, cart, appliedPromo, deliveryFee, deliveryZone, shopInfo }) {
  const printedAt   = new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const cartTotal   = cart.reduce((s, i) => s + (i.itemTotal || 0), 0);
  const discount    = appliedPromo?.discount_amount ?? 0;
  const delivery    = Number(deliveryFee || 0);
  const grandTotal  = cartTotal + delivery - discount;
  const pickupDate  = form.pickup_date
    ? fmtDate(form.pickup_date.includes('T') ? form.pickup_date : form.pickup_date + 'T00:00:00')
    : '—';
  const shopName  = shopInfo?.name || 'Laundry Shop';
  const shopAddr  = shopInfo?.shop_address || '';
  const shopPhone = shopInfo?.contact_number || '';

  const p = new EscPos();

  const header = (title) => {
    p.align(1).bold(true).line(title).bold(false);
    p.bold(true).line(shopName).bold(false);
    if (shopAddr)  p.line(shopAddr);
    if (shopPhone) p.line(shopPhone);
    p.align(0).rule();
  };

  // Shared summary: one line per service (name + total), then the totals block
  const totals = () => {
    p.rule();
    p.row('Subtotal', money(cartTotal));
    if (delivery > 0) {
      p.row('Delivery', money(delivery));
      if (deliveryZone) p.line('  ' + deliveryZone);
    }
    if (discount > 0) p.row('Promo (' + (appliedPromo.code || '') + ')', '-' + money(discount));
    p.bold(true).size(0x01).row('TOTAL', money(grandTotal)).size(0x00).bold(false);
  };
  const items = () => cart.forEach(item => p.row(item.service_name, money(item.itemTotal)));

  // ── JOB ORDER (summary) ──
  header('JOB ORDER');
  p.row('Ref#: ' + bookingRef, '');
  p.row('Date:', printedAt);
  p.rule();
  p.line('Customer: ' + (form.name || '—'));
  p.line('Phone: '    + (form.phone || '—'));
  if (form.address) p.line('Address: ' + form.address);
  p.line('Pickup: '   + pickupDate);
  p.rule();
  items();
  totals();
  if (form.notes) { p.rule(); p.line('Notes: ' + form.notes); }
  p.rule();
  p.align(1).line('Printed: ' + printedAt).align(0);

  p.feed(1).align(1).line('- - - - CUT HERE - - - -').align(0).feed(1);

  // ── CLAIM RECEIPT (summary) ──
  header('CLAIM RECEIPT');
  p.align(1).line('BOOKING REFERENCE');
  p.bold(true).size(0x11).line(bookingRef).size(0x00).bold(false);
  p.align(0).rule();
  p.line('Customer: ' + (form.name || '—'));
  p.line('Pickup: '   + pickupDate);
  p.rule();
  items();
  totals();
  p.feed(1).align(1).bold(true).line('[ PAID - Walk-in ]').bold(false);
  p.line('Present this receipt when');
  p.line('claiming your laundry.');
  p.feed(1).line('Thank you! See you again.').align(0);

  p.cut();
  return p.base64();
}

// Print to a Bluetooth thermal printer via RawBT (Chrome/Android).
// Returns true if the print intent was dispatched, false otherwise.
export function printReceiptRawBT(data) {
  try {
    const b64 = buildReceiptEscPos(data);
    const intentUrl =
      'intent:base64,' + b64 +
      '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
    window.location.href = intentUrl;
    return true;
  } catch (err) {
    alert('Could not reach the thermal printer.\nMake sure the RawBT app is installed and the XP-58 is selected in it.');
    return false;
  }
}
