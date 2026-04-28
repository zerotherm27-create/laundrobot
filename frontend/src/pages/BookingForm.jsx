import { useEffect, useState, useRef } from 'react';
import {
  getPublicBootstrap, getPublicGeocode,
  getPublicAddressSuggest,
  lookupPublicCustomer, createPublicOrder, validatePublicPromo,
  savePublicCart, updatePublicCart,
} from '../api.js';

function getStartsAt(svc) {
  if (Number(svc.price) > 0) return null;
  const prices = [];
  for (const f of (svc.custom_fields || [])) {
    if (f.field_type !== 'select') continue;
    for (const o of (Array.isArray(f.options) ? f.options : [])) {
      if (typeof o === 'object' && (o.price_type || 'fixed') !== 'copy_base' && Number(o.price || 0) > 0)
        prices.push(Number(o.price));
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Booking time helpers ────────────────────────────────────────────────────
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function makeTimeSlots(open, close) {
  if (!open || !close) return [];
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const slots = [];
  let cur = oh * 60 + om;
  const end = ch * 60 + cm;
  while (cur < end) {
    const h = Math.floor(cur / 60), m = cur % 60;
    const hd = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    slots.push({ value: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, label: `${hd}:${String(m).padStart(2,'0')} ${ampm}` });
    cur += 30;
  }
  return slots;
}

function getMinBookingDate(cutoff, blockedSet) {
  const now = new Date();
  let d = new Date(now);
  if (cutoff) {
    const [ch, cm] = cutoff.split(':').map(Number);
    if (now.getHours() * 60 + now.getMinutes() >= ch * 60 + cm) {
      d.setDate(d.getDate() + 1);
    }
  }
  // skip blocked dates
  let safety = 0;
  while (blockedSet.has(toLocalDateStr(d)) && safety++ < 60) d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

function filterSlotsForDate(slots, dateStr, open) {
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  if (dateStr !== todayStr) return slots;
  // for today, filter out past slots
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return slots.filter(s => {
    const [h, m] = s.value.split(':').map(Number);
    return h * 60 + m > nowMins;
  });
}

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #B8C4CE', background: '#F8FAFC',
  fontFamily: 'inherit', color: '#0D1117', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};
const INPUT_ERR = {
  ...INPUT, borderColor: '#F87171', background: '#FFF5F5',
  boxShadow: '0 0 0 3px rgba(248,113,113,.12)',
};
const LABEL = { fontSize: 12, fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: 6 };

// ── Inline SVG icons (Lucide-style stroke, no external dependency) ───────────
function Icon({ name, size = 16, color = 'currentColor', style: s = {} }) {
  const paths = {
    search:      <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    warning:     <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    info:        <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>,
    pin:         <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
    truck:       <><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></>,
    store:       <><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></>,
    cart:        <><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></>,
    tag:         <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.43 0l6.58-6.58a2.426 2.426 0 0 0 0-3.43z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/></>,
    card:        <><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></>,
    check:       <path d="M20 6 9 17l-5-5"/>,
    checkCircle: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    clock:       <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    slash:       <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>,
    clipboard:   <><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></>,
    hand:        <><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0, ...s }}>
      {paths[name]}
    </svg>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}</label>
      {children}
      {error && (
        <div style={{ marginTop: 5, fontSize: 11, color: '#A32D2D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="warning" size={11} color="#A32D2D" /> {error}
        </div>
      )}
    </div>
  );
}

function closeMiniApp() {
  // Try Messenger Extensions first, then fall back to window.close()
  try {
    if (window.MessengerExtensions) {
      window.MessengerExtensions.requestCloseBrowser(
        () => {},
        () => { try { window.close(); } catch (_) {} }
      );
      return;
    }
  } catch (_) {}
  try { window.close(); } catch (_) {}
}

function normalizeOpts(options) {
  if (!Array.isArray(options)) return [];
  return options.map(o => typeof o === 'object' && o !== null
    ? { price_type: 'fixed', ...o }
    : { label: String(o), price: 0, price_type: 'fixed' });
}

export default function BookingForm({ tenantId }) {
  const [step, setStep]           = useState(1); // 1 | 2 | 3 | 'success'
  const [tenant, setTenant]       = useState(null);
  const [categories, setCategories] = useState([]);
  const [services, setServices]   = useState([]);
  const [zones, setZones]         = useState([]);
  const [bracketInfo, setBracketInfo] = useState(null); // { brackets, shop_lat, shop_lng, delivery_radius, delivery_note }
  const [bracketFee, setBracketFee]   = useState(null); // number or null
  const [bracketDistKm, setBracketDistKm] = useState(null);
  const [bracketError, setBracketError]   = useState('');
  const [customerCoords, setCustomerCoords] = useState(null); // { lat, lng }
  const [geocoding, setGeocoding]         = useState(false);
  const [blockedDates, setBlockedDates] = useState([]);
  const mapContainerRef = useRef(null);
  const leafletMapRef   = useRef(null);
  const leafletCustRef  = useRef(null); // customer marker
  const geocodeTimer    = useRef(null);
  const suggestTimer    = useRef(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  // Step 1 state
  const [activeCat, setActiveCat]       = useState(null);
  const [selectedSvc, setSelectedSvc]   = useState(null);
  const [fieldValues, setFieldValues]   = useState({});
  const [weight, setWeight]             = useState('');
  const [addonQty, setAddonQty]         = useState({});
  const [addonOwn, setAddonOwn]         = useState({}); // { [fieldId]: true } when "I'll provide my own"

  // Address autocomplete state
  const [addrSuggestions, setAddrSuggestions]   = useState([]);
  const [addrSuggestLoading, setAddrSuggestLoading] = useState(false);
  const [addrLocked, setAddrLocked]             = useState(false); // true once a suggestion is selected
  const [addrUnit, setAddrUnit]                 = useState('');   // unit/house no. + landmark
  const [pinConfirmed, setPinConfirmed]         = useState(false); // map pin confirmation
  const [selfPickup, setSelfPickup]             = useState(false); // customer drops off & picks up themselves

  // Step 2 state
  const [form, setForm] = useState({ name: '', phone: '', email: '', addr_text: '', pickup_date: '', pickup_time: '', delivery_zone_id: '', notes: '' });
  const [savedCustomer, setSavedCustomer] = useState(null);   // repeat customer data
  const [addressMode, setAddressMode]     = useState('new');  // 'saved' | 'new'
  const [lookingUp, setLookingUp]         = useState(false);
  const [isWhatsApp, setIsWhatsApp]       = useState(false);
  const phoneDebounce = useRef(null);

  // Step 3 state
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Cart
  const [cart, setCart] = useState([]);
  const [tried1, setTried1] = useState(false); // show field errors only after "Add to Cart" attempt

  // Promo
  const [promoInput,   setPromoInput]   = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null); // { code, discount_type, discount_value, discount }
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError,   setPromoError]   = useState('');

  // Messenger PSID — prefer URL param (embedded by bot in Book Now link), fall back to Extensions SDK
  const [messengerPsid, setMessengerPsid] = useState(
    () => new URLSearchParams(window.location.search).get('psid') || null
  );

  // Server-side cart ID for abandonment tracking
  const [serverCartId, setServerCartId] = useState(null);

  async function persistCart(updatedCart, currentStep) {
    try {
      const items = updatedCart.map(i => ({ service_id: i.service_id, service_name: i.service_name }));
      if (!serverCartId) {
        const { data } = await savePublicCart(tenantId, { fb_user_id: messengerPsid || null, items, step: currentStep || 1 });
        setServerCartId(data.cart_id);
      } else {
        await updatePublicCart(tenantId, serverCartId, { items, step: currentStep });
      }
    } catch (_) {}
  }

  // Result
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');
  const [result, setResult]         = useState(null); // { order_id, payment_url, total, service_name }

  useEffect(() => {
    // Fall back to Extensions SDK only when psid wasn't in the URL (e.g. old-style links)
    if (!new URLSearchParams(window.location.search).get('psid')) {
      const tryGetPsid = () => {
        try {
          if (window.MessengerExtensions) {
            window.MessengerExtensions.getUserID((err, ctx) => {
              if (!err && ctx?.psid) setMessengerPsid(ctx.psid);
            });
          }
        } catch (_) {}
      };
      tryGetPsid();
      setTimeout(tryGetPsid, 1500);
    }

    getPublicBootstrap(tenantId).then(({ data }) => {
      setTenant(data.tenant);
      setCategories(data.categories);
      setServices(data.services);
      setZones(data.zones);
      if (data.bracketInfo) setBracketInfo(data.bracketInfo);
      setBlockedDates(data.blockedDates);
      if (data.categories.length > 0) setActiveCat(data.categories[0].id);
    }).catch(e => {
      if (e.response?.status === 404) setNotFound(true);
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const visibleServices = activeCat
    ? services.filter(s => s.category_id === activeCat)
    : services;

  const price = selectedSvc ? Number(selectedSvc.price) : 0;

  // First number-type field drives qty multiplier (non-kg services)
  const firstNumField = (selectedSvc?.custom_fields || []).find(f => f.field_type === 'number');
  const qty = firstNumField ? parseFloat(fieldValues[firstNumField.id] || 0) : 0;

  // Auto-fill addon qty from piece count when sync_qty is enabled
  useEffect(() => {
    if (!selectedSvc || qty <= 0) return;
    const syncFields = (selectedSvc.custom_fields || []).filter(f => f.field_type === 'addon' && f.sync_qty);
    if (!syncFields.length) return;
    setAddonQty(prev => {
      const next = { ...prev };
      syncFields.forEach(f => { next[f.id] = qty; });
      return next;
    });
  }, [qty, selectedSvc]);

  // Variation (select) fields — sum selected option prices (with copy_base support)
  const selectFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'select');

  // Base variation price = price of the first fixed-priced selected option with price > 0
  const baseVariationPrice = (() => {
    for (const f of selectFields) {
      const opts = normalizeOpts(f.options);
      const sel = opts.find(o => o.label === fieldValues[f.id]);
      if (sel && (sel.price_type || 'fixed') !== 'copy_base' && Number(sel.price || 0) > 0) {
        return Number(sel.price);
      }
    }
    return 0;
  })();

  const variationTotal = selectFields.reduce((sum, f) => {
    const opts = normalizeOpts(f.options);
    const sel = opts.find(o => o.label === fieldValues[f.id]);
    if (!sel) return sum;
    const optPrice = (sel.price_type || 'fixed') === 'copy_base'
      ? baseVariationPrice
      : Number(sel.price || 0);
    return sum + optPrice;
  }, 0);

  // If any select option has a price > 0, use variation pricing (no base price)
  const hasVariationPricing = selectFields.some(f => normalizeOpts(f.options).some(o => Number(o.price || 0) > 0));

  // ID of the first fixed-priced select field (the primary per-unit variation)
  const primarySelectFieldId = (() => {
    for (const f of selectFields) {
      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
      if (sel && (sel.price_type || 'fixed') !== 'copy_base' && Number(sel.price || 0) > 0) return f.id;
    }
    return null;
  })();

  // Fields multiplied by qty: primary + copy_base (both are per-unit prices)
  const qtyScaledIds = hasVariationPricing && qty > 0
    ? new Set(selectFields.filter(f => {
        const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
        if (!sel) return false;
        return f.id === primarySelectFieldId || (sel.price_type || 'fixed') === 'copy_base';
      }).map(f => f.id))
    : new Set();

  const baseSubtotal = selectedSvc
    ? (qty > 0 ? (hasVariationPricing ? 0 : price * qty) : (hasVariationPricing ? 0 : price))
    : 0;

  const subtotal = selectedSvc
    ? (hasVariationPricing
        ? selectFields.reduce((sum, f) => {
            const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
            if (!sel) return sum;
            const p = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
            return sum + p * (qtyScaledIds.has(f.id) ? qty : 1);
          }, 0)
        : baseSubtotal + variationTotal)
    : 0;

  // Addon fields + totals
  const allAddonFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'addon');

  function isAddonVisible(f) {
    if (!f.linked_to_field_label) return true;
    const linkedField = (selectedSvc?.custom_fields || []).find(sf => sf.field_type === 'select' && sf.label === f.linked_to_field_label);
    if (!linkedField) return true;
    return fieldValues[linkedField.id] === f.linked_to_value;
  }

  const addonFields = allAddonFields.filter(isAddonVisible);
  const addonTotal = addonFields.reduce((s, f) => s + Number(f.unit_price || 0) * (addonQty[f.id] || 0), 0);

  const selectedZone = zones.find(z => z.id === Number(form.delivery_zone_id)) || null;
  const deliveryFee = selfPickup ? 0
    : bracketInfo ? (bracketFee !== null ? bracketFee : 0)
    : (selectedZone ? Number(selectedZone.fee) : 0);
  const total = subtotal + addonTotal + deliveryFee;

  // Cart totals (Step 2+)
  const cartTotal = cart.reduce((s, item) => s + item.itemTotal, 0);
  const promoDiscount = appliedPromo?.discount || 0;
  const grandTotal = Math.max(0, cartTotal + deliveryFee - promoDiscount);

  const minOrder = tenant?.minimum_order ? Number(tenant.minimum_order) : 0;
  const meetsMinOrder = minOrder === 0 || cartTotal >= minOrder;

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true); setPromoError('');
    try {
      const { data } = await validatePublicPromo(tenantId, promoInput.trim(), cartTotal + deliveryFee);
      setAppliedPromo(data);
    } catch (e) {
      setPromoError(e.response?.data?.error || 'Invalid promo code');
      setAppliedPromo(null);
    } finally { setPromoLoading(false); }
  }

  function addToCart() {
    const customFields = [];
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') {
        if (!isAddonVisible(f)) continue;
        const aqty = addonQty[f.id] || 0;
        if (aqty > 0) customFields.push({ label: f.label, value: String(aqty), unit_price: f.unit_price });
      } else if (fieldValues[f.id] !== undefined) {
        customFields.push({ label: f.label, value: fieldValues[f.id] });
      }
    }
    const displayLines = [];
    if (!hasVariationPricing && baseSubtotal > 0) {
      displayLines.push({ label: `${selectedSvc.name}${qty > 0 ? ` × ${qty}` : ''}`, price: baseSubtotal });
    }
    selectFields.forEach(f => {
      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
      if (!sel) return;
      const rp = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
      const scaled = qtyScaledIds.has(f.id);
      displayLines.push({ label: `${f.label}: ${sel.label}${scaled && qty > 1 ? ` × ${qty}` : ''}`, price: scaled ? rp * qty : rp });
    });
    addonFields.filter(f => (addonQty[f.id] || 0) > 0).forEach(f => {
      displayLines.push({ label: `${f.label} × ${addonQty[f.id]}`, price: Number(f.unit_price || 0) * addonQty[f.id] });
    });
    // include "own provision" entries for required addons where customer chose to provide their own
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon' && isAddonVisible(f) && f.allow_own && addonOwn[f.id] && !(addonQty[f.id] > 0)) {
        customFields.push({ label: f.label, value: 'Customer provides own' });
        displayLines.push({ label: `${f.label}: Customer provides own`, price: 0 });
      }
    }
    const newItem = {
      _id: Date.now(),
      service_id: selectedSvc.id,
      service_name: selectedSvc.name,
      custom_fields: customFields,
      displayLines,
      itemTotal: subtotal + addonTotal,
    };
    setCart(prev => {
      const updated = [...prev, newItem];
      persistCart(updated, 1);
      return updated;
    });
    setSelectedSvc(null); setFieldValues({}); setWeight(''); setAddonQty({}); setAddonOwn({});
  }

  function step1Valid() {
    if (!selectedSvc) return false;
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') {
        if (f.required && isAddonVisible(f)) {
          const hasPurchased = (addonQty[f.id] || 0) > 0;
          const hasOwn = f.allow_own && addonOwn[f.id];
          if (!hasPurchased && !hasOwn) return false;
        }
        continue;
      }
      if (f.required && f.label?.toLowerCase().includes('weight')) {
        if (!weight || parseFloat(weight) <= 0) return false;
      } else if (f.required && !fieldValues[f.id]) return false;
    }
    return true;
  }

  const fullAddress = addressMode === 'saved' && savedCustomer?.address
    ? savedCustomer.address
    : addrUnit.trim()
      ? `${addrUnit.trim()}, ${form.addr_text}`
      : form.addr_text;

  function step2Valid() {
    if (!cart.length) return false;
    const hasDateTime = tenant?.store_open
      ? (form.pickup_date && form.pickup_time)
      : !!form.pickup_date;
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !hasDateTime) return false;
    const ph = form.phone.trim().replace(/\s/g, '');
    const isValidPH = /^(09|\+639|639)\d{9}$/.test(ph);
    if (!isValidPH && !isWhatsApp) return false;
    if (!selfPickup) {
      const hasAddress = addressMode === 'saved'
        ? !!savedCustomer?.address
        : !!(addrLocked && form.addr_text.trim());
      if (!hasAddress) return false;
      // Require unit/landmark for new addresses
      if (addressMode === 'new' && addrLocked && !addrUnit.trim()) return false;
      if (bracketInfo) {
        if (geocoding) return false;
        if (bracketError) return false;
        if (bracketFee === null) return false;
        // Require pin confirmation when map is visible
        if (customerCoords && !pinConfirmed) return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true); setSubmitErr('');
    try {
      const pickupDatetime = form.pickup_time
        ? `${form.pickup_date}T${form.pickup_time}:00`
        : form.pickup_date;
      const selfPickupNote = selfPickup ? '[Self drop-off & pick-up]' : '';
      const combinedNotes = [selfPickupNote, form.notes.trim()].filter(Boolean).join(' ');
      const { data } = await createPublicOrder(tenantId, {
        cart: cart.map(item => ({ service_id: item.service_id, custom_fields: item.custom_fields })),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: selfPickup ? 'Self drop-off & pick-up' : fullAddress,
        is_dropoff: selfPickup || undefined,
        pickup_date: pickupDatetime,
        delivery_zone_id: (!selfPickup && !bracketInfo && form.delivery_zone_id) ? Number(form.delivery_zone_id) : undefined,
        customer_lat: (!selfPickup && bracketInfo && customerCoords) ? customerCoords.lat : undefined,
        customer_lng: (!selfPickup && bracketInfo && customerCoords) ? customerCoords.lng : undefined,
        notes: combinedNotes || undefined,
        promo_code: appliedPromo?.code || undefined,
        fb_id: messengerPsid || undefined,
      });
      setResult(data);
      setStep('success');
      if (serverCartId) updatePublicCart(tenantId, serverCartId, { converted: true }).catch(() => {});
    } catch (e) {
      setSubmitErr(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  }

  // Geocode saved address when bracket system is active
  // (New addresses use autocomplete — coords set directly on suggestion select)
  useEffect(() => {
    if (!bracketInfo) return;
    if (addressMode === 'saved' && savedCustomer?.address) {
      clearTimeout(geocodeTimer.current);
      geocodeTimer.current = setTimeout(() => triggerGeocode(savedCustomer.address), 600);
    } else if (addressMode === 'new') {
      // Reset when switching to new address mode
      setCustomerCoords(null); setBracketFee(null); setBracketDistKm(null); setBracketError('');
    }
  }, [addressMode, savedCustomer, bracketInfo]);

  function clearAddrSelection() {
    setAddrLocked(false);
    setAddrUnit('');
    setPinConfirmed(false);
    setForm(p => ({ ...p, addr_text: '' }));
    setCustomerCoords(null);
    setBracketFee(null);
    setBracketDistKm(null);
    setBracketError('');
    setAddrSuggestions([]);
  }

  async function fetchSuggestions(q) {
    setAddrSuggestLoading(true);
    try {
      const { data } = await getPublicAddressSuggest(q);
      setAddrSuggestions(data || []);
    } catch { setAddrSuggestions([]); }
    finally { setAddrSuggestLoading(false); }
  }

  async function triggerGeocode(q) {
    if (!bracketInfo) return;
    setGeocoding(true); setBracketError('');
    try {
      const { data } = await getPublicGeocode(q);
      if (!data?.lat) { setBracketError('Address not found on map — please enter a more specific address.'); return; }
      const lat = Number(data.lat), lng = Number(data.lng);
      setCustomerCoords({ lat, lng });
      computeBracketFee(lat, lng);
    } catch { setBracketError('Could not locate address. Please check and try again.'); }
    finally { setGeocoding(false); }
  }

  function computeBracketFee(lat, lng) {
    if (!bracketInfo?.shop_lat) return;
    const dist = haversineKm(lat, lng, Number(bracketInfo.shop_lat), Number(bracketInfo.shop_lng));
    setBracketDistKm(dist);
    const radius = Number(bracketInfo.delivery_radius || 15);
    if (dist > radius) {
      setBracketFee(null);
      setBracketError(`Sorry, your address is ${dist.toFixed(1)} km away — outside our ${radius} km delivery range.`);
      return;
    }
    const brackets = (bracketInfo.brackets || []).sort((a, b) => a.min_km - b.min_km);
    const bracket = brackets.find(b => dist >= Number(b.min_km) && dist <= Number(b.max_km));
    setBracketFee(bracket ? Number(bracket.fee) : 0);
    setBracketError('');
  }

  // Init / update Leaflet map when customerCoords changes
  useEffect(() => {
    if (!bracketInfo || !customerCoords || !mapContainerRef.current) return;
    if (!window.L) return;
    const { lat, lng } = customerCoords;
    const shopLat = Number(bracketInfo.shop_lat), shopLng = Number(bracketInfo.shop_lng);
    if (!leafletMapRef.current) {
      const pinIcon = window.L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
      });
      const map = window.L.map(mapContainerRef.current).setView([lat, lng], 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      window.L.marker([shopLat, shopLng], { icon: pinIcon }).addTo(map).bindPopup('Shop');
      const custMarker = window.L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map).bindPopup('Your location').openPopup();
      custMarker.on('dragend', () => {
        const { lat: la, lng: lo } = custMarker.getLatLng();
        setCustomerCoords({ lat: la, lng: lo });
        computeBracketFee(la, lo);
      });
      leafletMapRef.current = map;
      leafletCustRef.current = custMarker;
    } else {
      leafletCustRef.current?.setLatLng([lat, lng]);
      leafletMapRef.current.setView([lat, lng], 14);
    }
    return () => {};
  }, [customerCoords]);

  // Cleanup Leaflet on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletCustRef.current = null;
      }
      clearTimeout(geocodeTimer.current);
      clearTimeout(suggestTimer.current);
    };
  }, []);

  // Auto-close after success only if no payment URL (Messenger mini-app flow)
  useEffect(() => {
    if (step !== 'success') return;
    if (result?.payment_url) return;
    const t = setTimeout(closeMiniApp, 3000);
    return () => clearTimeout(t);
  }, [step, result]);


  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2F5F8', borderTopColor: '#38a9c2', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: 32 }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon name="search" size={48} color="#9CA3AF" /></div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Shop not found</div>
        <div style={{ color: '#374151', fontSize: 14 }}>This booking link is invalid or the shop is no longer active.</div>
      </div>
    </div>
  );

  const cardStyle = { background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '1.75rem', maxWidth: 620, margin: '0 auto' };

  // ─── Success ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #d6eff4 0%, #F7F7F5 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 380, width: '100%' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>{result.is_dropoff ? <Icon name="store" size={64} color="#38a9c2" /> : <Icon name="checkCircle" size={64} color="#38a9c2" />}</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#111827', marginBottom: 10 }}>
            {result.is_dropoff ? 'Drop-off Booking Received!' : 'Booking Confirmed!'}
          </div>
          <div style={{ fontSize: 13, color: '#1a7d94', fontWeight: 600, marginBottom: 8 }}>
            Ref: {result.booking_ref}
          </div>
          {result.is_dropoff && result.payment_url && (
            <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '10px 14px', marginBottom: 16, border: '1.5px solid #F59E0B', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="warning" size={13} color="#92400E" /> Payment required before drop-off</div>
              <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>Your slot is not confirmed until payment is received. Please pay below before coming to the shop.</div>
            </div>
          )}
          <div style={{ fontSize: 14, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
            {messengerPsid
              ? 'Check your Messenger — we sent you the full booking details.'
              : result.is_dropoff
                ? 'We\'ve received your booking. Pay below to confirm your drop-off slot.'
                : 'We\'ve received your order and will be in touch shortly.'}
          </div>
          {result.payment_url && (
            <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 20, border: `1.5px solid ${result.is_dropoff ? '#F59E0B' : '#9ED3DC'}`, boxShadow: '0 2px 12px rgba(56,169,194,.1)' }}>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{result.is_dropoff ? 'Pay now to confirm your slot' : 'Total due'}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 12 }}>
                ₱{Number(result.total).toLocaleString('en-PH')}
                {result.promo_discount > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', marginLeft: 8 }}>
                    (₱{Number(result.promo_discount).toLocaleString('en-PH')} off)
                  </span>
                )}
              </div>
              <a href={result.payment_url} target="_blank" rel="noreferrer"
                style={{ display: 'block', padding: '13px 24px', borderRadius: 10, background: result.is_dropoff ? '#D97706' : '#38a9c2', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                <Icon name="card" size={15} color="#fff" style={{ marginRight: 6 }} /> Pay Now
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #d6eff4 0%, #F7F7F5 60%)', padding: '2rem 1rem', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {tenant?.logo_url && !tenant.logo_url.startsWith('data:') && (
          <img src={tenant.logo_url} alt={tenant.name} style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,.12)' }} />
        )}
        <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>{tenant?.name}</div>
        <div style={{ fontSize: 13, color: '#374151', marginTop: 3 }}>Online Booking</div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ maxWidth: 620, margin: '0 auto 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
        {[{ n: 1, label: 'Service' }, { n: 2, label: 'Details' }, { n: 3, label: 'Review' }].map(({ n, label }, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: step > n ? 'pointer' : 'default' }}
              onClick={() => { if (step > n) setStep(n); }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
                background: step > n ? '#38a9c2' : step === n ? '#38a9c2' : '#E2E8F0',
                color: step >= n ? '#fff' : '#374151',
                transition: 'all .2s',
              }}>
                {step > n ? '✓' : n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: step >= n ? '#38a9c2' : '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > n ? '#38a9c2' : '#E2E8F0', margin: '0 6px 16px', transition: 'all .2s' }} />}
          </div>
        ))}
      </div>

      <div style={cardStyle}>

        {/* ════════════ STEP 1 – SELECT SERVICE ════════════ */}
        {step === 1 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Choose a Service</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Select the laundry service you need.</div>

            {/* Category tabs */}
            {categories.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => setActiveCat(null)}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: activeCat === null ? '#38a9c2' : '#F0F0EC', color: activeCat === null ? '#fff' : '#374151', border: 'none' }}>
                  All
                </button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: activeCat === c.id ? '#38a9c2' : '#F0F0EC', color: activeCat === c.id ? '#fff' : '#374151', border: 'none' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Service cards */}
            {visibleServices.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>No services available in this category.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {visibleServices.map(svc => {
                  const selected = selectedSvc?.id === svc.id;
                  return (
                    <div key={svc.id} onClick={() => { setSelectedSvc(svc); setFieldValues({}); setWeight(''); setAddonQty({}); setAddonOwn({}); setTried1(false); }}
                      style={{
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        border: selected ? '2px solid #38a9c2' : '1.5px solid #E2E8F0',
                        background: selected ? '#EBF8FA' : '#fff',
                        transition: 'all .15s',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                      }}>
                      {svc.image_url && (
                        <img src={svc.image_url} alt={svc.name}
                          style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: '#111827' }}>{svc.name}</div>
                        {svc.description && <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{svc.description}</div>}
                        {svc.category_name && !activeCat && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#E2F5F8', color: '#1a7d94', fontWeight: 600, marginTop: 5, display: 'inline-block' }}>
                            {svc.category_name}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {(() => { const sa = getStartsAt(svc); return sa != null ? (
                          <>
                            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 500 }}>Starts at</div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#38a9c2' }}>₱{sa.toLocaleString()}</div>
                          </>
                        ) : (
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#38a9c2' }}>₱{Number(svc.price).toLocaleString()}</div>
                        ); })()}
                        <div style={{ fontSize: 11, color: '#374151' }}>{svc.unit || 'flat'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom fields / weight for selected service */}
            {selectedSvc && (
              <div style={{ marginTop: 20, padding: '16px', background: '#F7F9FD', borderRadius: 12, border: '1.5px solid #E2F5F8' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#1a7d94', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="clipboard" size={13} color="#1a7d94" /> Service Details — {selectedSvc.name}
                </div>

                {/* Custom fields */}
                {(selectedSvc.custom_fields || []).map(f => {
                  // Add-on field: stepper UI
                  if (f.field_type === 'addon') {
                    if (!isAddonVisible(f)) return null;
                    const aqty = addonQty[f.id] || 0;
                    const isOwn = !!(f.allow_own && addonOwn[f.id]);
                    const lineTotal = Number(f.unit_price || 0) * aqty;
                    const unsatisfied = tried1 && f.required && aqty === 0 && !isOwn;
                    return (
                      <div key={f.id} style={{ marginBottom: 14, background: '#fff', border: `1.5px solid ${unsatisfied ? '#F09595' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                              {f.label}
                              {f.required && <span style={{ color: '#E53E3E', marginLeft: 4, fontSize: 11 }}>*</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#38a9c2', fontWeight: 600, marginTop: 1 }}>+₱{Number(f.unit_price || 0).toLocaleString()} each</div>
                            {f.placeholder && <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>{f.placeholder}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 0, opacity: isOwn ? 0.4 : 1 }}>
                            <button type="button" disabled={isOwn}
                              onClick={() => setAddonQty(p => ({ ...p, [f.id]: Math.max(0, (p[f.id] || 0) - 1) }))}
                              style={{ width: 32, height: 32, borderRadius: '8px 0 0 8px', border: '1.5px solid #E2E8F0', background: '#F7F9FD', fontSize: 16, cursor: isOwn ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>−</button>
                            <div style={{ width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #E2E8F0', borderLeft: 'none', borderRight: 'none', fontSize: 14, fontWeight: 700, background: aqty > 0 ? '#E2F5F8' : '#fff', color: aqty > 0 ? '#1a7d94' : '#374151' }}>{aqty}</div>
                            <button type="button" disabled={isOwn}
                              onClick={() => setAddonQty(p => ({ ...p, [f.id]: (p[f.id] || 0) + 1 }))}
                              style={{ width: 32, height: 32, borderRadius: '0 8px 8px 0', border: '1.5px solid #38a9c2', background: '#38a9c2', fontSize: 16, cursor: isOwn ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>+</button>
                          </div>
                          {lineTotal > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7d94', minWidth: 60, textAlign: 'right' }}>₱{lineTotal.toLocaleString()}</div>}
                        </div>
                        {f.allow_own && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: isOwn ? '#1a7d94' : '#374151', fontWeight: isOwn ? 600 : 400 }}>
                              <div onClick={() => {
                                const next = !isOwn;
                                setAddonOwn(p => ({ ...p, [f.id]: next }));
                                if (next) setAddonQty(p => ({ ...p, [f.id]: 0 }));
                              }} style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `2px solid ${isOwn ? '#38a9c2' : '#CBD5E0'}`, background: isOwn ? '#38a9c2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                                {isOwn && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                              </div>
                              I'll provide my own {f.label.toLowerCase()}
                            </label>
                          </div>
                        )}
                        {unsatisfied && (
                          <div style={{ marginTop: 8, fontSize: 11, color: '#A32D2D', fontWeight: 600 }}>
                            Please select a quantity or choose to provide your own.
                          </div>
                        )}
                      </div>
                    );
                  }
                  // Variation select: e-commerce button group
                  if (f.field_type === 'select') {
                    const opts = normalizeOpts(f.options);
                    const selectedVal = fieldValues[f.id];
                    const selectErr = tried1 && f.required && !selectedVal;
                    return (
                      <div key={f.id} style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                          {f.label}{f.required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...(selectErr ? { padding: 8, borderRadius: 8, border: '1.5px solid #F87171', background: '#FFF5F5' } : {}) }}>
                          {opts.map(opt => {
                            const isSel = selectedVal === opt.label;
                            return (
                              <button key={opt.label} type="button"
                                onClick={() => setFieldValues(p => ({ ...p, [f.id]: opt.label }))}
                                style={{
                                  padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                                  border: isSel ? '2px solid #38a9c2' : '1.5px solid #E2E8F0',
                                  background: isSel ? '#E2F5F8' : '#fff',
                                  color: isSel ? '#1a7d94' : '#374151',
                                  fontSize: 13, fontWeight: isSel ? 700 : 500,
                                  transition: 'all .15s', textAlign: 'center', minWidth: 80,
                                }}>
                                <div>{opt.label}</div>
                                {(opt.price_type === 'copy_base' || opt.price > 0) && (
                                  <div style={{ fontSize: 11, color: isSel ? '#38a9c2' : '#7C3AED', marginTop: 2, fontWeight: 600 }}>
                                    {opt.price_type === 'copy_base'
                                      ? (baseVariationPrice > 0 ? `+₱${Number(baseVariationPrice).toLocaleString()}` : '= base')
                                      : `+₱${Number(opt.price).toLocaleString()}`}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {selectErr && (
                          <div style={{ marginTop: 5, fontSize: 11, color: '#A32D2D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="warning" size={11} color="#A32D2D" /> Please select an option.
                          </div>
                        )}
                      </div>
                    );
                  }
                  // Regular fields (text, number, textarea)
                  const fieldErr = tried1 && f.required && !fieldValues[f.id];
                  return (
                    <Field key={f.id} label={f.label + (f.field_type === 'number' ? ' (× price)' : '')} required={f.required} error={fieldErr ? 'This field is required.' : ''}>
                      {f.field_type === 'textarea' ? (
                        <textarea
                          style={{ ...INPUT, ...(fieldErr ? { borderColor: '#F87171', background: '#FFF5F5', boxShadow: '0 0 0 3px rgba(248,113,113,.12)' } : {}), resize: 'vertical', minHeight: 80 }}
                          value={fieldValues[f.id] || ''}
                          onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                          placeholder={f.placeholder || 'Enter your notes here…'}
                          onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                          onBlur={e => { e.target.style.borderColor = fieldErr ? '#F87171' : '#B8C4CE'; e.target.style.boxShadow = fieldErr ? '0 0 0 3px rgba(248,113,113,.12)' : 'none'; }}
                        />
                      ) : (
                        <input style={fieldErr ? INPUT_ERR : INPUT}
                          type={f.field_type === 'number' ? 'number' : 'text'}
                          min={f.field_type === 'number' && f.min_value != null ? f.min_value : undefined}
                          max={f.field_type === 'number' && f.max_value != null ? f.max_value : undefined}
                          value={fieldValues[f.id] || ''}
                          onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                          placeholder={f.placeholder || ''}
                          onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                          onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
                        />
                      )}
                    </Field>
                  );
                })}

                {/* Live price breakdown */}
                {selectedSvc && (subtotal > 0 || addonTotal > 0) && (
                  <div style={{ marginTop: 12, background: '#E6F5F8', borderRadius: 10, padding: '10px 14px', border: '1px solid #9ED3DC' }}>
                    {baseSubtotal > 0 && !hasVariationPricing && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1a7d94', marginBottom: 4 }}>
                        <span>{selectedSvc.name}{qty > 0 ? ` × ${qty}` : ''}</span>
                        <span style={{ fontWeight: 600 }}>₱{baseSubtotal.toLocaleString()}</span>
                      </div>
                    )}
                    {selectFields.map(f => {
                      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
                      if (!sel) return null;
                      const resolvedPrice = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
                      const scaledByQty = qtyScaledIds.has(f.id);
                      const displayPrice = scaledByQty ? resolvedPrice * qty : resolvedPrice;
                      return (
                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                          <span>{f.label}: <strong>{sel.label}</strong>{scaledByQty && qty > 1 ? ` × ${qty}` : ''}</span>
                          <span style={{ fontWeight: 600 }}>{displayPrice > 0 ? `₱${displayPrice.toLocaleString()}` : '—'}</span>
                        </div>
                      );
                    })}
                    {addonFields.filter(f => (addonQty[f.id] || 0) > 0).map(f => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                        <span>{f.label} × {addonQty[f.id]}</span>
                        <span style={{ fontWeight: 600 }}>₱{(Number(f.unit_price || 0) * addonQty[f.id]).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#1a7d94', borderTop: '1px solid #9ED3DC', paddingTop: 6, marginTop: 2 }}>
                      <span>Subtotal</span>
                      <span>₱{(subtotal + addonTotal).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cart items list */}
            {cart.length > 0 && (
              <div style={{ marginTop: 20, border: '1.5px solid #9ED3DC', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#E6F5F8', fontWeight: 700, fontSize: 12, color: '#1a7d94', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="cart" size={12} color="#1a7d94" /> Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                  <span>₱{cartTotal.toLocaleString()}</span>
                </div>
                {cart.map((item, i) => (
                  <div key={item._id} style={{ padding: '10px 14px', borderTop: i > 0 ? '1px solid #E2E8F0' : 'none', display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{item.service_name}</div>
                      {item.displayLines.map((l, j) => (
                        <div key={j} style={{ fontSize: 12, color: '#374151', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                          <span>{l.label}</span>
                          <span style={{ fontWeight: 500 }}>{l.price > 0 ? `₱${l.price.toLocaleString()}` : ''}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#38a9c2', marginTop: 4 }}>₱{item.itemTotal.toLocaleString()}</div>
                    </div>
                    <button type="button" onClick={() => setCart(prev => prev.filter(c => c._id !== item._id))}
                      style={{ flexShrink: 0, padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { if (!selectedSvc) return; if (!step1Valid()) { setTried1(true); return; } addToCart(); }}
                disabled={!selectedSvc}
                style={{ flex: 1, padding: 13, borderRadius: 10, border: selectedSvc ? '2px solid #38a9c2' : '1.5px solid #E2E8F0', fontSize: 14, fontWeight: 700, cursor: selectedSvc ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  background: selectedSvc ? '#fff' : '#E2E8F0', color: selectedSvc ? '#38a9c2' : '#374151', transition: 'all .15s' }}>
                + Add to Cart
              </button>
              {cart.length > 0 && (
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => meetsMinOrder && setStep(2)} disabled={!meetsMinOrder}
                    style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: meetsMinOrder ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: meetsMinOrder ? '#fdca00' : '#E2E8F0', color: meetsMinOrder ? '#1F2937' : '#374151', transition: 'all .15s' }}>
                    Checkout ({cart.length}) · ₱{cartTotal.toLocaleString()} →
                  </button>
                  {!meetsMinOrder && (
                    <div style={{ fontSize: 11, color: '#A32D2D', textAlign: 'center', fontWeight: 600 }}>
                      Minimum order is ₱{minOrder.toLocaleString()} — add ₱{(minOrder - cartTotal).toLocaleString()} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ STEP 2 – CUSTOMER DETAILS ════════════ */}
        {step === 2 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Your Details</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Tell us how to reach you and where to pick up.</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
              <Field label="Full Name" required>
                <input style={INPUT} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Maria Santos"
                  onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                  onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
                />
              </Field>
              <Field label="Phone Number" required>
                <input style={INPUT} type="tel" value={form.phone}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, phone: val }));
                    if (/^(09|\+639|639)\d{9}$/.test(val.replace(/\s/g, ''))) setIsWhatsApp(false);
                    setSavedCustomer(null); setAddressMode('new');
                    clearTimeout(phoneDebounce.current);
                    if (val.trim().length >= 10) {
                      phoneDebounce.current = setTimeout(async () => {
                        setLookingUp(true);
                        try {
                          const { data } = await lookupPublicCustomer(tenantId, val.trim());
                          if (data) {
                            setSavedCustomer(data);
                            setAddressMode('saved');
                            setForm(p => ({
                              ...p,
                              name:  p.name  || data.name  || '',
                              email: p.email || data.email || '',
                            }));
                          }
                        } catch (_) {}
                        setLookingUp(false);
                      }, 600);
                    }
                  }}
                  placeholder={isWhatsApp ? '+[country code] XXXXXXXXXX' : '09XX XXX XXXX'}
                  onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                  onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
                />
                {lookingUp && <div style={{ fontSize: 11, color: '#38a9c2', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="search" size={11} color="#38a9c2" /> Checking for saved address…</div>}
                {(() => {
                  const ph = form.phone.trim();
                  if (!ph) return null;
                  const isValidPH = /^(09|\+639|639)\d{9}$/.test(ph.replace(/\s/g, ''));
                  if (isValidPH && !isWhatsApp) return null;
                  if (isWhatsApp) return (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#15803d', background: '#F0FDF4', borderRadius: 6, padding: '5px 9px', marginTop: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked onChange={() => { setIsWhatsApp(false); }} />
                      WhatsApp number — will be contacted via WhatsApp
                    </label>
                  );
                  return (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#92400e', background: '#FEF3C7', borderRadius: 6, padding: '5px 9px', marginTop: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={false} onChange={() => setIsWhatsApp(true)} />
                      Not a Philippine number? Tick here to use your WhatsApp number instead
                    </label>
                  );
                })()}
              </Field>
            </div>

            <Field label="Email Address" required>
              <input style={INPUT} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="maria@gmail.com (for receipt)"
                onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
              />
            </Field>

            {/* ── Delivery mode toggle ── */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...LABEL, marginBottom: 8 }}>How would you like your laundry handled? <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" onClick={() => setSelfPickup(false)}
                  style={{ padding: '12px 10px', borderRadius: 10, border: `2px solid ${!selfPickup ? '#38a9c2' : '#E2E8F0'}`, background: !selfPickup ? '#E6F5F8' : '#FAFAFA', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all .15s' }}>
                  <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}><Icon name="truck" size={20} color={!selfPickup ? '#1a7d94' : '#374151'} /></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: !selfPickup ? '#1a7d94' : '#374151' }}>Pick-up & Delivery</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>We'll come to you</div>
                </button>
                <button type="button" onClick={() => { setSelfPickup(true); setBracketFee(null); setBracketError(''); }}
                  style={{ padding: '12px 10px', borderRadius: 10, border: `2px solid ${selfPickup ? '#38a9c2' : '#E2E8F0'}`, background: selfPickup ? '#E6F5F8' : '#FAFAFA', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all .15s' }}>
                  <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}><Icon name="store" size={20} color={selfPickup ? '#1a7d94' : '#374151'} /></div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selfPickup ? '#1a7d94' : '#374151' }}>I'll Drop Off & Pick Up</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Bring it to our shop</div>
                </button>
              </div>
            </div>

            {!selfPickup && (
            <div style={{ marginBottom: 6 }}>
              <label style={{ ...LABEL, marginBottom: 10 }}>Pickup Address <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span></label>

              {/* Repeat customer — saved address banner */}
              {savedCustomer && (
                <div style={{ marginBottom: 10, borderRadius: 10, border: '1.5px solid #9ED3DC', background: '#E6F5F8', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ marginTop: 1 }}><Icon name="hand" size={20} color="#1a7d94" /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1a7d94' }}>Welcome back, {savedCustomer.name}!</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>We found your saved address:</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 4, padding: '6px 10px', background: '#fff', borderRadius: 7, border: '1px solid #9ED3DC', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <Icon name="pin" size={13} color="#38a9c2" style={{ marginTop: 1, flexShrink: 0 }} /> {savedCustomer.address}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #9ED3DC' }}>
                    <button type="button"
                      onClick={() => setAddressMode('saved')}
                      style={{ padding: '10px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: addressMode === 'saved' ? '#38a9c2' : '#F0F7FF',
                        color: addressMode === 'saved' ? '#fff' : '#1a7d94',
                        borderRight: '1px solid #9ED3DC' }}>
                      ✓ Use this address
                    </button>
                    <button type="button"
                      onClick={() => setAddressMode('new')}
                      style={{ padding: '10px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: addressMode === 'new' ? '#38a9c2' : '#F0F7FF',
                        color: addressMode === 'new' ? '#fff' : '#1a7d94' }}>
                      + Enter new address
                    </button>
                  </div>
                </div>
              )}

              {/* New address — autocomplete search */}
              {addressMode === 'new' && (
                <div style={{ position: 'relative' }}>
                  {addrLocked ? (
                    /* Confirmed selection */
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#E6F5F8', borderRadius: 8, border: '1.5px solid #38a9c2' }}>
                        <Icon name="pin" size={18} color="#38a9c2" style={{ marginTop: 1, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, color: '#111827', lineHeight: 1.5 }}>{form.addr_text}</span>
                        <button type="button" onClick={clearAddrSelection}
                          style={{ flexShrink: 0, fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid #38a9c2', background: '#fff', color: '#1a7d94', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                          Change
                        </button>
                      </div>
                      {/* Unit / landmark — required */}
                      <div style={{ marginTop: 10 }}>
                        <label style={{ ...LABEL, marginBottom: 5 }}>
                          Unit / House No. / Landmark <span style={{ color: '#E53E3E' }}>*</span>
                        </label>
                        <input
                          style={{ ...INPUT, borderColor: addrUnit.trim() ? '#38a9c2' : '#E2E8F0' }}
                          value={addrUnit}
                          onChange={e => setAddrUnit(e.target.value)}
                          placeholder="e.g. Unit 3B, 2nd floor, beside Mercury Drug"
                          autoComplete="off"
                        />
                        {!addrUnit.trim() && (
                          <div style={{ fontSize: 11, color: '#D97706', marginTop: 5, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Icon name="warning" size={11} color="#D97706" /> Required — helps our rider find you exactly.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Search input */
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ ...INPUT, paddingRight: 38 }}
                        value={form.addr_text}
                        onChange={e => {
                          const val = e.target.value;
                          setForm(p => ({ ...p, addr_text: val }));
                          setAddrLocked(false);
                          setCustomerCoords(null); setBracketFee(null); setBracketDistKm(null); setBracketError('');
                          clearTimeout(suggestTimer.current);
                          if (val.trim().length >= 3) {
                            suggestTimer.current = setTimeout(() => fetchSuggestions(val), 450);
                          } else {
                            setAddrSuggestions([]);
                          }
                        }}
                        onBlur={() => setTimeout(() => setAddrSuggestions([]), 200)}
                        placeholder="Type your address to search… (e.g. 123 Rizal St, Barangay X)"
                        autoComplete="off"
                        onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                      />
                      <div style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                        {addrSuggestLoading
                          ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #E2E8F0', borderTopColor: '#38a9c2', animation: 'spin .7s linear infinite' }} />
                          : <Icon name="search" size={14} color="#9CA3AF" />}
                      </div>
                    </div>
                  )}

                  {/* Suggestions dropdown */}
                  {addrSuggestions.length > 0 && !addrLocked && (
                    <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1.5px solid #9ED3DC', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)', overflow: 'hidden' }}>
                      {addrSuggestions.map((s, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => {
                            setForm(p => ({ ...p, addr_text: s.full }));
                            setAddrLocked(true);
                            setAddrSuggestions([]);
                            setCustomerCoords({ lat: s.lat, lng: s.lng });
                            computeBracketFee(s.lat, s.lng);
                          }}
                          style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < addrSuggestions.length - 1 ? '0.5px solid #EEF0F4' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: '#374151', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Must-select hint — typed but not locked */}
                  {!addrLocked && form.addr_text.trim().length >= 3 && addrSuggestions.length === 0 && !addrSuggestLoading && (
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 6, padding: '6px 10px', background: '#FFF8E1', borderRadius: 6, border: '0.5px solid #FCD34D', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="info" size={11} color="#D97706" /> No results yet — try adding barangay or city name (e.g. "123 Rizal St, Makati")
                    </div>
                  )}
                  {!addrLocked && form.addr_text.trim().length >= 3 && addrSuggestions.length > 0 && (
                    <div style={{ fontSize: 11, color: '#D97706', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="info" size={11} color="#D97706" /> Please select your address from the list above to continue.
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* ── Delivery Fee / Self-pickup badge ── */}
            {selfPickup ? (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, border: '1.5px solid #34D399', background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="store" size={22} color="#065F46" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#065F46' }}>No delivery fee!</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>You'll drop off and pick up at our shop. Date & time below is when we expect you.</div>
                </div>
              </div>
            ) : bracketInfo ? (
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Delivery Fee</label>
                {geocoding && (
                  <div style={{ fontSize: 12, color: '#374151', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="pin" size={12} color="#374151" /> Locating your address…</div>
                )}
                {bracketError && !geocoding && (
                  <div style={{ fontSize: 12, color: '#A32D2D', background: '#FCEBEB', borderRadius: 7, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <Icon name="warning" size={12} color="#A32D2D" style={{ marginTop: 1, flexShrink: 0 }} /> {bracketError}
                  </div>
                )}
                {!bracketError && bracketFee !== null && !geocoding && (
                  <div style={{ fontSize: 12, color: '#1a7d94', fontWeight: 600, marginBottom: 6 }}>
                    +₱{bracketFee.toLocaleString()} delivery fee ({bracketDistKm?.toFixed(1)} km from shop)
                  </div>
                )}
                {!geocoding && !customerCoords && !bracketError && (
                  <div style={{ fontSize: 12, color: '#374151', padding: '4px 0' }}>
                    Fill in your address above to auto-calculate delivery fee.
                  </div>
                )}
                {customerCoords && (
                  <div>
                    <div ref={mapContainerRef} style={{ width: '100%', height: 200, borderRadius: 10, border: '1.5px solid #9ED3DC', overflow: 'hidden', marginTop: 6 }} />
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, cursor: 'pointer',
                      padding: '10px 12px', borderRadius: 8,
                      background: pinConfirmed ? '#F0FDF4' : '#FFFBEB',
                      border: `1.5px solid ${pinConfirmed ? '#34D399' : '#FCD34D'}` }}>
                      <input type="checkbox" checked={pinConfirmed} onChange={e => setPinConfirmed(e.target.checked)}
                        style={{ marginTop: 1, flexShrink: 0, accentColor: '#38a9c2', width: 15, height: 15 }} />
                      <span style={{ fontSize: 12, color: pinConfirmed ? '#065F46' : '#92400E', lineHeight: 1.5 }}>
                        {pinConfirmed
                          ? '✓ Pin confirmed — we know where to pick up your laundry.'
                          : 'Please confirm the pin is at or near your location. You can drag it to adjust.'}
                      </span>
                    </label>
                  </div>
                )}
                {bracketInfo.delivery_note && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#374151', background: '#F7F9FD', border: '1px solid #9ED3DC', borderRadius: 7, padding: '7px 10px', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <Icon name="info" size={12} color="#374151" style={{ marginTop: 1, flexShrink: 0 }} /> {bracketInfo.delivery_note}
                  </div>
                )}
              </div>
            ) : (
              <Field label="Pick-up / Delivery Zone" required={false} style={{ marginTop: 16 }}>
                <select style={INPUT} value={form.delivery_zone_id}
                  onChange={e => setForm(p => ({ ...p, delivery_zone_id: e.target.value }))}>
                  <option value="">{zones.length > 0 ? '— Select your area —' : 'No delivery zones set up'}</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name} — ₱{Number(z.fee).toLocaleString()} delivery fee</option>
                  ))}
                </select>
                {form.delivery_zone_id && selectedZone && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: '#1a7d94', fontWeight: 600 }}>
                      +₱{Number(selectedZone.fee).toLocaleString()} delivery fee will be added
                    </div>
                    {selectedZone.custom_note && (
                      <div style={{ marginTop: 5, fontSize: 12, color: '#374151', background: '#F7F9FD', border: '1px solid #9ED3DC', borderRadius: 7, padding: '7px 10px', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <Icon name="info" size={12} color="#374151" style={{ marginTop: 1, flexShrink: 0 }} /> {selectedZone.custom_note}
                      </div>
                    )}
                  </div>
                )}
              </Field>
            )}

            <Field label="Preferred Pickup Date & Time" required>
              {(() => {
                const blockedSet = new Set(blockedDates.map(b => b.date));
                const minDate = getMinBookingDate(tenant?.booking_cutoff, blockedSet);
                const hasHours = !!(tenant?.store_open && tenant?.store_close);
                const allSlots = hasHours ? makeTimeSlots(tenant.store_open, tenant.store_close) : [];
                const availableSlots = form.pickup_date ? filterSlotsForDate(allSlots, form.pickup_date, tenant?.store_open) : allSlots;
                const isDateBlocked = d => blockedSet.has(d);

                return hasHours ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input style={INPUT} type="date"
                      value={form.pickup_date} min={minDate}
                      onChange={e => {
                        const d = e.target.value;
                        if (isDateBlocked(d)) return;
                        setForm(p => ({ ...p, pickup_date: d, pickup_time: '' }));
                      }}
                      onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                      onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
                    />
                    {form.pickup_date && (
                      <select style={INPUT} value={form.pickup_time}
                        onChange={e => setForm(p => ({ ...p, pickup_time: e.target.value }))}>
                        <option value="">— Select pickup time —</option>
                        {availableSlots.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                        {availableSlots.length === 0 && (
                          <option disabled>No slots available — please pick another date</option>
                        )}
                      </select>
                    )}
                    {tenant?.booking_cutoff && (
                      <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="clock" size={11} color="#374151" /> Same-day bookings close at {(() => {
                          const [h, m] = tenant.booking_cutoff.split(':').map(Number);
                          return `${h > 12 ? h-12 : h}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
                        })()}. Earliest available: {minDate}
                      </div>
                    )}
                    {blockedDates.length > 0 && (
                      <div style={{ fontSize: 11, color: '#A32D2D', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="slash" size={11} color="#A32D2D" /> Some dates are unavailable — blocked dates are not selectable.
                      </div>
                    )}
                  </div>
                ) : (
                  <input style={INPUT} type="datetime-local" value={form.pickup_date}
                    min={minDate + 'T00:00'}
                    onChange={e => setForm(p => ({ ...p, pickup_date: e.target.value }))}
                    onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                    onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
                  />
                );
              })()}
            </Field>

            <Field label="Special Instructions">
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: 70 }} value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes for us (fabric care, allergies, etc.)"
                onFocus={e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)'; }}
                onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
              />
            </Field>

            {/* Price summary */}
            <div style={{ background: '#F7F9FD', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              {cart.map((item, i) => (
                <div key={item._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2, marginTop: i > 0 ? 8 : 0 }}>
                    <span>{item.service_name}</span>
                    <span>₱{item.itemTotal.toLocaleString()}</span>
                  </div>
                  {item.displayLines.map((l, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', paddingLeft: 8, marginBottom: 1 }}>
                      <span>{l.label}</span>
                      <span>{l.price > 0 ? `₱${l.price.toLocaleString()}` : '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
              {deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                  <span style={{ color: '#374151' }}>Delivery{!bracketInfo && selectedZone ? ` — ${selectedZone.name}` : bracketDistKm ? ` (${bracketDistKm.toFixed(1)} km)` : ''}</span>
                  <span style={{ fontWeight: 600 }}>₱{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, color: '#7C3AED' }}>
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="tag" size={13} color="#7C3AED" /> Promo ({appliedPromo.code})</span>
                  <span style={{ fontWeight: 700 }}>−₱{promoDiscount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 8 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 700, color: '#38a9c2', fontSize: 16 }}>₱{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Promo code */}
            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Promo Code <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 11 }}>(optional)</span></label>
              {appliedPromo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#F5F3FF', border: '1.5px solid #C4B5FD' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#5B21B6', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="tag" size={13} color="#5B21B6" /> {appliedPromo.code} applied!</div>
                    <div style={{ fontSize: 12, color: '#7C3AED', marginTop: 1 }}>
                      {appliedPromo.discount_type === 'percent' ? `${appliedPromo.discount_value}% off` : `₱${Number(appliedPromo.discount_value).toLocaleString()} off`} · saving ₱{promoDiscount.toLocaleString()}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setAppliedPromo(null); setPromoInput(''); setPromoError(''); }}
                    style={{ fontSize: 12, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #C4B5FD', background: '#EDE9FE', color: '#5B21B6', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Remove
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...INPUT, flex: 1 }} value={promoInput} onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                    placeholder="Enter promo code"
                    onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,.15)'; }}
                    onBlur={e => { e.target.style.borderColor = '#B8C4CE'; e.target.style.boxShadow = 'none'; }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyPromo())}
                  />
                  <button type="button" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                    style={{ padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: promoInput.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: promoInput.trim() ? '#7C3AED' : '#E2E8F0', color: promoInput.trim() ? '#fff' : '#374151', whiteSpace: 'nowrap' }}>
                    {promoLoading ? '…' : 'Apply'}
                  </button>
                </div>
              )}
              {promoError && <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 5 }}>{promoError}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, padding: 13, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                ← Back
              </button>
              <button onClick={() => { setStep(3); if (serverCartId) updatePublicCart(tenantId, serverCartId, { step: 3 }).catch(() => {}); }} disabled={!step2Valid()}
                style={{ flex: 2, padding: 13, borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: step2Valid() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  background: step2Valid() ? '#38a9c2' : '#E2E8F0', color: step2Valid() ? '#fff' : '#374151', transition: 'all .15s' }}>
                Review Order →
              </button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 3 – REVIEW & CONFIRM ════════════ */}
        {step === 3 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Review Your Order</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Please confirm everything looks right.</div>

            <div style={{ background: '#F7F9FD', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a7d94', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Order Summary</div>

              {[
                ['Service', cart.map(i => i.service_name).join(', ')],
                ['Pickup', form.pickup_date ? (() => {
                  const dt = form.pickup_time ? new Date(`${form.pickup_date}T${form.pickup_time}`) : new Date(form.pickup_date);
                  return dt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
                })() : '—'],
                ['Address', selfPickup ? 'Self drop-off & pick-up at shop' : fullAddress],
                (!selfPickup && selectedZone) ? ['Delivery Zone', selectedZone.name] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #E8E8E0' }}>
                  <span style={{ color: '#374151', flexShrink: 0, marginRight: 12 }}>{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}

              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a7d94', marginTop: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Customer</div>
              {[
                ['Name', form.name],
                ['Phone', form.phone],
                form.email ? ['Email', form.email] : null,
                form.notes ? ['Notes', form.notes] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #E8E8E0' }}>
                  <span style={{ color: '#374151', flexShrink: 0, marginRight: 12 }}>{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}

              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a7d94', marginTop: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Services</div>
              {cart.map((item, i) => (
                <div key={item._id} style={{ marginBottom: i < cart.length - 1 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, fontWeight: 700 }}>
                    <span>{item.service_name}</span>
                    <span>₱{item.itemTotal.toLocaleString()}</span>
                  </div>
                  {item.displayLines.map((l, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0 2px 10px', fontSize: 12, color: '#374151' }}>
                      <span>{l.label}</span>
                      <span>{l.price > 0 ? `₱${l.price.toLocaleString()}` : '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
              {deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, marginTop: 4, borderTop: '1px solid #E8E8E0' }}>
                  <span style={{ color: '#374151' }}>Delivery{selectedZone?.name ? ` — ${selectedZone.name}` : bracketDistKm ? ` (${bracketDistKm.toFixed(1)} km)` : ''}</span>
                  <span style={{ fontWeight: 500 }}>₱{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: '#7C3AED', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="tag" size={13} color="#7C3AED" /> Promo ({appliedPromo.code})</span>
                  <span style={{ fontWeight: 700, color: '#7C3AED' }}>−₱{promoDiscount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '2px solid #E2E8F0', marginTop: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: '#38a9c2' }}>₱{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {submitErr && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>
                {submitErr}
              </div>
            )}

            {/* Privacy consent */}
            <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${privacyConsent ? '#38a9c2' : '#E2E8F0'}`, background: privacyConsent ? '#EBF8FA' : '#FAFAFA', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => setPrivacyConsent(p => !p)}>
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${privacyConsent ? '#38a9c2' : '#CBD5E0'}`, background: privacyConsent ? '#38a9c2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'all .15s' }}>
                {privacyConsent && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                I voluntarily give my consent to <strong>{tenant?.name}</strong> to keep and process the information, and to use it only to provide the service and to collect payment. I acknowledge and agree that in doing so, any such data may be processed through third-party data processors such as, but not limited to, service providers. I give my consent thereto pursuant to the requirements of Republic Act No. 10173, or the "Data Privacy Act of 2012."
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)}
                style={{ flex: 1, padding: 13, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting || !privacyConsent}
                style={{ flex: 2, padding: 13, borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: (submitting || !privacyConsent) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  background: submitting ? '#5a9ead' : !privacyConsent ? '#E2E8F0' : '#fdca00', color: (!privacyConsent || submitting) ? '#374151' : '#1F2937', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {submitting
                  ? <><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Placing Order…</>
                  : <><Icon name="checkCircle" size={15} color="#1F2937" style={{ marginRight: 6 }} /> Confirm & Place Order</>}
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#374151' }}>
        Powered by <strong>LaundroBot</strong>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { padding-bottom: env(safe-area-inset-bottom, 0); }
      `}</style>

      {/* Messenger Extensions SDK — enables requestCloseBrowser() inside Messenger webview */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(d, s, id) {
          var js, fjs = d.getElementsByTagName(s)[0];
          if (d.getElementById(id)) return;
          js = d.createElement(s); js.id = id;
          js.src = "//connect.facebook.net/en_US/messenger.Extensions.js";
          fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'messenger-extensions-jssdk'));
      `}} />
    </div>
  );
}
