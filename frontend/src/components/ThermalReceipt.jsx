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

function buildReceiptHtml({ bookingRef, form, cart, appliedPromo, shopInfo }) {
  const now = new Date();
  const printedAt = now.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const cartTotal   = cart.reduce((s, i) => s + (i.itemTotal || 0), 0);
  const discount    = appliedPromo?.discount_amount ?? 0;
  const grandTotal  = cartTotal - discount;

  const pickupDate  = form.pickup_date
    ? fmtDate(form.pickup_date.includes('T') ? form.pickup_date : form.pickup_date + 'T00:00:00')
    : '—';

  const shopName    = esc(shopInfo?.name || 'Laundry Shop');
  const shopAddr    = esc(shopInfo?.shop_address || '');
  const shopPhone   = esc(shopInfo?.contact_number || '');

  // ── Item rows for Job Order (full detail) ──────────────────────────────
  const jobItems = cart.map(item => {
    const lines = [`<div class="item-name">${esc(item.service_name)}</div>`];

    // displayLines: [{ label, price }]
    if (Array.isArray(item.displayLines)) {
      item.displayLines.forEach(dl => {
        if (dl.label && dl.label !== item.service_name) {
          lines.push(`<div class="item-detail">  ${esc(dl.label)}</div>`);
        }
      });
    }

    // custom_fields: [{ label, value, unit_price }]
    if (Array.isArray(item.custom_fields)) {
      item.custom_fields.forEach(cf => {
        if (cf.label && cf.value != null && cf.value !== '') {
          lines.push(`<div class="item-detail">  ${esc(cf.label)}: ${esc(cf.value)}</div>`);
        }
      });
    }

    return `
      <div class="item-row">
        <div class="item-left">${lines.join('')}</div>
        <div class="item-right">${fmt(item.itemTotal)}</div>
      </div>`;
  }).join('');

  // ── Service names only for Claim Receipt ───────────────────────────────
  const claimItems = cart.map(item =>
    `<div class="item-row"><div class="item-left">${esc(item.service_name)}</div><div class="item-right">${fmt(item.itemTotal)}</div></div>`
  ).join('');

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
  <div class="total-row"><span>Subtotal</span><span>${fmt(cartTotal)}</span></div>
  ${discount > 0 ? `<div class="total-row"><span>Promo (${esc(appliedPromo.code)})</span><span>-${fmt(discount)}</span></div>` : ''}
  <div class="grand-total"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>
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
  ${discount > 0 ? `<div class="total-row small"><span>Promo (${esc(appliedPromo.code)})</span><span>-${fmt(discount)}</span></div>` : ''}
  <div class="grand-total"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>
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
