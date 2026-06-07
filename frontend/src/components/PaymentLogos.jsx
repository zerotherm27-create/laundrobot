// PaymentLogos.jsx
// Self-contained SVG brand logos for the walk-in POS payment method grid.
// All logos are pure SVG — no external images, no network requests.

export function GCashLogo({ height = 28 }) {
  return (
    <svg width={height * 2.6} height={height} viewBox="0 0 72 28" aria-label="GCash">
      <rect width="72" height="28" rx="7" fill="#0062AD" />
      {/* Bold G */}
      <text
        x="14" y="21"
        fontFamily='"Arial Black", "Arial Bold", Arial, sans-serif'
        fontWeight="900" fontSize="18" fill="white"
      >G</text>
      {/* Cash wordmark */}
      <text
        x="28" y="20.5"
        fontFamily="Arial, sans-serif"
        fontWeight="700" fontSize="13.5" fill="white" letterSpacing="0.3"
      >Cash</text>
    </svg>
  );
}

export function MayaLogo({ height = 28 }) {
  return (
    <svg width={height * 2.4} height={height} viewBox="0 0 67 28" aria-label="Maya">
      <rect width="67" height="28" rx="7" fill="#00A36C" />
      {/* "maya" in their lowercase wordmark style */}
      <text
        x="33.5" y="20"
        textAnchor="middle"
        fontFamily='"Arial Black", "Arial Bold", Arial, sans-serif'
        fontWeight="900" fontSize="15" fill="white" letterSpacing="0.5"
      >maya</text>
    </svg>
  );
}

export function CashLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Cash">
      {/* Outer bill shape */}
      <rect x="1" y="5" width="30" height="22" rx="4" fill="#374151" />
      {/* Inner highlight */}
      <rect x="1" y="5" width="30" height="22" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      {/* Left decoration dot */}
      <circle cx="5.5" cy="16" r="2.5" fill="rgba(255,255,255,0.2)" />
      {/* Right decoration dot */}
      <circle cx="26.5" cy="16" r="2.5" fill="rgba(255,255,255,0.2)" />
      {/* Peso sign */}
      <text
        x="16" y="21.5"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="800" fontSize="14" fill="white"
      >₱</text>
    </svg>
  );
}

export function CreditCardLogo({ width = 48, height = 32 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 48 32" aria-label="Credit Card">
      {/* Card body */}
      <rect width="48" height="32" rx="5" fill="#7C3AED" />
      {/* Magnetic stripe */}
      <rect x="0" y="8" width="48" height="7" fill="rgba(0,0,0,0.35)" />
      {/* Chip */}
      <rect x="6" y="18" width="10" height="7" rx="2" fill="rgba(255,255,255,0.55)" />
      <line x1="11" y1="18" x2="11" y2="25" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <line x1="6" y1="21.5" x2="16" y2="21.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      {/* Two overlapping circles (Mastercard-style indicator) */}
      <circle cx="34" cy="22" r="5" fill="#FFD700" fillOpacity="0.6" />
      <circle cx="39.5" cy="22" r="5" fill="#FF6B35" fillOpacity="0.6" />
    </svg>
  );
}
