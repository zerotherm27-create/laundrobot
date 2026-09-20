export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const PESO  = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const PCT   = n => `${Number(n || 0).toFixed(1)}%`;
export const KPESO = v => {
  const n = parseFloat(v) || 0;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₱${(n / 1_000).toFixed(0)}k`;
  return `₱${Math.round(n)}`;
};
