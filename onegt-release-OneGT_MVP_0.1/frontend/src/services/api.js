import axios from 'axios';

// Get base path from Vite config (removes trailing slash)
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const api = axios.create({
    baseURL: `${basePath}/api`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('chrms_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.detail || 'An error occurred';
        console.error('API Error:', message);
        return Promise.reject(error);
    }
);

export default api;

// Associates API
export const associatesApi = {
    getAll: () => api.get('/associates/'),
    getById: (id) => api.get(`/associates/${id}`),
    getNextId: () => api.get('/associates/next-id'),
    create: (data) => api.post('/associates/', data),
    update: (id, data) => api.put(`/associates/${id}`, data),
    delete: (id) => api.delete(`/associates/${id}`),
    getByDepartment: (dept) => api.get(`/associates/department/${dept}`),
    uploadProof: (id, proofType, file) => {
        const formData = new FormData();
        formData.append('proof_type', proofType);
        formData.append('file', file);
        return api.post(`/associates/${id}/upload-proof`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Projects API
export const projectsApi = {
    getAll: () => api.get('/projects/'),
    getById: (id) => api.get(`/projects/${id}`),
    create: (data) => api.post('/projects/', data),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    getByStatus: (status) => api.get(`/projects/status/${status}`),
    getByClient: (client) => api.get(`/projects/client/${client}`),
    generateId: (year, month) => api.get('/projects/generate-id', { params: { year, month } }),
    getStats: () => api.get('/projects/stats')
};

// Allocations API
export const allocationsApi = {
    getAll: (params) => api.get('/allocations/', { params }),
    create: (data) => api.post('/allocations/', data),
    update: (rowIndex, data) => api.put(`/allocations/${rowIndex}`, data),
    delete: (rowIndex) => api.delete(`/allocations/${rowIndex}`),
    getByMonth: (year, month) => api.get('/allocations/by-month', { params: { year, month } }),
    getByAssociate: (id) => api.get(`/allocations/associate/${id}`),
    getByProject: (id) => api.get(`/allocations/project/${id}`),
    getDashboardView: (active_only = true) => api.get('/allocations/dashboard-view', { params: { active_only } })
};


// Payroll API
export const payrollApi = {
    getAll: (params) => api.get('/payroll/', { params }),
    create: (data) => api.post('/payroll/', data),
    bulkCreate: (data) => api.post('/payroll/bulk', data),
    delete: (rowIndex) => api.delete(`/payroll/${rowIndex}`),
    getSummary: (year, month) => api.get('/payroll/summary', { params: { year, month } }),
    getAssociateHistory: (id) => api.get(`/payroll/associate/${id}/history`),
    upload: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/payroll/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Expenses API (legacy)
export const expensesApi = {
    getAll: (params) => api.get('/expenses/', { params }),
    create: (data) => api.post('/expenses/', data),
    update: (rowIndex, data) => api.put(`/expenses/${rowIndex}`, data),
    delete: (rowIndex) => api.delete(`/expenses/${rowIndex}`),
    getSummary: (params) => api.get('/expenses/summary', { params }),
    getByProject: (id) => api.get(`/expenses/project/${id}`),
    getCategories: () => api.get('/expenses/categories')
};

// Expense Reports API (new)
export const expenseReportsApi = {
    getAll: (params) => api.get('/expenses/reports', { params }),
    getById: (id) => api.get(`/expenses/reports/${id}`),
    create: (data) => api.post('/expenses/reports', data),
    update: (id, data) => api.put(`/expenses/reports/${id}`, data),
    delete: (id) => api.delete(`/expenses/reports/${id}`),
    submit: (id) => api.post(`/expenses/reports/${id}/submit`),
    withdraw: (id) => api.post(`/expenses/reports/${id}/withdraw`),
    approve: (id) => api.post(`/expenses/reports/${id}/approve`),
    reject: (id, reason) => api.post(`/expenses/reports/${id}/reject`, null, { params: { reason } }),
    uploadReceipt: (reportId, file) => {
        const formData = new FormData();
        formData.append('report_id', reportId);
        formData.append('file', file);
        return api.post('/expenses/reports/upload-receipt', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Currency API
export const currencyApi = {
    getAll: (year, month) => api.get('/currency/', { params: { year, month } }),
    getByPeriod: (year, month) => api.get(`/currency/${year}/${month}`),
    create: (data) => api.post('/currency/', data),
    update: (year, month, data) => api.put(`/currency/${year}/${month}`, data),
    delete: (year, month) => api.delete(`/currency/${year}/${month}`),
    getCurrencies: () => api.get('/currency/currencies'),
    checkMissing: () => api.get('/currency/check-missing'),
    addCurrency: (code) => api.post(`/currency/add-currency/${code}`),
    getTrend: (months = 12) => api.get(`/currency/trend/${months}`)
};

// Customers API
export const customersApi = {
    getAll: () => api.get('/customers/'),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers/', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    getByStatus: (status) => api.get(`/customers/status/${status}`)
};

// Timesheets API
export const timesheetsApi = {
    getAll: (params) => api.get('/timesheets/', { params }),
    getTeamTimesheets: () => api.get('/timesheets/team'),
    create: (data) => api.post('/timesheets/', data),
    bulkCreate: (data) => api.post('/timesheets/bulk', data),
    update: (rowIndex, data) => api.put(`/timesheets/${rowIndex}`, data),
    delete: (rowIndex) => api.delete(`/timesheets/${rowIndex}`),
    bulkUpdateStatus: (rowIndices, status, reason) => api.post('/timesheets/bulk-status', { row_indices: rowIndices, status, reason }),
    getWeeklySummary: (associateId, weekStart) =>
        api.get('/timesheets/weekly-summary', { params: { associate_id: associateId, week_start: weekStart } }),
    getProjectHours: (id) => api.get(`/timesheets/project/${id}/hours`)
};

// Notifications API
export const notificationsApi = {
    getAll: (userId) => api.get('/notifications/', { params: { user_id: userId } }),
    create: (data) => api.post('/notifications/', data),
    markAsRead: (rowIndex) => api.put(`/notifications/${rowIndex}/read`),
    markAllRead: (userId) => api.post('/notifications/mark-all-read', null, { params: { user_id: userId } })
};

// Dashboard API
export const dashboardApi = {
    getOverview: (params) => api.get('/dashboard/overview', { params }),
    getAllocationByMonth: (year, month) =>
        api.get('/dashboard/allocation-by-month', { params: { year, month } }),
    getProjectProfitability: (params) =>
        api.get('/dashboard/project-profitability', { params }),
    getRevenueTrend: (year, projectId, managerId) =>
        api.get('/dashboard/revenue-trend', { params: { year, project_id: projectId, manager_id: managerId } }),
    getDepartmentSummary: () => api.get('/dashboard/department-summary'),
    getUtilization: (year, month, managerId) =>
        api.get('/dashboard/utilization', { params: { year, month, manager_id: managerId } }),
    getAssociateOverview: (associateId) =>
        api.get('/dashboard/associate-overview', { params: { associate_id: associateId } }),
    getPendingApprovals: (managerId) =>
        api.get('/dashboard/pending-approvals', { params: { manager_id: managerId } })
};

// Skills API
export const skillsApi = {
    getAll: () => api.get('/skills/'),
    getFamilies: () => api.get('/skills/families'),
    getByFamily: (family) => api.get(`/skills/family/${encodeURIComponent(family)}`),
    search: (query, family) => api.get('/skills/search', { params: { q: query, family } }),
    getAllList: () => api.get('/skills/all')
};

// Assets API
export const assetsApi = {
    getAll: (owner) => api.get('/assets/', { params: owner ? { owner } : undefined }),
    getMyAssets: (associateId) => api.get(`/assets/my-assets/${associateId}`),
    getById: (id) => api.get(`/assets/${id}`),
    getTypes: () => api.get('/assets/types'),
    create: (data) => api.post('/assets/', data),
    update: (id, data) => api.put(`/assets/${id}`, data),
    delete: (id) => api.delete(`/assets/${id}`)
};

// Organization API
export const organizationApi = {
    getDepartments: () => api.get('/organization/departments'),
    getRoles: () => api.get('/organization/roles'),
    getWorkLocations: () => api.get('/organization/work-locations')
};
