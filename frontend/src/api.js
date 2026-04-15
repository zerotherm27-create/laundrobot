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
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const getOrders = () => api.get('/orders');
export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status });
export const deleteOrder = id => api.delete(`/orders/${id}`);

export const getServices = () => api.get('/services');
export const createService = data => api.post('/services', data);
export const updateService = (id, data) => api.put(`/services/${id}`, data);
export const deleteService = id => api.delete(`/services/${id}`);

export const getCategories = () => api.get('/categories');
export const createCategory = data => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = id => api.delete(`/categories/${id}`);

export const getCustomers = () => api.get('/customers');

export const getTenants = () => api.get('/tenants');
export const createTenant = data => api.post('/tenants', data);
export const updateTenant = (id, data) => api.put(`/tenants/${id}`, data);

export const sendBlast = (message, filter_status) =>
  api.post('/messaging/blast', { message, filter_status });
export const getBlastHistory = () => api.get('/messaging/blast/history');

export const getFaqs = (tenantId) => api.get('/faqs', { params: tenantId ? { tenant_id: tenantId } : {} });
export const createFaq = data => api.post('/faqs', data);
export const updateFaq = (id, data) => api.put(`/faqs/${id}`, data);
export const deleteFaq = (id, tenantId) => api.delete(`/faqs/${id}`, { params: tenantId ? { tenant_id: tenantId } : {} });

export const getUsers = () => api.get('/users');
export const createUser = data => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = id => api.delete(`/users/${id}`);
export const changePassword = (id, password) => api.patch(`/users/${id}/password`, { password });
export const changeMyPassword = (currentPassword, newPassword) => api.patch('/users/me/password', { currentPassword, newPassword });

export default api;