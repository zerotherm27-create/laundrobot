import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
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

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const createWalkInOrder = data => api.post('/orders/walk-in', data);
export const getOrders = (params) => api.get('/orders', { params });
export const getArchivedOrders = () => api.get('/orders', { params: { archived: 'true', limit: 500 } });
export const archiveOrderMonth = (year, month) => api.post('/orders/archive-month', { year, month });
export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}`, { status });
export const updateOrder = (id, data) => api.patch(`/orders/${id}`, data);
export const updateBooking = (ref, items, customNote, customPrice) =>
  api.put(`/orders/booking/${ref}`, { items, custom_note: customNote || '', custom_price: customPrice || 0 });
export const notifyOrderUpdate    = (id, data) => api.post(`/orders/${id}/notify-update`, data);
export const generatePaymentLink  = id          => api.post(`/orders/${id}/payment-link`);
export const deleteOrder = id => api.delete(`/orders/${id}`);
export const cancelOrder     = id => api.post(`/orders/${id}/cancel`);
export const verifyPayment   = id => api.post(`/orders/${id}/verify-payment`);
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
export const deleteCustomer = id => api.delete(`/customers/${id}`);

export const getTenants = () => api.get('/tenants');
export const createTenant = data => api.post('/tenants', data);
export const updateTenant = (id, data) => api.put(`/tenants/${id}`, data);
export const deleteTenant = (id) => api.delete(`/tenants/${id}`);
export const getMyTenantSettings = () => api.get('/tenants/settings');
export const updateMyTenantSettings = data => api.put('/tenants/settings', data);
export const resetMessengerMenu = () => api.post('/tenants/settings/setup-messenger');
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
export const getPublicCategories     = id          => pub(`/public/${id}/categories`);
export const getPublicServices       = id          => pub(`/public/${id}/services`);
export const getPublicDeliveryZones    = id        => pub(`/public/${id}/delivery-zones`);
export const getPublicDeliveryBrackets = id        => pub(`/public/${id}/delivery-brackets`);
export const getPublicGeocode          = q         => axios.get(`${PUBLIC_BASE}/public/geocode`, { params: { q } });
export const getPublicAddressSuggest   = q         => axios.get(`${PUBLIC_BASE}/public/geocode/suggest`, { params: { q } });
export const getPublicBlockedDates   = id                  => pub(`/public/${id}/blocked-dates`);
export const validatePublicPromo     = (id, code, total)   => axios.get(`${PUBLIC_BASE}/public/${id}/promo`, { params: { code, total } });
export const lookupPublicCustomer    = (id, phone)         => axios.get(`${PUBLIC_BASE}/public/${id}/customer`, { params: { phone } });
export const createPublicOrder       = (id, data)          => pubPost(`/public/${id}/orders`, data);
export const savePublicCart          = (id, data)          => pubPost(`/public/${id}/cart`, data);
export const updatePublicCart        = (id, cartId, data)  => axios.patch(`${PUBLIC_BASE}/public/${id}/cart/${cartId}`, data);

// Referral links (authenticated)
export const getReferralLinks   = ()         => api.get('/referrals');
export const createReferralLink = data       => api.post('/referrals', data);
export const updateReferralLink = (id, data) => api.patch(`/referrals/${id}`, data);
export const deleteReferralLink = id         => api.delete(`/referrals/${id}`);

export default api;