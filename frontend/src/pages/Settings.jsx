import { useEffect, useState, useRef } from 'react';
import { getMyTenantSettings, updateMyTenantSettings, getBlockedDates, createBlockedDate, deleteBlockedDate, getPromoCodes, createPromoCode, togglePromoCode, deletePromoCode, resetMessengerMenu, getReferralLinks, getChannelSummary, createReferralLink, updateReferralLink, deleteReferralLink, createSubscriptionInvoice, getFacebookPages, connectFacebookPage, fetchInstagramAccount, exchangeFbOAuthCode, testFacebookConnection } from '../api.js';
import { useUpgrade } from '../context/UpgradeContext.jsx';
import { Icon } from '../components/Icons.jsx';

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
};
const TIME_INPUT = {
  ...INPUT, width: 'auto', minWidth: 130,
};
const FOCUS = e => { e.target.style.borderColor = '#38a9c2'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; };
const BLUR  = e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; };
const LABEL = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

function SectionCard({ icon, iconBg, title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function UpgradeCta({ title, desc, features }) {
  const { openUpgradeModal } = useUpgrade();
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 10, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{desc}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#047857', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>GROWTH</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {features.map(f => (
          <div key={f} style={{ fontSize: 11, color: '#374151', background: '#F3F4F6', borderRadius: 20, padding: '2px 9px' }}>✓ {f}</div>
        ))}
      </div>
      <button onClick={openUpgradeModal}
        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#047857', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
        View plans & upgrade →
      </button>
      <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'center' }}>₱1,666/month · 2 months free · Cancel anytime</div>
    </div>
  );
}

function GroupHeader({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 24 }}>
      <div style={{ flex: 1, height: 1, background: '#E8E8E0' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#E8E8E0' }} />
    </div>
  );
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

export default function Settings() {
  const [paymentMode,    setPaymentMode]    = useState('xendit');
  const [qrImageUrl,     setQrImageUrl]     = useState('');
  const [mayaQrUrl,      setMayaQrUrl]      = useState('');
  const [xenditKeySet,   setXenditKeySet]   = useState(false);
  const [xenditKeyHint,  setXenditKeyHint]  = useState('');
  const [xenditKeyInput, setXenditKeyInput] = useState('');
  const [xenditKeyEditing, setXenditKeyEditing] = useState(false);
  const [notifEmail,         setNotifEmail]         = useState('');
  const [contactNumber,      setContactNumber]      = useState('');
  const [googleReviewLink,   setGoogleReviewLink]   = useState('');
  const [reviewCooldownDays, setReviewCooldownDays] = useState('30');
  const [shopAddress,    setShopAddress]    = useState('');
  const [minimumOrder,   setMinimumOrder]   = useState('');
  const [aiEnabled,      setAiEnabled]      = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiPauseHours,   setAiPauseHours]   = useState('2');
  const [igUserId,       setIgUserId]       = useState('');
  const [storeOpen,      setStoreOpen]      = useState('');
  const [storeClose,     setStoreClose]     = useState('');
  const [bookingCutoff,  setBookingCutoff]  = useState('');
  const [openDays,       setOpenDays]       = useState([0,1,2,3,4,5,6]);
  const [fbPageId,       setFbPageId]       = useState('');
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState('');

  // Blocked dates
  const [blockedDates,   setBlockedDates]   = useState([]);
  const [addingDate,     setAddingDate]     = useState(false);
  const [newDate,        setNewDate]        = useState('');
  const [newReason,      setNewReason]      = useState('');
  const [savingDate,     setSavingDate]     = useState(false);
  const [dateErr,        setDateErr]        = useState('');

  // Promo codes
  const [promos,         setPromos]         = useState([]);
  const [addingPromo,    setAddingPromo]    = useState(false);
  const [promoForm,      setPromoForm]      = useState({ code: '', discount_type: 'fixed', discount_value: '', min_order: '', max_uses: '', expires_at: '' });
  const [savingPromo,    setSavingPromo]    = useState(false);
  const [promoErr,       setPromoErr]       = useState('');

  // Referral links
  const [referrals,      setReferrals]      = useState([]);
  const [addingRef,      setAddingRef]      = useState(false);
  const [refForm,        setRefForm]        = useState({ name: '', ref: '' });
  const [savingRef,      setSavingRef]      = useState(false);
  const [refErr,         setRefErr]         = useState('');
  const [editingRefId,   setEditingRefId]   = useState(null);
  const [editingRefName, setEditingRefName] = useState('');
  const [refreshingRef,  setRefreshingRef]  = useState(false);
  const [channelSummary, setChannelSummary] = useState([]);

  // Messenger menu reset
  const [resettingMenu,  setResettingMenu]  = useState(false);
  const [menuResetMsg,   setMenuResetMsg]   = useState('');

  // Instagram auto-connect
  const [igConnecting,   setIgConnecting]   = useState(false);
  const [igConnectMsg,   setIgConnectMsg]   = useState('');
  const [igSaving,       setIgSaving]       = useState(false);
  const [igSaved,        setIgSaved]        = useState(false);

  // Facebook OAuth connect flow
  const [fbPages,          setFbPages]          = useState([]);
  const [fbPageDataToken,  setFbPageDataToken]  = useState('');
  const [fbSelectedPageId, setFbSelectedPageId] = useState('');
  const [fbConnecting,     setFbConnecting]     = useState(false);
  const [fbSaving,         setFbSaving]         = useState(false);
  const [fbMsg,            setFbMsg]            = useState('');
  const [fbTesting,        setFbTesting]        = useState(false);
  const [fbTestResult,     setFbTestResult]     = useState(null);

  // Logo
  const [logoUrl,        setLogoUrl]        = useState('');
  const logoFileRef    = useRef();
  const qrFileRef      = useRef();
  const mayaQrFileRef  = useRef();

  // White-label / custom domain (Pro only)
  const [tenantPlan,        setTenantPlan]        = useState('starter');
  const [customDomain,      setCustomDomain]      = useState('');
  const [whiteLabel,        setWhiteLabel]        = useState(false);
  const { openUpgradeModal } = useUpgrade();

  useEffect(() => {
    // Core settings (carries the plan) must load independently. Secondary
    // calls (blocked dates, promos, referrals, channel summary) are allowed
    // to fail without blanking the whole page or hiding Pro features.
    getMyTenantSettings()
      .then(s => {
        setPaymentMode(s.data.payment_mode || 'xendit');
        setQrImageUrl(s.data.qr_image_url || '');
        setMayaQrUrl(s.data.maya_qr_url || '');
        setXenditKeySet(!!s.data.has_xendit_key);
        setXenditKeyHint(s.data.xendit_key_hint || '');
        setNotifEmail(s.data.notification_email || '');
        setContactNumber(s.data.contact_number || '');
        setGoogleReviewLink(s.data.google_review_link || '');
        setReviewCooldownDays(s.data.review_cooldown_days != null ? String(s.data.review_cooldown_days) : '30');
        setShopAddress(s.data.shop_address || '');
        setMinimumOrder(s.data.minimum_order != null ? String(s.data.minimum_order) : '');
        setAiEnabled(!!s.data.ai_enabled);
        setAiInstructions(s.data.ai_instructions || '');
        setAiPauseHours(s.data.ai_pause_hours != null ? String(s.data.ai_pause_hours) : '2');
        setIgUserId(s.data.ig_user_id || '');
        setStoreOpen(s.data.store_open || '');
        setStoreClose(s.data.store_close || '');
        setBookingCutoff(s.data.booking_cutoff || '');
        setOpenDays(Array.isArray(s.data.open_days) && s.data.open_days.length ? s.data.open_days.map(Number) : [0,1,2,3,4,5,6]);
        setFbPageId(s.data.fb_page_id || '');
        setLogoUrl(s.data.logo_url || '');
        setTenantPlan(s.data.plan || 'starter');
        setCustomDomain(s.data.custom_domain || '');
        setWhiteLabel(!!s.data.white_label);
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));

    // Secondary data — load independently, ignore individual failures
    getBlockedDates().then(b => setBlockedDates(b.data)).catch(() => {});
    getPromoCodes().then(p => setPromos(p.data)).catch(() => {});
    getReferralLinks().then(r => setReferrals(r.data)).catch(() => {});
    getChannelSummary().then(ch => setChannelSummary(ch.data)).catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      const { data } = await updateMyTenantSettings({
        notification_email: notifEmail,
        contact_number: contactNumber,
        shop_address: shopAddress,
        minimum_order: minimumOrder !== '' ? Number(minimumOrder) : null,
        store_open: storeOpen || null,
        store_close: storeClose || null,
        booking_cutoff: bookingCutoff || null,
        open_days: openDays,
        ai_enabled: aiEnabled,
        ai_instructions: aiInstructions,
        ai_pause_hours: aiPauseHours !== '' ? Number(aiPauseHours) : 2,
        qr_image_url: qrImageUrl || null,
        maya_qr_url: mayaQrUrl || null,
        payment_mode: paymentMode,
        custom_domain: customDomain || null,
        white_label: whiteLabel,
        logo_url: logoUrl || null,
        xendit_api_key: xenditKeyInput.trim() || undefined,
        google_review_link: googleReviewLink.trim() || null,
        review_cooldown_days: reviewCooldownDays !== '' ? Number(reviewCooldownDays) : null,
      });
      // Update key state from response
      setXenditKeySet(!!data.has_xendit_key);
      setXenditKeyHint(data.xendit_key_hint || '');
      setXenditKeyInput('');
      setXenditKeyEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDate() {
    if (!newDate) return setDateErr('Please select a date.');
    setSavingDate(true); setDateErr('');
    try {
      const { data } = await createBlockedDate({ date: newDate, reason: newReason });
      setBlockedDates(prev => {
        const filtered = prev.filter(b => b.date !== data.date);
        return [...filtered, data].sort((a, b) => a.date.localeCompare(b.date));
      });
      setNewDate(''); setNewReason(''); setAddingDate(false);
    } catch (err) {
      setDateErr(err.response?.data?.error || 'Failed to add date.');
    } finally {
      setSavingDate(false); }
  }

  async function handleDeleteDate(id) {
    try {
      await deleteBlockedDate(id);
      setBlockedDates(prev => prev.filter(b => b.id !== id));
    } catch { alert('Failed to remove blocked date.'); }
  }

  // Handle Facebook OAuth redirect return (code stored in sessionStorage by App.jsx Inner)
  useEffect(() => {
    const raw = sessionStorage.getItem('fb_oauth_pending');
    if (!raw) return;
    let pending;
    try { pending = JSON.parse(raw); } catch { sessionStorage.removeItem('fb_oauth_pending'); return; }
    sessionStorage.removeItem('fb_oauth_pending');
    // Expire after 5 minutes
    if (Date.now() - pending.ts > 5 * 60 * 1000) return;
    // Validate state — reject if storedState is missing
    const storedState = sessionStorage.getItem('fb_oauth_state');
    sessionStorage.removeItem('fb_oauth_state');
    if (!storedState || storedState !== pending.state) {
      setFbMsg('❌ OAuth state mismatch. Please reconnect.');
      return;
    }
    setFbConnecting(true);
    setFbMsg('');
    exchangeFbOAuthCode(pending.code, pending.redirectUri)
      .then(({ data }) => {
        setFbPages(data.pages);
        setFbPageDataToken(data.pageDataToken);
        if (data.pages.length === 1) setFbSelectedPageId(data.pages[0].id);
      })
      .catch(err => setFbMsg('❌ ' + (err.response?.data?.error || 'Failed to fetch your Pages.')))
      .finally(() => setFbConnecting(false));
  }, []);

  function handleFbLogin() {
    const appId = import.meta.env.VITE_FB_APP_ID;
    if (!appId) return setFbMsg('❌ Facebook App ID not configured — contact support.');
    const stateArray = new Uint8Array(16);
    crypto.getRandomValues(stateArray);
    const state = Array.from(stateArray).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('fb_oauth_state', state);
    const redirectUri = window.location.origin + '/settings';
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_show_list,pages_manage_metadata,pages_messaging,pages_utility_messaging,pages_read_engagement,business_management,instagram_basic,instagram_manage_messages&response_type=code&state=${state}`;
    window.location.href = url;
  }

  async function handleFbConnect() {
    if (!fbSelectedPageId) return;
    setFbSaving(true);
    setFbMsg('');
    try {
      const { data } = await connectFacebookPage(fbSelectedPageId, fbPageDataToken);
      setFbPageId(fbSelectedPageId);
      setFbMsg(`✅ Connected to "${data.pageName}" — Messenger menu configured!`);
      setFbPages([]);
      setFbPageDataToken('');
      setFbSelectedPageId('');
    } catch (err) {
      setFbMsg(err.response?.data?.error || 'Failed to connect page.');
    } finally {
      setFbSaving(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <>
    <div className="animate-fade-up">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Settings</h2>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Manage your shop preferences and customer-facing info.</p>
      </div>

      {loading ? (
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <form onSubmit={handleSave}>

            {/* ── SHOP IDENTITY ── */}
            <GroupHeader label="Shop Identity" />

            <SectionCard icon={<Icon name="image" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Business Logo"
              subtitle={tenantPlan === 'pro' ? 'Shown on invoices and your booking form' : 'Available on the Pro plan'}>
              {tenantPlan !== 'pro' ? (
                <div style={{ background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', borderRadius: 12, padding: '16px 18px', border: '1px solid #DDD6FE' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4C1D95', marginBottom: 3 }}>Upgrade to Pro</div>
                      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>Add your logo to invoices and the booking form for a more professional look.</div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#7C3AED', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>PRO</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {['Logo on booking form', 'Logo on invoices', 'Custom domain', 'White-label', 'Priority support'].map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #DDD6FE', borderRadius: 20, padding: '3px 10px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#4C1D95' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => openUpgradeModal()}
                    style={{ padding: '9px 20px', borderRadius: 20, background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    See plan details & upgrade →
                  </button>
                </div>
              ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div
                  onClick={() => logoFileRef.current.click()}
                  style={{ width: 80, height: 80, borderRadius: 12, border: '1.5px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#F9FAFB', flexShrink: 0 }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <div style={{ textAlign: 'center', color: '#6B7280', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><Icon name="camera" size={22} color="#6B7280" /><div style={{ fontSize: 10 }}>Upload</div></div>}
                </div>
                <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setLogoUrl(ev.target.result);
                    reader.readAsDataURL(file);
                  }} />
                <div>
                  <button type="button" onClick={() => logoFileRef.current.click()}
                    style={{ fontSize: 12, padding: '7px 16px', borderRadius: 7, border: '0.5px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6, display: 'block' }}>
                    {logoUrl ? 'Change logo' : 'Upload logo'}
                  </button>
                  {logoUrl && (
                    <button type="button" onClick={() => setLogoUrl('')}
                      style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      Remove
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>PNG or JPG, max 2MB</div>
                </div>
              </div>
              )}
            </SectionCard>

            <SectionCard icon={<Icon name="delivery" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Shop Address"
              subtitle="Shown on invoices sent to customers">
              <label style={LABEL}>Full Address</label>
              <input type="text" value={shopAddress} onChange={e => setShopAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Barangay, City, Province" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
            </SectionCard>

            <SectionCard icon={<Icon name="phone" size={18} color="#15803D" />} iconBg="#EAF3DE" title="Customer Contact Number"
              subtitle="Shown to customers after booking — for questions via SMS or call">
              <label style={LABEL}>Phone / Mobile Number</label>
              <input type="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                placeholder="e.g. 09XX XXX XXXX or +63 9XX XXX XXXX" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>Customers will see this on their order confirmation screen</div>
            </SectionCard>

            {/* ── BOOKING & OPERATIONS ── */}
            <GroupHeader label="Booking & Operations" />

            <SectionCard icon={<Icon name="clock" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Store Hours &amp; Booking Window"
              subtitle="Controls what times and days customers can select when placing a booking">
              {/* Open days */}
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Open Days</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, idx) => {
                    const isOn = openDays.includes(idx);
                    return (
                      <button key={idx} type="button"
                        onClick={() => setOpenDays(prev => isOn ? prev.filter(d => d !== idx) : [...prev, idx].sort((a,b) => a-b))}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          border: isOn ? 'none' : '1.5px solid #D1D5DB',
                          background: isOn ? '#38a9c2' : '#F9FAFB',
                          color: isOn ? '#fff' : '#6B7280',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                        }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
                {openDays.length === 0 && (
                  <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 5 }}>No open days selected — customers won't be able to book.</div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={LABEL}>Store Opens</label>
                  <input type="time" value={storeOpen} onChange={e => setStoreOpen(e.target.value)}
                    style={{ ...TIME_INPUT, width: '100%' }} onFocus={FOCUS} onBlur={BLUR} />
                </div>
                <div>
                  <label style={LABEL}>Store Closes</label>
                  <input type="time" value={storeClose} onChange={e => setStoreClose(e.target.value)}
                    style={{ ...TIME_INPUT, width: '100%' }} onFocus={FOCUS} onBlur={BLUR} />
                </div>
              </div>
              <div>
                <label style={LABEL}>Same-Day Booking Cutoff</label>
                <input type="time" value={bookingCutoff} onChange={e => setBookingCutoff(e.target.value)}
                  style={{ ...TIME_INPUT, width: '100%' }} onFocus={FOCUS} onBlur={BLUR} />
                <div style={{ fontSize: 11, color: '#374151', marginTop: 5, lineHeight: 1.5 }}>
                  After this time, today's slots are unavailable — customers will be directed to book the next available day.
                  {storeOpen && storeClose && bookingCutoff && (
                    <span style={{ display: 'block', marginTop: 4, color: '#1a7d94', fontWeight: 600 }}>
                      Example: booking open {storeOpen} – {bookingCutoff}, same-day cutoff at {bookingCutoff}, store closes at {storeClose}.
                    </span>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={<Icon name="walkin" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Minimum Order Amount"
              subtitle="Customers must reach this amount before they can proceed to checkout">
              <label style={LABEL}>Minimum Order (₱)</label>
              <input type="number" min="0" step="1" value={minimumOrder} onChange={e => setMinimumOrder(e.target.value)}
                placeholder="e.g. 200 — leave blank to disable" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>
                {minimumOrder ? `Customers need at least ₱${Number(minimumOrder).toLocaleString()} in their cart to check out.` : 'No minimum set — any order amount is accepted.'}
              </div>
            </SectionCard>

            {/* Blocked Dates — inside Booking & Operations section */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ban" size={18} color="#DC2626" /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Blocked Dates</div>
                    <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Dates unavailable for booking (holidays, closures, etc.)</div>
                  </div>
                </div>
                {!addingDate && (
                  <button type="button" onClick={() => { setAddingDate(true); setNewDate(''); setNewReason(''); setDateErr(''); }}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#38a9c2', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + Block Date
                  </button>
                )}
              </div>

              {addingDate && (
                <div style={{ background: '#F7F9FD', borderRadius: 10, padding: '14px', marginBottom: 14, border: '1px solid #9ed3dc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={LABEL}>Date to Block *</label>
                      <input type="date" value={newDate} min={today} onChange={e => setNewDate(e.target.value)}
                        style={{ ...INPUT }} onFocus={FOCUS} onBlur={BLUR} />
                    </div>
                    <div>
                      <label style={LABEL}>Reason <span style={{ fontWeight: 400, color: '#6B7280' }}>(optional)</span></label>
                      <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
                        placeholder="e.g. Holiday, Staff Day Off" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                    </div>
                  </div>
                  {dateErr && <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 8 }}>{dateErr}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={savingDate} onClick={handleAddDate}
                      style={{ padding: '7px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: savingDate ? '#aaa' : '#38a9c2', color: '#fff', cursor: 'pointer' }}>
                      {savingDate ? 'Saving…' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setAddingDate(false)}
                      style={{ padding: '7px 18px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {blockedDates.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>
                  No blocked dates. Add holidays or closure days here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blockedDates.map(b => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#FFF5F5', border: '0.5px solid #F09595' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="ban" size={13} color="#DC2626" />{formatDateDisplay(b.date)}</div>
                        {b.reason && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{b.reason}</div>}
                      </div>
                      <button type="button" onClick={() => handleDeleteDate(b.id)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── NOTIFICATIONS ── */}
            <GroupHeader label="Notifications" />

            <SectionCard icon={<Icon name="mail" size={18} color="#1a7d94" />} iconBg="#e6f5f8" title="Order Notifications"
              subtitle="Email you receive when new orders arrive and payments are confirmed">
              <label style={LABEL}>Notification Email</label>
              <input type="email" value={notifEmail} onChange={e => setNotifEmail(e.target.value)}
                placeholder="e.g. myshop@gmail.com" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="inbox" size={11} color="#374151" />New order alert · <Icon name="check-circle" size={11} color="#374151" />Payment confirmed alert</div>
            </SectionCard>

            <SectionCard icon={<Icon name="star" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Google Review Request"
              subtitle="Sent automatically via Messenger when an order is marked Completed">
              <label style={LABEL}>Google Review Link</label>
              <input type="url" value={googleReviewLink} onChange={e => setGoogleReviewLink(e.target.value)}
                placeholder="https://g.page/r/your-review-link/review" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <label style={{ ...LABEL, marginTop: 12 }}>Re-ask after (days)</label>
              <input type="number" min="1" max="365" value={reviewCooldownDays} onChange={e => setReviewCooldownDays(e.target.value)}
                placeholder="30" style={{ ...INPUT, width: 100 }} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>Leave blank to use 30-day default. Set "Has Reviewed" per customer to suppress permanently.</div>
            </SectionCard>

            {/* ── ONLINE PAYMENTS ── */}
            <GroupHeader label="Online Payments" />

            {/* Payment Mode + Xendit key + QR image — all in one card */}
            <SectionCard icon={<Icon name="card" size={18} color="#7C3AED" />} iconBg="#EDE9FE" title="Online Payment Method"
              subtitle="How customers pay when placing a booking online">
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[
                  { value: 'xendit', label: 'Xendit', desc: 'GCash, Maya, cards via Xendit — fully automated' },
                  { value: 'qr_static', label: 'QR Code', desc: 'Your own GCash/Maya QR — customer uploads screenshot' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPaymentMode(opt.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      border: `2px solid ${paymentMode === opt.value ? '#7C3AED' : '#E2E8F0'}`,
                      background: paymentMode === opt.value ? '#F5F3FF' : '#fff',
                      transition: 'all .15s' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: paymentMode === opt.value ? '#7C3AED' : '#111827', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {opt.value === 'xendit' ? <Icon name="card" size={13} color={paymentMode === opt.value ? '#7C3AED' : '#374151'} /> : <Icon name="qr-code" size={13} color={paymentMode === opt.value ? '#7C3AED' : '#374151'} />}
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {paymentMode === 'qr_static' && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 16 }}>
                  <Icon name="alert-triangle" size={13} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Payments are <strong>not automated</strong> — you'll confirm each payment manually in the Orders panel after the customer uploads their screenshot.</span>
                </div>
              )}

              {paymentMode === 'xendit' && (
                <div style={{ paddingBottom: 16, borderBottom: '0.5px solid #E8E8E0', marginBottom: 16 }}>
                  <label style={LABEL}>
                    Xendit Secret API Key
                    <a href="https://dashboard.xendit.co/settings/developers" target="_blank" rel="noreferrer"
                      style={{ marginLeft: 8, fontSize: 11, color: '#38a9c2', fontWeight: 400, textDecoration: 'none' }}>
                      Get from Xendit dashboard ↗
                    </a>
                  </label>

                  {xenditKeySet && !xenditKeyEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F9FAFB', fontSize: 13, color: '#374151', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        ••••••••••••••••  <span style={{ fontFamily: 'inherit', fontSize: 11, color: '#6B7280' }}>(Key configured)</span>
                      </div>
                      <button type="button" onClick={() => setXenditKeyEditing(true)}
                        style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        Replace key
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="password"
                        value={xenditKeyInput}
                        onChange={e => setXenditKeyInput(e.target.value)}
                        placeholder="xnd_production_..."
                        style={INPUT}
                        onFocus={FOCUS} onBlur={BLUR}
                        autoComplete="new-password"
                      />
                      <div style={{ fontSize: 11, color: '#374151', marginTop: 5, lineHeight: 1.5 }}>
                        Starts with <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 3 }}>xnd_production_</code>.
                        Found in Xendit Dashboard → Settings → Developers → API Keys.
                        The key is validated before saving.
                      </div>
                      {xenditKeySet && (
                        <button type="button" onClick={() => { setXenditKeyEditing(false); setXenditKeyInput(''); }}
                          style={{ marginTop: 6, fontSize: 11, color: '#374151', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit' }}>
                          Cancel — keep existing key
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* GCash QR Code */}
              <div style={{ paddingBottom: 16, borderBottom: '0.5px solid #E8E8E0', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                  {paymentMode === 'qr_static' ? 'Payment QR Code (GCash)' : 'Walk-in GCash QR'}
                </div>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                  {paymentMode === 'qr_static'
                    ? 'Shown to customers after online booking — they scan this to pay'
                    : 'GCash QR shown to walk-in customers at the POS payment step'}
                </div>
                <input ref={qrFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setQrImageUrl(ev.target.result);
                    reader.readAsDataURL(file);
                  }} />
                {qrImageUrl ? (
                  <div style={{ textAlign: 'center' }}>
                    <img src={qrImageUrl} alt="GCash QR preview"
                      style={{ maxWidth: 180, borderRadius: 10, border: '1px solid #E8E8E0', display: 'block', margin: '0 auto 10px' }} />
                    <button type="button" onClick={() => qrFileRef.current?.click()}
                      style={{ fontSize: 12, color: '#1a7d94', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      Replace image
                    </button>
                    <button type="button" onClick={() => setQrImageUrl('')}
                      style={{ fontSize: 12, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', marginLeft: 12 }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => qrFileRef.current?.click()}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px dashed #0062AD', background: '#EBF0FA', color: '#0062AD', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="camera" size={14} color="#0062AD" />Upload GCash QR Image
                  </button>
                )}
              </div>

              {/* Maya QR Code */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>Walk-in Maya QR</div>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                  Maya QR shown to walk-in customers when they choose Maya as payment method
                </div>
                <input ref={mayaQrFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setMayaQrUrl(ev.target.result);
                    reader.readAsDataURL(file);
                  }} />
                {mayaQrUrl ? (
                  <div style={{ textAlign: 'center' }}>
                    <img src={mayaQrUrl} alt="Maya QR preview"
                      style={{ maxWidth: 180, borderRadius: 10, border: '1px solid #E8E8E0', display: 'block', margin: '0 auto 10px' }} />
                    <button type="button" onClick={() => mayaQrFileRef.current?.click()}
                      style={{ fontSize: 12, color: '#1a7d94', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      Replace image
                    </button>
                    <button type="button" onClick={() => setMayaQrUrl('')}
                      style={{ fontSize: 12, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', marginLeft: 12 }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => mayaQrFileRef.current?.click()}
                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px dashed #00704A', background: '#E6F5EE', color: '#00704A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon name="camera" size={14} color="#00704A" />Upload Maya QR Image
                  </button>
                )}
              </div>
            </SectionCard>

            {/* ── AI & AUTOMATION ── */}
            <GroupHeader label="AI & Automation" />

            <SectionCard icon={<Icon name="services" size={18} color="#7C3AED" />} iconBg="#EDE9FE" title="AI Messenger Replies"
              subtitle="Gemini Flash answers customer questions outside the booking flow">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {aiEnabled ? 'AI replies are ON' : 'AI replies are OFF'}
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                    {aiEnabled
                      ? 'Gemini Flash handles questions about services, prices, and FAQs in any language.'
                      : 'Bot shows main menu for anything outside the booking flow.'}
                  </div>
                </div>
                <div onClick={() => setAiEnabled(p => !p)} style={{
                  width: 46, height: 26, borderRadius: 13, cursor: 'pointer', transition: 'background .2s',
                  background: aiEnabled ? '#38a9c2' : '#D1D5DB', position: 'relative', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: aiEnabled ? 23 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s',
                  }} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={LABEL}>AI Instructions <span style={{ color: '#7C3AED', fontSize: 10, fontWeight: 600, background: '#EDE9FE', padding: '1px 5px', borderRadius: 4, marginLeft: 5 }}>Pro</span></label>
                {tenantPlan === 'pro' ? (
                  <>
                    <textarea
                      value={aiInstructions}
                      onChange={e => setAiInstructions(e.target.value)}
                      rows={4}
                      placeholder={'e.g. Always reply in Tagalog.\nNever discuss competitor shops.\nAlways end with "Salamat sa inyong tiwala! 🙏"'}
                      style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }}
                      onFocus={FOCUS} onBlur={BLUR}
                    />
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>
                      These rules are followed on every AI reply — language, tone, what to avoid, how to sign off, etc.
                    </div>
                  </>
                ) : (
                  <div style={{ background: '#F5F3FF', border: '0.5px solid #DDD6FE', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#5B21B6' }}>
                    Custom AI instructions are available on the <strong>Pro plan</strong>. Upgrade to fine-tune the chatbot's language, tone, and behavior per branch.
                  </div>
                )}
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={LABEL}>AI Pause After Human Reply (hours)</label>
                <input type="number" min="0" max="24" step="1" value={aiPauseHours}
                  onChange={e => setAiPauseHours(e.target.value)}
                  style={{ ...INPUT, width: 100 }} onFocus={FOCUS} onBlur={BLUR} />
                <div style={{ fontSize: 11, color: '#374151', marginTop: 4, lineHeight: 1.5 }}>
                  When you manually reply to a customer, AI stays silent for this many hours. Set to 0 to disable the pause.
                </div>
              </div>
            </SectionCard>

            {/* ── ADVANCED ── */}
            <GroupHeader label="Advanced" />

            <SectionCard icon={<Icon name="globe" size={18} color="#7C3AED" />} iconBg="#EDE9FE" title="Custom Domain & White-Label"
              subtitle={tenantPlan === 'pro' ? 'Point your own domain to your booking form' : 'Available on the Pro plan'}>
              {tenantPlan !== 'pro' ? (
                <div style={{ background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', borderRadius: 12, padding: '16px 18px', border: '1px solid #DDD6FE' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4C1D95', marginBottom: 3 }}>Upgrade to Pro</div>
                      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>White-label booking form, custom domain, unlimited orders, and more.</div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#7C3AED', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>PRO</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {['Custom domain', 'White-label', 'Unlimited orders', '10 branches', 'Priority support'].map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #DDD6FE', borderRadius: 20, padding: '3px 10px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#4C1D95' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => openUpgradeModal()}
                    style={{ padding: '9px 20px', borderRadius: 20, background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    See plan details & upgrade →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={LABEL}>Custom domain</label>
                    <input value={customDomain} onChange={e => setCustomDomain(e.target.value.trim())}
                      placeholder="book.yourdomain.com" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
                      Step 1 — Add a CNAME record at your domain registrar:<br />
                      <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, display: 'inline-block', margin: '4px 0' }}>book.yourdomain.com → cname.vercel-dns.com</code><br />
                      Step 2 — Enter your domain above and save.<br />
                      Step 3 — Send your domain to <strong>hello@laundrobot.app</strong> so we can activate it (takes ~5 min).<br />
                      <span style={{ color: '#6B7280' }}>DNS propagation can take up to 24 hours.</span>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <div
                      onClick={() => setWhiteLabel(v => !v)}
                      style={{ width: 40, height: 22, borderRadius: 11, background: whiteLabel ? '#38a9c2' : '#D1D5DB', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 3, left: whiteLabel ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Remove "Powered by LaundroBot"</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Your customers won't see any LaundroBot branding on the booking form.</div>
                    </div>
                  </label>
                </div>
              )}
            </SectionCard>

            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>{error}</div>
            )}
            {saved && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, background: '#EAF7EC', color: '#1D6A3B', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="check-circle" size={14} color="#15803D" />Settings saved!</div>
            )}

            <button type="submit" disabled={saving}
              style={{ padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#7dd3e0' : '#38a9c2', color: '#fff', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>

          {/* ── MESSAGING SETUP ── */}
          <GroupHeader label="Messaging & Integrations" />

          {/* Facebook Page Connect */}
          <SectionCard icon={<Icon name="messenger" size={18} color="#1877F2" />} iconBg="#EBF3FD" title="Connect Facebook Page"
            subtitle="Link your Facebook Page so customers can order via Messenger">
            {fbMsg && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, fontSize: 13,
                background: fbMsg.startsWith('✅') ? '#EAF7EC' : '#FCEBEB',
                color: fbMsg.startsWith('✅') ? '#1D6A3B' : '#A32D2D' }}>
                {fbMsg}
              </div>
            )}

            {fbPageId && fbPages.length === 0 && !fbMsg.startsWith('✅') && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#EAF7EC', border: '0.5px solid #86EFAC' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <div style={{ fontSize: 13, color: '#15803D', flex: 1 }}>
                    <strong>Page connected</strong> — ID: <code style={{ background: '#D1FAE5', padding: '1px 5px', borderRadius: 4 }}>{fbPageId}</code>
                  </div>
                  <button type="button" disabled={fbTesting} onClick={async () => {
                    setFbTesting(true); setFbTestResult(null);
                    try {
                      const { data } = await testFacebookConnection();
                      setFbTestResult(data);
                    } catch { setFbTestResult({ connected: false, reason: 'request_failed' }); }
                    finally { setFbTesting(false); }
                  }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #86EFAC', background: '#fff', color: '#15803D', fontWeight: 600, fontSize: 12, cursor: fbTesting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {fbTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {fbTestResult && (
                  <div style={{ marginTop: 6, padding: '7px 12px', borderRadius: 6, fontSize: 12,
                    background: fbTestResult.connected ? '#EAF7EC' : '#FCEBEB',
                    color: fbTestResult.connected ? '#1D6A3B' : '#A32D2D',
                    border: `0.5px solid ${fbTestResult.connected ? '#86EFAC' : '#FCA5A5'}` }}>
                    {fbTestResult.connected
                      ? `✅ Token valid — connected as "${fbTestResult.page_name}"`
                      : fbTestResult.reason === 'no_token'
                        ? '❌ No page token saved — reconnect your Facebook Page below'
                        : `❌ Token invalid: ${fbTestResult.fb_error || 'Please reconnect your Facebook Page below'}`}
                  </div>
                )}
              </div>
            )}

            {fbPages.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Select the Page to connect:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fbPages.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${fbSelectedPageId === p.id ? '#1877F2' : '#E2E8F0'}`, background: fbSelectedPageId === p.id ? '#EBF3FD' : '#fff', cursor: 'pointer' }}>
                      <input type="radio" name="fbPage" value={p.id} checked={fbSelectedPageId === p.id}
                        onChange={() => setFbSelectedPageId(p.id)} style={{ accentColor: '#1877F2' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.name}</div>
                        {p.category && <div style={{ fontSize: 11, color: '#6B7280' }}>{p.category}</div>}
                      </div>
                    </label>
                  ))}
                </div>
                <button type="button" disabled={!fbSelectedPageId || fbSaving} onClick={handleFbConnect}
                  style={{ marginTop: 12, padding: '9px 22px', borderRadius: 8, border: 'none', background: fbSaving ? '#93C5FD' : '#1877F2', color: '#fff', fontWeight: 700, fontSize: 13, cursor: fbSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {fbSaving ? 'Connecting…' : 'Save & Connect Page'}
                </button>
              </div>
            )}

            {fbPages.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={fbConnecting} onClick={handleFbLogin}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none',
                    background: fbConnecting ? '#93C5FD' : '#1877F2',
                    color: '#fff', fontWeight: 700, fontSize: 13,
                    cursor: fbConnecting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  {fbConnecting ? 'Connecting…' : fbPageId ? 'Reconnect Facebook Page' : 'Connect Facebook Page'}
                </button>
                {!import.meta.env.VITE_FB_APP_ID && (
                  <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>VITE_FB_APP_ID is not set — contact support</div>
                )}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
              Requires <strong>pages_messaging</strong> &amp; <strong>pages_manage_metadata</strong> permissions — available once Meta App Review is approved.
              If the login fails, email <strong>hello@laundrobot.app</strong> and we'll connect your page manually.
            </div>
          </SectionCard>

          {/* Instagram Messaging */}
          <SectionCard icon={<Icon name="camera" size={18} color="#BE185D" />} iconBg="#FCE7F3" title="Instagram Messaging"
            subtitle="Let customers message you via Instagram Direct — same bot flow as Messenger">

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>
                If your Instagram Business account is linked to your connected Facebook Page, click below to detect it automatically.
              </div>
              <button type="button" disabled={igConnecting} onClick={async () => {
                setIgConnecting(true); setIgConnectMsg('');
                try {
                  const { data } = await fetchInstagramAccount();
                  setIgUserId(data.ig_user_id);
                  setIgConnectMsg('✅ Instagram account connected — ID: ' + data.ig_user_id);
                } catch (e) {
                  setIgConnectMsg('❌ ' + (e.response?.data?.error || 'Could not detect Instagram account.'));
                }
                setIgConnecting(false);
              }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: igConnecting ? '#F9A8D4' : '#DB2777', color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: igConnecting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                <Icon name="camera" size={15} color="#fff" />
                {igConnecting ? 'Detecting…' : igUserId ? 'Re-detect Instagram Account' : 'Connect Instagram Account'}
              </button>
              {igConnectMsg && (
                <div style={{ marginTop: 8, fontSize: 12, padding: '7px 10px', borderRadius: 7,
                  background: igConnectMsg.startsWith('✅') ? '#FCE7F3' : '#FCEBEB',
                  color: igConnectMsg.startsWith('✅') ? '#9D174D' : '#A32D2D' }}>
                  {igConnectMsg}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280' }}>
                Requires your Instagram Business account to be linked to your Facebook Page in Meta Business Suite.
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #F3F4F6', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Or enter ID manually
              </div>
            </div>

            <label style={LABEL}>Instagram Business User ID</label>
            <input value={igUserId} onChange={e => { setIgUserId(e.target.value); setIgSaved(false); }}
              placeholder="e.g. 17841400000000000"
              style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
            <div style={{ fontSize: 11, color: '#374151', marginTop: 5, marginBottom: 12, lineHeight: 1.5 }}>
              Auto-filled after clicking Connect above, or enter it manually. Leave blank to keep Instagram messaging disabled.
            </div>
            <button type="button" disabled={igSaving} onClick={async () => {
              setIgSaving(true); setIgSaved(false);
              try {
                await updateMyTenantSettings({ ig_user_id: igUserId });
                setIgSaved(true);
                setTimeout(() => setIgSaved(false), 3000);
              } catch (e) {
                setIgConnectMsg('❌ ' + (e.response?.data?.error || 'Failed to save.'));
              }
              setIgSaving(false);
            }}
              style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                background: igSaved ? '#D1FAE5' : igSaving ? '#7dd3e0' : '#38a9c2',
                color: igSaved ? '#065F46' : '#fff', cursor: igSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {igSaved ? '✅ Saved' : igSaving ? 'Saving…' : 'Save Instagram ID'}
            </button>
          </SectionCard>

          {/* Messenger Menu */}
          <SectionCard icon={<Icon name="messenger" size={18} color="#0369A1" />} iconBg="#E0F2FE" title="Facebook Messenger Menu"
            subtitle="Reset the persistent menu shown to all customers in Messenger">
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.6 }}>
              If customers are still seeing an old menu from a previous chatbot (e.g. Chatgenie), click below to override it with your current menu.
            </div>
            {menuResetMsg && (
              <div style={{ marginBottom: 10, padding: '7px 12px', borderRadius: 7, fontSize: 13,
                background: menuResetMsg.startsWith('✅') ? '#EAF7EC' : '#FCEBEB',
                color: menuResetMsg.startsWith('✅') ? '#1D6A3B' : '#A32D2D' }}>
                {menuResetMsg}
              </div>
            )}
            <button type="button" disabled={resettingMenu} onClick={async () => {
              setResettingMenu(true); setMenuResetMsg('');
              try {
                const { data } = await resetMessengerMenu();
                const parts = [];
                if (data.fbError) parts.push(`Messenger: ${data.fbError}`);
                if (data.igError) parts.push(`Instagram: ${data.igError}`);
                if (parts.length) {
                  setMenuResetMsg('⚠️ ' + parts.join(' | '));
                } else {
                  setMenuResetMsg('✅ Messenger & Instagram menu reset successfully!');
                }
              } catch (err) {
                setMenuResetMsg('❌ ' + (err.response?.data?.error || 'Failed to reset menu.'));
              } finally { setResettingMenu(false); }
            }} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              cursor: resettingMenu ? 'not-allowed' : 'pointer',
              background: resettingMenu ? '#7dd3e0' : '#0ea5e9', color: '#fff', fontFamily: 'inherit' }}>
              {resettingMenu ? 'Resetting…' : 'Reset Messenger Menu'}
            </button>

            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0369A1', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="info" size={13} color="#0369A1" />How it works for customers</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
                <div>• The menu does <strong>not</strong> pop up automatically — customers tap the <strong>☰ icon</strong> at the bottom-left of the chat to open it.</div>
                <div>• The <strong>greeting message</strong> and <strong>Get Started</strong> button only appear for customers who have <strong>never messaged your page before</strong>.</div>
                <div>• To share your Messenger link with customers, use: <strong>m.me/YourPageName</strong></div>
              </div>
            </div>
          </SectionCard>

          {/* ── MARKETING ── */}
          <GroupHeader label="Marketing" />

          {/* Promo Codes */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ticket" size={18} color="#7C3AED" /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Promo Codes</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Discount codes customers can apply at checkout</div>
                </div>
              </div>
              {!['growth', 'pro'].includes(tenantPlan)
                ? <span style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 4 }}>GROWTH+</span>
                : !addingPromo && (
                  <button type="button" onClick={() => { setAddingPromo(true); setPromoForm({ code: '', discount_type: 'fixed', discount_value: '', min_order: '', max_uses: '', expires_at: '' }); setPromoErr(''); }}
                    style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + Add Promo
                  </button>
                )
              }
            </div>

            {!['growth', 'pro'].includes(tenantPlan) ? (
              <UpgradeCta
                title="Promo codes"
                desc="Offer discounts and run promotions — fixed amount or percentage off, with min order and expiry date."
                features={['Fixed & percentage discounts', 'Min order threshold', 'Usage limits & expiry', 'Active/inactive toggle']}
              />
            ) : <>
            {addingPromo && (
              <form onSubmit={async e => {
                e.preventDefault();
                setSavingPromo(true); setPromoErr('');
                try {
                  const { data } = await createPromoCode(promoForm);
                  setPromos(prev => [data, ...prev]);
                  setAddingPromo(false);
                } catch (err) {
                  setPromoErr(err.response?.data?.error || 'Failed to create promo code.');
                } finally { setSavingPromo(false); }
              }} style={{ background: '#F7F5FF', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #C4B5FD' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL}>Code *</label>
                    <input type="text" value={promoForm.code} onChange={e => setPromoForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. SAVE50" style={INPUT} onFocus={FOCUS} onBlur={BLUR} required />
                  </div>
                  <div>
                    <label style={LABEL}>Discount Type *</label>
                    <select value={promoForm.discount_type} onChange={e => setPromoForm(p => ({ ...p, discount_type: e.target.value }))}
                      style={INPUT} onFocus={FOCUS} onBlur={BLUR}>
                      <option value="fixed">Fixed Amount (₱)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Discount Value * {promoForm.discount_type === 'percent' ? '(%)' : '(₱)'}</label>
                    <input type="number" min="0.01" step="0.01" value={promoForm.discount_value}
                      onChange={e => setPromoForm(p => ({ ...p, discount_value: e.target.value }))}
                      placeholder={promoForm.discount_type === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                      style={INPUT} onFocus={FOCUS} onBlur={BLUR} required />
                  </div>
                  <div>
                    <label style={LABEL}>Min. Order (₱) <span style={{ fontWeight: 400, color: '#6B7280' }}>(optional)</span></label>
                    <input type="number" min="0" step="1" value={promoForm.min_order}
                      onChange={e => setPromoForm(p => ({ ...p, min_order: e.target.value }))}
                      placeholder="e.g. 300" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                  <div>
                    <label style={LABEL}>Max Uses <span style={{ fontWeight: 400, color: '#6B7280' }}>(optional, blank = unlimited)</span></label>
                    <input type="number" min="1" step="1" value={promoForm.max_uses}
                      onChange={e => setPromoForm(p => ({ ...p, max_uses: e.target.value }))}
                      placeholder="e.g. 100" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                  <div>
                    <label style={LABEL}>Expires On <span style={{ fontWeight: 400, color: '#6B7280' }}>(optional)</span></label>
                    <input type="date" value={promoForm.expires_at}
                      onChange={e => setPromoForm(p => ({ ...p, expires_at: e.target.value }))}
                      style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                </div>
                {promoErr && <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 8 }}>{promoErr}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={savingPromo}
                    style={{ padding: '7px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: savingPromo ? '#aaa' : '#7C3AED', color: '#fff', cursor: 'pointer' }}>
                    {savingPromo ? 'Saving…' : 'Create'}
                  </button>
                  <button type="button" onClick={() => setAddingPromo(false)}
                    style={{ padding: '7px 18px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {promos.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>
                No promo codes yet. Create one to offer discounts to customers.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {promos.map(p => {
                  const expired = p.expires_at && new Date(p.expires_at) < new Date();
                  const maxed = p.max_uses !== null && p.uses_count >= p.max_uses;
                  const inactive = !p.active || expired || maxed;
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: inactive ? '#F9FAFB' : '#F5F3FF', border: `0.5px solid ${inactive ? '#E2E8F0' : '#C4B5FD'}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: inactive ? '#6B7280' : '#5B21B6', letterSpacing: '.05em' }}>{p.code}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: inactive ? '#E2E8F0' : '#EDE9FE', color: inactive ? '#6B7280' : '#7C3AED' }}>
                            {p.discount_type === 'percent' ? `${p.discount_value}% off` : `₱${Number(p.discount_value).toLocaleString()} off`}
                          </span>
                          {inactive && <span style={{ fontSize: 11, color: '#A32D2D', fontWeight: 600 }}>{!p.active ? 'Disabled' : expired ? 'Expired' : 'Limit reached'}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>
                          {p.min_order ? `Min. ₱${Number(p.min_order).toLocaleString()} · ` : ''}
                          {p.max_uses ? `${p.uses_count}/${p.max_uses} uses` : `${p.uses_count} uses`}
                          {p.expires_at ? ` · Expires ${p.expires_at}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                        <button type="button"
                          onClick={async () => {
                            try {
                              const { data } = await togglePromoCode(p.id, !p.active);
                              setPromos(prev => prev.map(x => x.id === p.id ? data : x));
                            } catch { alert('Failed to update promo.'); }
                          }}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `0.5px solid ${p.active ? '#C4B5FD' : '#E2E8F0'}`, background: p.active ? '#EDE9FE' : '#F3F4F6', color: p.active ? '#5B21B6' : '#374151', cursor: 'pointer' }}>
                          {p.active ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button"
                          onClick={async () => {
                            if (!confirm(`Delete promo code "${p.code}"?`)) return;
                            try {
                              await deletePromoCode(p.id);
                              setPromos(prev => prev.filter(x => x.id !== p.id));
                            } catch { alert('Failed to delete promo.'); }
                          }}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </>}
          </div>

          {/* Referral Links */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="link" size={18} color="#0369A1" /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Referral Links</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>Track which marketing channels drive clicks and bookings.</div>
                </div>
              </div>
              {!['growth', 'pro'].includes(tenantPlan)
                ? <span style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 4 }}>GROWTH+</span>
                : !addingRef && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={refreshingRef}
                      onClick={async () => {
                        setRefreshingRef(true);
                        try {
                          const [{ data: links }, { data: ch }] = await Promise.all([getReferralLinks(), getChannelSummary()]);
                          setReferrals(links);
                          setChannelSummary(ch);
                        } catch { alert('Failed to refresh. Please try again.'); }
                        finally { setRefreshingRef(false); }
                      }}
                      style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#F9FAFB', color: refreshingRef ? '#6B7280' : '#374151', cursor: refreshingRef ? 'not-allowed' : 'pointer', minWidth: 80 }}>
                      {refreshingRef ? 'Refreshing…' : '↻ Refresh'}
                    </button>
                    <button type="button" onClick={() => { setAddingRef(true); setRefForm({ name: '', ref: '' }); setRefErr(''); }}
                      style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#0369A1', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      + Add Link
                    </button>
                  </div>
                )
              }
            </div>

            {!['growth', 'pro'].includes(tenantPlan) ? (
              <UpgradeCta
                title="Referral links"
                desc="Create trackable links for Facebook posts, flyers, or influencers — see clicks and bookings per source."
                features={['Unique link per channel', 'Click & booking tracking', 'Revenue attribution', 'Unlimited links']}
              />
            ) : <>

            {/* Channel breakdown — all orders by booking source */}
            {channelSummary.length > 0 && (() => {
              const CHANNEL_LABEL = { web: '🌐 Web Booking', messenger: '💬 Messenger', walk_in: '🚶 Walk-in', admin: '🛠 Admin / Manual', instagram: '📸 Instagram' };
              const totalOrders  = channelSummary.reduce((s, c) => s + Number(c.order_count), 0);
              const totalRevenue = channelSummary.reduce((s, c) => s + Number(c.revenue), 0);
              return (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>All Orders by Channel</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {channelSummary.map(c => {
                      const pct = totalRevenue > 0 ? ((Number(c.revenue) / totalRevenue) * 100).toFixed(0) : 0;
                      return (
                        <div key={c.source} style={{ flex: '1 1 140px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{CHANNEL_LABEL[c.source] || c.source}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{c.order_count}</div>
                          <div style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>₱{Number(c.revenue).toLocaleString('en-PH')}</div>
                          <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: '#E5E7EB' }}>
                            <div style={{ height: 4, borderRadius: 4, background: '#38a9c2', width: `${pct}%` }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>{pct}% of revenue</div>
                        </div>
                      );
                    })}
                    <div style={{ flex: '1 1 140px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>📊 Total</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{totalOrders}</div>
                      <div style={{ fontSize: 12, color: '#047857', fontWeight: 600 }}>₱{totalRevenue.toLocaleString('en-PH')}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {addingRef && (
              <form onSubmit={async e => {
                e.preventDefault(); setSavingRef(true); setRefErr('');
                try {
                  await createReferralLink(refForm);
                  const { data: fresh } = await getReferralLinks();
                  setReferrals(fresh);
                  setAddingRef(false);
                } catch (err) { setRefErr(err.response?.data?.error || 'Failed to create link'); }
                finally { setSavingRef(false); }
              }} style={{ background: '#F9FAFB', borderRadius: 10, padding: '16px 18px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 160 }}>
                <label style={LABEL}>Link Name</label>
                <input style={INPUT} placeholder="e.g. Facebook Ads March" value={refForm.name}
                  onChange={e => setRefForm(p => ({ ...p, name: e.target.value }))} onFocus={FOCUS} onBlur={BLUR} required />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={LABEL}>Ref Code</label>
                <input style={INPUT} placeholder="e.g. FB_ADS_MARCH" value={refForm.ref}
                  onChange={e => setRefForm(p => ({ ...p, ref: e.target.value }))} onFocus={FOCUS} onBlur={BLUR} required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={savingRef}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#38a9c2', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {savingRef ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setAddingRef(false)}
                  style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
              {refErr && <div style={{ width: '100%', fontSize: 12, color: '#ef4444' }}>{refErr}</div>}
            </form>
            )}

            {referrals.length === 0 && !addingRef ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#6B7280', fontSize: 14 }}>
                No referral links yet. Add one to start tracking.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #F3F4F6' }}>
                      {['Name', 'Ref Code', 'm.me Link', 'Clicks', 'Orders', 'Revenue', 'Conv %', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map(r => {
                      const conv = r.click_count > 0 ? ((Number(r.order_count) / r.click_count) * 100).toFixed(1) : '—';
                      const link = fbPageId ? `https://m.me/${fbPageId}?ref=${r.ref}` : `https://m.me/me?ref=${r.ref}`;
                      const isEditing = editingRefId === r.id;
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                          <td style={{ padding: '10px 10px', fontWeight: 600, color: '#111827' }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editingRefName}
                                onChange={e => setEditingRefName(e.target.value)}
                                onKeyDown={async e => {
                                  if (e.key === 'Escape') { setEditingRefId(null); return; }
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (!editingRefName.trim()) return;
                                    try {
                                      const { data } = await updateReferralLink(r.id, { name: editingRefName.trim() });
                                      setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, name: data.name } : x));
                                      setEditingRefId(null);
                                    } catch { alert('Failed to rename.'); }
                                  }
                                }}
                                style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1.5px solid #38a9c2', outline: 'none', width: '100%', minWidth: 120 }}
                              />
                            ) : r.name}
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <span style={{ fontFamily: 'monospace', background: '#F3F4F6', padding: '2px 7px', borderRadius: 4, fontSize: 12 }}>{r.ref}</span>
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <button type="button" onClick={() => { navigator.clipboard.writeText(link); }}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #E2E8F0', background: '#F9FAFB', color: '#374151', cursor: 'pointer' }}>
                              Copy Link
                            </button>
                          </td>
                          <td style={{ padding: '10px 10px', color: '#374151' }}>{r.click_count}</td>
                          <td style={{ padding: '10px 10px', color: '#047857', fontWeight: 600 }}>{r.order_count}</td>
                          <td style={{ padding: '10px 10px', color: '#047857', fontWeight: 600 }}>₱{Number(r.revenue).toLocaleString('en-PH')}</td>
                          <td style={{ padding: '10px 10px', color: conv !== '—' && Number(conv) >= 20 ? '#047857' : '#374151', fontWeight: 600 }}>{conv !== '—' ? `${conv}%` : '—'}</td>
                          <td style={{ padding: '10px 10px', display: 'flex', gap: 6 }}>
                            {isEditing ? (
                              <>
                                <button type="button"
                                  onClick={async () => {
                                    if (!editingRefName.trim()) return;
                                    try {
                                      const { data } = await updateReferralLink(r.id, { name: editingRefName.trim() });
                                      setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, name: data.name } : x));
                                      setEditingRefId(null);
                                    } catch { alert('Failed to rename.'); }
                                  }}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', background: '#38a9c2', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                                  Save
                                </button>
                                <button type="button" onClick={() => setEditingRefId(null)}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #E2E8F0', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button"
                                  onClick={() => { setEditingRefId(r.id); setEditingRefName(r.name); }}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #E2E8F0', background: '#F9FAFB', color: '#374151', cursor: 'pointer' }}>
                                  Rename
                                </button>
                                <button type="button"
                                  onClick={async () => {
                                    if (!confirm(`Delete referral link "${r.name}"?`)) return;
                                    try { await deleteReferralLink(r.id); setReferrals(prev => prev.filter(x => x.id !== r.id)); }
                                    catch { alert('Failed to delete.'); }
                                  }}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </>}
          </div>

        </div>
      )}
    </div>
    </>
  );
}
