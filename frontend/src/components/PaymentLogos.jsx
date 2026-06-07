// PaymentLogos.jsx — real brand logos for the walk-in POS payment grid

export function GCashLogo({ height = 28 }) {
  return (
    <img
      src="/pay-gcash.png"
      alt="GCash"
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
    />
  );
}

export function MayaLogo({ height = 28 }) {
  return (
    <img
      src="/pay-maya.png"
      alt="Maya"
      style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
    />
  );
}

// Cash has no brand — use a ₱ pill badge
export function CashLogo({ height = 30 }) {
  return (
    <svg width={height * 1.1} height={height} viewBox="0 0 33 30" aria-label="Cash">
      <rect width="33" height="30" rx="6" fill="#1F2937" />
      <text
        x="16.5" y="21"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="800"
        fontSize="16"
        fill="white"
      >₱</text>
    </svg>
  );
}

// Credit Card — show Visa + Mastercard logos side by side
export function CreditCardLogo({ height = 22 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <img src="/pay-visa.png"       alt="Visa"       style={{ height, width: 'auto', objectFit: 'contain' }} />
      <img src="/pay-mastercard.png" alt="Mastercard" style={{ height, width: 'auto', objectFit: 'contain' }} />
    </div>
  );
}
