import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

function getStoredToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

api.interceptors.request.use(cfg => {
  const token = getStoredToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export const login = (email, password, keepLoggedIn = false) =>
  api.post('/auth/login', { email, password, keep_logged_in: keepLoggedIn });

export const signup = (business_name, email, password) =>
  api.post('/auth/signup', { business_name, email, password });

export const getSubscription = () =>
  api.get('/auth/subscription');

export const createSubscriptionInvoice = (plan) =>
  api.post('/auth/subscription/pay', { plan });

export const createWalkInOrder = data => api.post('/orders/walk-in', data);
export const getOrders = (params) => api.get('/orders', { params });
export const getArchivedOrders = () => api.get('/orders', { params: { archived: 'true', limit: 500 } });
export const archiveOrderMonth = (year, month) => api.post('/orders/archive-month', { year, month });
export const unarchiveOrder = (id) => api.post(`/orders/${id}/unarchive`);
export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}`, { status });
export const updateOrder = (id, data) => api.patch(`/orders/${id}`, data);
export const updateBooking = (ref, items, customNote, customPrice, deletedIds) =>
  api.put(`/orders/booking/${ref}`, { items, custom_note: customNote || '', custom_price: customPrice || 0, deleted_ids: deletedIds || [] });
export const notifyOrderUpdate    = (id, data) => api.post(`/orders/${id}/notify-update`, data);
export const generatePaymentLink  = id          => api.post(`/orders/${id}/payment-link`);
export const getPaymentStatus     = ref         => api.get(`/orders/booking/${ref}/payment-status`);
export const deleteOrder = id => api.delete(`/orders/${id}`);
export const cancelOrder     = id => api.post(`/orders/${id}/cancel`);
export const getRefunds      = ()         => api.get('/orders/refunds');
export const markRefundIssued = (id, note) => api.patch(`/orders/${id}/refund`, { note });
export const verifyPayment       = id => api.post(`/orders/${id}/verify-payment`);
export const uploadPaymentScreenshot = (id, screenshot) => api.post(`/orders/${id}/upload-screenshot`, { screenshot });
export const confirmQrPayment    = id => api.post(`/orders/${id}/confirm-qr-payment`);
export const sendInvoice   = (id, pdfBase64, customerEmail) =>
  api.post(`/orders/${id}/send-invoice`, { pdf_base64: pdfBase64, customer_email: customerEmail });

export const getServices = () => api.get('/services');
export const createService = data => api.post('/services', data);
export const updateService = (id, data) => api.put(`/services/${id}`, data);
export const deleteService = id => api.delete(`/services/${id}`);

export const getCategories = () => api.get('/categories');
export const createCategory = data => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = id => api.delete(`/categories/${id}`);

export const getCustomers = () => api.get('/customers');
export const searchCustomers = (q) => api.get('/customers/search', { params: { q } });
export const updateCustomer = (id, data) => api.patch(`/customers/${id}`, data);
export const deleteCustomer = id => api.delete(`/customers/${id}`);

export const getTenants = () => api.get('/tenants');
export const updateTenantPlan = (id, plan, subscription_status) => api.patch(`/tenants/${id}/plan`, { plan, subscription_status });
export const createTenant = data => api.post('/tenants', data);
export const updateTenant = (id, data) => api.put(`/tenants/${id}`, data);
export const deleteTenant = (id) => api.delete(`/tenants/${id}`);
export const getMyTenantSettings = () => api.get('/tenants/settings');
export const updateMyTenantSettings = data => api.put('/tenants/settings', data);
export const resetMessengerMenu = () => api.post('/tenants/settings/setup-messenger');
export const getFacebookPages = (userToken) => api.post('/tenants/settings/facebook-pages', { userToken });
export const connectFacebookPage = (pageId, pageDataToken) => api.post('/tenants/settings/facebook-connect', { pageId, pageDataToken });
export const exchangeFbOAuthCode = (code, redirectUri) => api.post('/tenants/settings/facebook-oauth-exchange', { code, redirectUri });
export const testFacebookConnection = () => api.get('/tenants/settings/facebook-status');
export const fetchInstagramAccount = () => api.post('/tenants/settings/instagram-fetch');
export const cloneServices = (sourceTenantId, targetTenantId, clearExisting, cloneOptions) =>
  api.post('/tenants/clone-services', { source_tenant_id: sourceTenantId, target_tenant_id: targetTenantId, clear_existing: clearExisting, clone_options: cloneOptions });

export const getHumanConversations = () => api.get('/conversations/human');
export const releaseConversation = (fbUserId, message) => api.post(`/conversations/${fbUserId}/release`, { message });
export const getPausedCustomers = () => api.get('/conversations/paused');
export const releaseAi = (fbUserId) => api.post(`/conversations/${fbUserId}/release-ai`);

export const sendBlast = (message, filter_status) =>
  api.post('/messaging/blast', { message, filter_status });
export const getBlastHistory = () => api.get('/messaging/blast/history');

export const getFaqs = (tenantId) => api.get('/faqs', { params: tenantId ? { tenant_id: tenantId } : {} });
export const createFaq = data => api.post('/faqs', data);
export const updateFaq = (id, data) => api.put(`/faqs/${id}`, data);
export const deleteFaq = (id, tenantId) => api.delete(`/faqs/${id}`, { params: tenantId ? { tenant_id: tenantId } : {} });

export const getFaqSuggestions = (tenantId) => api.get('/faq-suggestions', { params: tenantId ? { tenant_id: tenantId } : {} });
export const generateFaqSuggestions = (tenantId) => api.post('/faq-suggestions/generate', tenantId ? { tenant_id: tenantId } : {});
export const approveFaqSuggestion = (id, tenantId) => api.post(`/faq-suggestions/${id}/approve`, tenantId ? { tenant_id: tenantId } : {});
export const dismissFaqSuggestion = (id, tenantId) => api.delete(`/faq-suggestions/${id}`, { params: tenantId ? { tenant_id: tenantId } : {} });

export const getUsers = (tenantId) => api.get('/users', { params: tenantId ? { tenant_id: tenantId } : {} });
export const createUser = data => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = id => api.delete(`/users/${id}`);
export const changePassword = (id, password) => api.patch(`/users/${id}/password`, { password });
export const changeMyPassword = (currentPassword, newPassword) => api.patch('/users/me/password', { currentPassword, newPassword });

export const getDeliveryZones   = ()         => api.get('/delivery-zones');
export const createDeliveryZone = data       => api.post('/delivery-zones', data);
export const updateDeliveryZone = (id, data) => api.put(`/delivery-zones/${id}`, data);
export const deleteDeliveryZone = id         => api.delete(`/delivery-zones/${id}`);

export const getDeliveryBrackets    = ()         => api.get('/delivery-brackets');
export const saveShopLocation       = data       => api.put('/delivery-brackets/shop-location', data);
export const geocodeAddress         = address    => api.get('/delivery-brackets/geocode', { params: { address } });
export const createDeliveryBracket  = data       => api.post('/delivery-brackets', data);
export const updateDeliveryBracket  = (id, data) => api.put(`/delivery-brackets/${id}`, data);
export const deleteDeliveryBracket  = id         => api.delete(`/delivery-brackets/${id}`);

export const getBlockedDates   = ()         => api.get('/blocked-dates');
export const createBlockedDate = data       => api.post('/blocked-dates', data);
export const deleteBlockedDate = id         => api.delete(`/blocked-dates/${id}`);

export const getPromoCodes    = ()         => api.get('/promo-codes');
export const createPromoCode  = data       => api.post('/promo-codes', data);
export const togglePromoCode  = (id, active) => api.patch(`/promo-codes/${id}`, { active });
export const deletePromoCode  = id         => api.delete(`/promo-codes/${id}`);

// Public booking API (no auth required)
const PUBLIC_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const pub    = url        => axios.get(`${PUBLIC_BASE}${url}`);
const pubPost = (url, d)  => axios.post(`${PUBLIC_BASE}${url}`, d);

export const getPublicBootstrap       = id          => pub(`/public/${id}/bootstrap`);
export const getPublicTenantInfo     = id          => pub(`/public/${id}/info`);
export const getPublicTenantByDomain = hostname    => axios.get(`${PUBLIC_BASE}/public/by-domain/${encodeURIComponent(hostname)}`);
export const getPublicCategories     = id          => pub(`/public/${id}/categories`);
export const getPublicServices       = id          => pub(`/public/${id}/services`);
export const getPublicDeliveryZones    = id        => pub(`/public/${id}/delivery-zones`);
export const getPublicDeliveryBrackets = id        => pub(`/public/${id}/delivery-brackets`);
export const getPublicGeocode          = q         => axios.get(`${PUBLIC_BASE}/public/geocode`, { params: { q } });
export const getPublicAddressSuggest   = q         => axios.get(`${PUBLIC_BASE}/public/geocode/suggest`, { params: { q } });
export const getPublicBlockedDates   = id                  => pub(`/public/${id}/blocked-dates`);
export const validatePublicPromo     = (id, code, total)   => axios.get(`${PUBLIC_BASE}/public/${id}/promo`, { params: { code, total } });
export const lookupPublicCustomer      = (id, phone)           => axios.get(`${PUBLIC_BASE}/public/${id}/customer`, { params: { phone } });
export const savePublicCustomerCoords  = (id, phone, lat, lng) => axios.patch(`${PUBLIC_BASE}/public/${id}/customer/coords`, { phone, addr_lat: lat, addr_lng: lng });
export const createPublicOrder       = (id, data)          => pubPost(`/public/${id}/orders`, data);
export const trackReferralClick      = (id, ref)           => pubPost(`/public/${id}/referral-click`, { ref });
export const savePublicCart          = (id, data)          => pubPost(`/public/${id}/cart`, data);
export const updatePublicCart        = (id, cartId, data)  => axios.patch(`${PUBLIC_BASE}/public/${id}/cart/${cartId}`, data);
export const getPublicReorderData    = (id, orderId, params) => axios.get(`${PUBLIC_BASE}/public/${id}/reorder/${orderId}`, { params });

// Referral links (authenticated)
export const getReferralLinks   = ()         => api.get('/referrals');
export const getChannelSummary  = ()         => api.get('/referrals/channel-summary');
export const createReferralLink = data       => api.post('/referrals', data);
export const updateReferralLink = (id, data) => api.patch(`/referrals/${id}`, data);
export const deleteReferralLink = id         => api.delete(`/referrals/${id}`);

// Push notifications
export const getVapidPublicKey   = ()   => api.get('/push/vapid-public-key');
export const subscribePush       = sub  => api.post('/push/subscribe', sub);
export const unsubscribePush     = endpoint => api.delete('/push/subscribe', { data: { endpoint } });

// Finance
export const getFinanceDashboard    = (year, month) => api.get('/finance/dashboard', { params: { year, month } });
export const getFinancePricingGuide = ()             => api.get('/finance/pricing-guide');
export const updateServiceCost      = (id, cost)    => api.put(`/finance/pricing-guide/${id}`, { cost_per_unit: cost });
export const getFinanceDailySales   = date           => api.get('/finance/daily-sales', { params: { date } });
export const getFinanceExpenses     = year           => api.get('/finance/expenses', { params: { year } });
export const upsertExpense          = data           => api.put('/finance/expenses', data);
export const getCustomExpenseLabels   = ()           => api.get('/finance/expenses/custom-labels');
export const addCustomExpenseLabel    = data         => api.post('/finance/expenses/custom-labels', data);
export const deleteCustomExpenseLabel = id           => api.delete(`/finance/expenses/custom-labels/${id}`);
export const getFinanceMonthlySummary = year         => api.get('/finance/monthly-summary', { params: { year } });
export const getFinanceTargets        = year             => api.get('/finance/targets', { params: { year } });
export const upsertTarget             = data             => api.put('/finance/targets', data);
export const getFinanceBreakeven      = (year, month)    => api.get('/finance/breakeven', { params: { year, month } });
export const getFinanceProjections    = (year, month)    => api.get('/finance/projections', { params: { year, month } });
export const getFinanceInsights           = context          => api.post('/finance/insights', { context });
export const getFinanceCustomerRetention  = (year, month)    => api.get('/finance/customer-retention', { params: { year, month } });

// Inventory
export const getInventoryItems        = ()               => api.get('/inventory/items');
export const createInventoryItem      = data             => api.post('/inventory/items', data);
export const updateInventoryItem      = (id, data)       => api.put(`/inventory/items/${id}`, data);
export const deleteInventoryItem      = id               => api.delete(`/inventory/items/${id}`);
export const stockIn                  = data             => api.post('/inventory/stock-in', data);
export const stockOut                 = data             => api.post('/inventory/stock-out', data);
export const getInventoryTransactions = (params)         => api.get('/inventory/transactions', { params });
export const getInventoryFormulas     = ()               => api.get('/inventory/formulas');
export const upsertFormula            = data             => api.put('/inventory/formulas', data);
export const deleteFormula            = id               => api.delete(`/inventory/formulas/${id}`);
export const suggestFormula           = data             => api.post('/inventory/formulas/suggest', data);

// Multi-branch
export const getMyBranches = ()     => api.get('/tenants/my-branches');
export const createBranch  = data   => api.post('/tenants/branch', data);
export const switchBranch  = tenant_id => api.post('/auth/switch-branch', { tenant_id });
export const syncBranch    = data   => api.post('/tenants/sync-branch', data);

export default api;
