import { useEffect, useState, useRef } from 'react';
import { getMyTenantSettings, updateMyTenantSettings, getBlockedDates, createBlockedDate, deleteBlockedDate, getPromoCodes, createPromoCode, togglePromoCode, deletePromoCode, resetMessengerMenu, getReferralLinks, createReferralLink, deleteReferralLink, createSubscriptionInvoice, getFacebookPages, connectFacebookPage } from '../api.js';
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

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

export default function Settings() {
  const [qrImageUrl,     setQrImageUrl]     = useState('');
  const [notifEmail,     setNotifEmail]     = useState('');
  const [contactNumber,  setContactNumber]  = useState('');
  const [shopAddress,    setShopAddress]    = useState('');
  const [minimumOrder,   setMinimumOrder]   = useState('');
  const [aiEnabled,      setAiEnabled]      = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiPauseHours,   setAiPauseHours]   = useState('2');
  const [igUserId,       setIgUserId]       = useState('');
  const [storeOpen,      setStoreOpen]      = useState('');
  const [storeClose,     setStoreClose]     = useState('');
  const [bookingCutoff,  setBookingCutoff]  = useState('');
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

  // Messenger menu reset
  const [resettingMenu,  setResettingMenu]  = useState(false);
  const [menuResetMsg,   setMenuResetMsg]   = useState('');

  // Facebook OAuth connect flow
  const [fbPages,          setFbPages]          = useState([]);
  const [fbPageDataToken,  setFbPageDataToken]  = useState('');
  const [fbSelectedPageId, setFbSelectedPageId] = useState('');
  const [fbConnecting,     setFbConnecting]     = useState(false);
  const [fbSaving,         setFbSaving]         = useState(false);
  const [fbMsg,            setFbMsg]            = useState('');
  const [fbSdkReady,       setFbSdkReady]       = useState(false);

  // Logo
  const [logoUrl,        setLogoUrl]        = useState('');
  const logoFileRef = useRef();

  // White-label / custom domain (Pro only)
  const [tenantPlan,        setTenantPlan]        = useState('starter');
  const [customDomain,      setCustomDomain]      = useState('');
  const [whiteLabel,        setWhiteLabel]        = useState(false);
  const [upgradingPro,      setUpgradingPro]      = useState(false);
  const [showUpgradeModal,  setShowUpgradeModal]  = useState(false);
  const [upgradeAnnual,     setUpgradeAnnual]     = useState(false);

  useEffect(() => {
    Promise.all([
      getMyTenantSettings(),
      getBlockedDates(),
      getPromoCodes(),
      getReferralLinks(),
    ]).then(([s, b, p, r]) => {
      setQrImageUrl(s.data.qr_image_url || '');
      setNotifEmail(s.data.notification_email || '');
      setContactNumber(s.data.contact_number || '');
      setShopAddress(s.data.shop_address || '');
      setMinimumOrder(s.data.minimum_order != null ? String(s.data.minimum_order) : '');
      setAiEnabled(!!s.data.ai_enabled);
      setAiInstructions(s.data.ai_instructions || '');
      setAiPauseHours(s.data.ai_pause_hours != null ? String(s.data.ai_pause_hours) : '2');
      setIgUserId(s.data.ig_user_id || '');
      setStoreOpen(s.data.store_open || '');
      setStoreClose(s.data.store_close || '');
      setBookingCutoff(s.data.booking_cutoff || '');
      setFbPageId(s.data.fb_page_id || '');
      setLogoUrl(s.data.logo_url || '');
      setTenantPlan(s.data.plan || 'starter');
      setCustomDomain(s.data.custom_domain || '');
      setWhiteLabel(!!s.data.white_label);
      setBlockedDates(b.data);
      setPromos(p.data);
      setReferrals(r.data);
    }).catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await updateMyTenantSettings({
        notification_email: notifEmail,
        contact_number: contactNumber,
        shop_address: shopAddress,
        minimum_order: minimumOrder !== '' ? Number(minimumOrder) : null,
        store_open: storeOpen || null,
        store_close: storeClose || null,
        booking_cutoff: bookingCutoff || null,
        ai_enabled: aiEnabled,
        ai_instructions: aiInstructions,
        ai_pause_hours: aiPauseHours !== '' ? Number(aiPauseHours) : 2,
        ig_user_id: igUserId,
        qr_image_url: qrImageUrl || null,
        custom_domain: customDomain || null,
        white_label: whiteLabel,
        logo_url: logoUrl || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDate(e) {
    e.preventDefault();
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

  // Load Facebook JS SDK once on mount
  useEffect(() => {
    const appId = import.meta.env.VITE_FB_APP_ID;
    if (!appId) return;
    window.fbAsyncInit = () => {
      window.FB.init({ appId, version: 'v19.0', cookie: true, xfbml: false });
      setFbSdkReady(true);
    };
    if (!document.getElementById('fb-sdk')) {
      const s = document.createElement('script');
      s.id = 'fb-sdk';
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    } else if (window.FB) {
      setFbSdkReady(true);
    }
  }, []);

  function handleFbLogin() {
    if (!window.FB) return setFbMsg('Facebook SDK not loaded yet — please refresh and try again.');
    setFbConnecting(true);
    setFbMsg('');
    setFbPages([]);
    window.FB.login(async response => {
      if (response.authResponse) {
        try {
          const { data } = await getFacebookPages(response.authResponse.accessToken);
          setFbPages(data.pages);
          setFbPageDataToken(data.pageDataToken);
          if (data.pages.length === 1) setFbSelectedPageId(data.pages[0].id);
        } catch (err) {
          setFbMsg(err.response?.data?.error || 'Failed to fetch your Pages.');
        }
      } else {
        setFbMsg('Facebook login was cancelled.');
      }
      setFbConnecting(false);
    }, { scope: 'pages_manage_metadata,pages_messaging,pages_read_engagement' });
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

  const PRO_FEATURES = [
    { label: 'Everything in Starter', sub: 'All your current features carry over' },
    { label: 'Up to 10 branches · 10 staff accounts', sub: 'Scale across all your locations' },
    { label: 'White-label booking form', sub: 'Remove all LaundroBot branding' },
    { label: 'Custom domain', sub: 'Host at book.yourdomain.com' },
    { label: 'Custom AI instructions per branch', sub: 'Fine-tune the chatbot per location' },
    { label: 'Unlimited orders', sub: 'No monthly order cap' },
    { label: 'Priority support + dedicated onboarding', sub: 'Direct line, faster response' },
  ];

  return (
    <>
    {showUpgradeModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        onClick={e => { if (e.target === e.currentTarget) setShowUpgradeModal(false); }}>
        <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden' }}>
          {/* Modal header */}
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', padding: '1.75rem 1.5rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.2)', borderRadius: 20, padding: '3px 12px', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.06em' }}>PRO PLAN</span>
                </div>
                {/* Billing toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {[{ label: 'Monthly', val: false }, { label: 'Annual', val: true }].map(opt => (
                    <button key={opt.label} onClick={() => setUpgradeAnnual(opt.val)}
                      style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: upgradeAnnual === opt.val ? '#fff' : 'rgba(255,255,255,.2)', color: upgradeAnnual === opt.val ? '#7C3AED' : '#fff', transition: 'all .15s' }}>
                      {opt.label}
                      {opt.val && <span style={{ marginLeft: 5, background: '#fdca00', color: '#7a5800', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20 }}>SAVE 17%</span>}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)', alignSelf: 'flex-start', marginTop: 6 }}>₱</span>
                  <span style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-.04em', lineHeight: 1 }}>
                    {upgradeAnnual ? '4,583' : '5,499'}
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>/month</span>
                </div>
                {upgradeAnnual && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>Billed ₱54,990/year · 2 months free</div>
                )}
              </div>
              <button onClick={() => setShowUpgradeModal(false)}
                style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ×
              </button>
            </div>
          </div>

          {/* Features list */}
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>What you get</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PRO_FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F5F3FF', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button disabled={upgradingPro}
              onClick={async () => {
                setUpgradingPro(true);
                try {
                  const plan = upgradeAnnual ? 'pro_annual' : 'pro_monthly';
                  const { data } = await createSubscriptionInvoice(plan);
                  window.open(data.invoiceUrl, '_blank');
                  setShowUpgradeModal(false);
                } catch { alert('Could not open payment page. Please try again.'); }
                finally { setUpgradingPro(false); }
              }}
              style={{ width: '100%', padding: '13px', borderRadius: 12, background: '#7C3AED', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: upgradingPro ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              {upgradingPro
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} />Opening payment…</>
                : `Upgrade to Pro — ₱${upgradeAnnual ? '54,990/year' : '5,499/mo'} →`}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', margin: 0 }}>
              Secure payment via Xendit · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    )}
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

            {/* Notification Email */}
            <SectionCard icon={<Icon name="image" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Business Logo"
              subtitle="Used on invoices and the booking form">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {/* Preview */}
                <div
                  onClick={() => logoFileRef.current.click()}
                  style={{ width: 80, height: 80, borderRadius: 12, border: '1.5px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#F9FAFB', flexShrink: 0 }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <div style={{ textAlign: 'center', color: '#9CA3AF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><Icon name="camera" size={22} color="#9CA3AF" /><div style={{ fontSize: 10 }}>Upload</div></div>}
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
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>PNG or JPG, max 2MB</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={<Icon name="mail" size={18} color="#1a7d94" />} iconBg="#e6f5f8" title="Order Notifications"
              subtitle="Email you receive when new orders arrive and payments are confirmed">
              <label style={LABEL}>Notification Email</label>
              <input type="email" value={notifEmail} onChange={e => setNotifEmail(e.target.value)}
                placeholder="e.g. myshop@gmail.com" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>📦 New order alert · 💰 Payment confirmed alert</div>
            </SectionCard>

            {/* AI Messenger Replies */}
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
              {aiEnabled && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280', background: '#F3F4F6', borderRadius: 6, padding: '7px 10px' }}>
                  Requires <strong>GEMINI_API_KEY</strong> env var on your server. Free tier: 1,500 requests/day.
                </div>
              )}
            </SectionCard>

            {/* Instagram Messaging */}
            <SectionCard icon={<Icon name="camera" size={18} color="#BE185D" />} iconBg="#FCE7F3" title="Instagram Messaging"
              subtitle="Let customers message you via Instagram Direct — same bot flow as Messenger">
              <label style={LABEL}>Instagram Business User ID</label>
              <input value={igUserId} onChange={e => setIgUserId(e.target.value)}
                placeholder="e.g. 17841400000000000"
                style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5, lineHeight: 1.5 }}>
                Found in Meta Business Suite → Settings → Instagram Account → Account ID.
                Leave blank to keep Instagram messaging disabled.
              </div>
            </SectionCard>

            {/* Customer Contact Number */}
            <SectionCard icon={<Icon name="phone" size={18} color="#15803D" />} iconBg="#EAF3DE" title="Customer Contact Number"
              subtitle="Shown to customers after booking — for questions via SMS or call">
              <label style={LABEL}>Phone / Mobile Number</label>
              <input type="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                placeholder="e.g. 09XX XXX XXXX or +63 9XX XXX XXXX" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>Customers will see this on their order confirmation screen</div>
            </SectionCard>

            {/* Shop Address */}
            <SectionCard icon={<Icon name="delivery" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Shop Address"
              subtitle="Shown on invoices sent to customers">
              <label style={LABEL}>Full Address</label>
              <input type="text" value={shopAddress} onChange={e => setShopAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Barangay, City, Province" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
            </SectionCard>

            {/* Walk-in QR */}
            <SectionCard icon={<Icon name="smartphone" size={18} color="#15803D" />} iconBg="#EAF3DE" title="Walk-in QR Payment"
              subtitle="QR code shown to walk-in customers at the POS payment step">
              <label style={LABEL}>QR Image URL</label>
              <input type="url" value={qrImageUrl} onChange={e => setQrImageUrl(e.target.value)}
                placeholder="https://... (link to your GCash/Maya QR image)" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              {qrImageUrl && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <img src={qrImageUrl} alt="QR preview"
                    style={{ maxWidth: 160, borderRadius: 10, border: '1px solid #E8E8E0', boxShadow: 'var(--shadow-sm)' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>Upload your QR image to any image host (e.g. Google Drive, Imgur) and paste the direct link here.</div>
            </SectionCard>

            {/* Minimum Order */}
            <SectionCard icon={<Icon name="walkin" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Minimum Order Amount"
              subtitle="Customers must reach this amount before they can proceed to checkout">
              <label style={LABEL}>Minimum Order (₱)</label>
              <input type="number" min="0" step="1" value={minimumOrder} onChange={e => setMinimumOrder(e.target.value)}
                placeholder="e.g. 200 — leave blank to disable" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
              <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>
                {minimumOrder ? `Customers need at least ₱${Number(minimumOrder).toLocaleString()} in their cart to check out.` : 'No minimum set — any order amount is accepted.'}
              </div>
            </SectionCard>

            {/* Store Hours */}
            <SectionCard icon={<Icon name="clock" size={18} color="#D97706" />} iconBg="#FEF3C7" title="Store Hours &amp; Booking Window"
              subtitle="Controls what times customers can select when placing a booking">
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

            {/* Custom Domain (Pro plan) */}
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
                    onClick={() => setShowUpgradeModal(true)}
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
                      <span style={{ color: '#9CA3AF' }}>DNS propagation can take up to 24 hours.</span>
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

          {/* Blocked Dates — separate section, no save button needed */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginTop: 16 }}>
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

            {/* Add date form */}
            {addingDate && (
              <form onSubmit={handleAddDate} style={{ background: '#F7F9FD', borderRadius: 10, padding: '14px', marginBottom: 14, border: '1px solid #9ed3dc' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={LABEL}>Date to Block *</label>
                    <input type="date" value={newDate} min={today} onChange={e => setNewDate(e.target.value)}
                      style={{ ...INPUT }} onFocus={FOCUS} onBlur={BLUR} required />
                  </div>
                  <div>
                    <label style={LABEL}>Reason <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
                      placeholder="e.g. Holiday, Staff Day Off" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                </div>
                {dateErr && <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 8 }}>{dateErr}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={savingDate}
                    style={{ padding: '7px 18px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: savingDate ? '#aaa' : '#38a9c2', color: '#fff', cursor: 'pointer' }}>
                    {savingDate ? 'Saving…' : 'Add'}
                  </button>
                  <button type="button" onClick={() => setAddingDate(false)}
                    style={{ padding: '7px 18px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Blocked dates list */}
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

          {/* ── Facebook Page Connect ── */}
          <SectionCard icon={<Icon name="messenger" size={18} color="#1877F2" />} iconBg="#EBF3FD" title="Connect Facebook Page"
            subtitle="Link your Facebook Page so customers can order via Messenger">
            {fbMsg && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 7, fontSize: 13,
                background: fbMsg.startsWith('✅') ? '#EAF7EC' : '#FCEBEB',
                color: fbMsg.startsWith('✅') ? '#1D6A3B' : '#A32D2D' }}>
                {fbMsg}
              </div>
            )}

            {/* Already connected */}
            {fbPageId && fbPages.length === 0 && !fbMsg.startsWith('✅') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#EAF7EC', border: '0.5px solid #86EFAC' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                <div style={{ fontSize: 13, color: '#15803D' }}>
                  <strong>Page connected</strong> — ID: <code style={{ background: '#D1FAE5', padding: '1px 5px', borderRadius: 4 }}>{fbPageId}</code>
                </div>
              </div>
            )}

            {/* Page selector — shown after successful FB login */}
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

            {/* Connect / Reconnect button */}
            {fbPages.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" disabled={fbConnecting} onClick={handleFbLogin}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: fbConnecting ? '#93C5FD' : '#1877F2', color: '#fff', fontWeight: 700, fontSize: 13, cursor: fbConnecting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  {fbConnecting ? 'Opening Facebook…' : fbPageId ? 'Reconnect Facebook Page' : 'Connect Facebook Page'}
                </button>
                {!import.meta.env.VITE_FB_APP_ID && (
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>VITE_FB_APP_ID not set</div>
                )}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
              Requires <strong>pages_messaging</strong> &amp; <strong>pages_manage_metadata</strong> permissions — available once Meta App Review is approved.
              If the login fails, email <strong>hello@laundrobot.app</strong> and we'll connect your page manually.
            </div>
          </SectionCard>

          {/* ── Messenger Menu ── */}
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

          {/* ── Promo Codes ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '1.5rem', marginTop: 16 }}>
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
              <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#065F46' }}>
                Promo codes are available on the <strong>Growth plan</strong> and above. Upgrade to offer discounts and run promotions for your customers.
              </div>
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
                    <label style={LABEL}>Min. Order (₱) <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input type="number" min="0" step="1" value={promoForm.min_order}
                      onChange={e => setPromoForm(p => ({ ...p, min_order: e.target.value }))}
                      placeholder="e.g. 300" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                  <div>
                    <label style={LABEL}>Max Uses <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional, blank = unlimited)</span></label>
                    <input type="number" min="1" step="1" value={promoForm.max_uses}
                      onChange={e => setPromoForm(p => ({ ...p, max_uses: e.target.value }))}
                      placeholder="e.g. 100" style={INPUT} onFocus={FOCUS} onBlur={BLUR} />
                  </div>
                  <div>
                    <label style={LABEL}>Expires On <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
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
                          <span style={{ fontWeight: 700, fontSize: 13, color: inactive ? '#9CA3AF' : '#5B21B6', letterSpacing: '.05em' }}>{p.code}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: inactive ? '#E2E8F0' : '#EDE9FE', color: inactive ? '#9CA3AF' : '#7C3AED' }}>
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
        </div>
      )}

      {/* ── Referral Links ── */}
      <div style={{ marginTop: 32, background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="link" size={15} color="#374151" />Referral Links</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>Track which marketing channels drive clicks and bookings.</div>
          </div>
          {!['growth', 'pro'].includes(tenantPlan)
            ? <span style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 4 }}>GROWTH+</span>
            : !addingRef && (
              <button type="button" onClick={() => { setAddingRef(true); setRefForm({ name: '', ref: '' }); setRefErr(''); }}
                style={{ fontSize: 13, padding: '7px 16px', borderRadius: 8, border: '1.5px solid #38a9c2', background: '#fff', color: '#38a9c2', fontWeight: 600, cursor: 'pointer' }}>
                + Add Link
              </button>
            )
          }
        </div>

        {!['growth', 'pro'].includes(tenantPlan) ? (
          <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#065F46' }}>
            Referral links are available on the <strong>Growth plan</strong> and above. Upgrade to track which marketing channels drive clicks and bookings.
          </div>
        ) : <>
        {addingRef && (
          <form onSubmit={async e => {
            e.preventDefault(); setSavingRef(true); setRefErr('');
            try {
              const { data } = await createReferralLink(refForm);
              setReferrals(prev => [data, ...prev]);
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
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#9CA3AF', fontSize: 14 }}>
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
                  const conv = r.click_count > 0 ? ((Number(r.paid_order_count) / r.click_count) * 100).toFixed(1) : '—';
                  const link = fbPageId ? `https://m.me/${fbPageId}?ref=${r.ref}` : `https://m.me/me?ref=${r.ref}`;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: '#111827' }}>{r.name}</td>
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
                      <td style={{ padding: '10px 10px', color: '#059669', fontWeight: 600 }}>{r.paid_order_count}</td>
                      <td style={{ padding: '10px 10px', color: '#059669', fontWeight: 600 }}>₱{Number(r.revenue).toLocaleString('en-PH')}</td>
                      <td style={{ padding: '10px 10px', color: conv !== '—' && Number(conv) >= 20 ? '#059669' : '#374151', fontWeight: 600 }}>{conv !== '—' ? `${conv}%` : '—'}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <button type="button"
                          onClick={async () => {
                            if (!confirm(`Delete referral link "${r.name}"?`)) return;
                            try { await deleteReferralLink(r.id); setReferrals(prev => prev.filter(x => x.id !== r.id)); }
                            catch { alert('Failed to delete.'); }
                          }}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                          Delete
                        </button>
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
    </>
  );
}
