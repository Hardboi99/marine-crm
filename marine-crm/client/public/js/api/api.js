const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  if (!window.location.origin || window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5000')) {
    return 'http://localhost:5000/api';
  }
  return `${window.location.origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();

// Create Axios Instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Unauthorized / Expired Tokens
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login.html')) {
        window.location.href = '/pages/login.html';
      }
    }
    return Promise.reject(error.response ? error.response.data : error);
  }
);

// ─── Attendance helpers ───────────────────────────────────────────────────────
// checkIn/checkOut on the existing backend are keyed by Employee._id
// (POST /employees/checkin/:id), not the logged-in User._id. Every
// other place in this project that resolves "my own employee record"
// does it the exact same way: Employee.findOne({ userId: <User._id> })
// — see getMyEmployee() in employeeController.js, reused by
// listEmployees, checkIn, checkOut, and getMyProfile (GET /employees/me),
// and by getEmployeeDashboard() in dashboardController.js. GET
// /employees/me already exposes that same lookup over HTTP (it just
// wasn't called by any page before), so the navbar button / attendance
// page reuse it here rather than adding a new resolution mechanism.
//
// Not every logged-in User has a linked Employee (e.g. accounts
// created without going through the Admin "Create Employee" flow, or
// seeded users) — GET /employees/me correctly 404s for those. That's
// an expected data state, not a bug, so this wraps it into a typed,
// friendly error the UI can show without looking like a crash.
let _cachedMyEmployeeId = null;
async function resolveMyEmployeeId() {
  if (_cachedMyEmployeeId) return _cachedMyEmployeeId;

  let res;
  try {
    res = await api.get('/employees/me'); // → { success, data: Employee }
  } catch (err) {
    const e = new Error(
      'Your account isn\'t linked to an employee profile yet. Ask your Admin/HR to enable attendance for your account.'
    );
    e.code = 'NO_EMPLOYEE_PROFILE';
    e.cause = err;
    throw e;
  }

  const id = res && res.data && (res.data.id || res.data._id);
  if (!id) {
    const e = new Error(
      'Your account isn\'t linked to an employee profile yet. Ask your Admin/HR to enable attendance for your account.'
    );
    e.code = 'NO_EMPLOYEE_PROFILE';
    throw e;
  }
  _cachedMyEmployeeId = id;
  return id;
}

// Lets a page check up-front (e.g. on load) whether the logged-in
// account has an employee profile, so it can disable the Check In
// button with a clear explanation instead of letting the person click
// it and get a generic failure toast.
async function checkMyEmployeeLink() {
  try {
    await resolveMyEmployeeId();
    return { linked: true };
  } catch (err) {
    return { linked: false, code: err.code || 'PROFILE_LOOKUP_FAILED', message: err.message };
  }
}

// Normalizes a raw Attendance doc ({ checkIn, checkOut, date, ... }, as
// returned by the existing checkin/checkout endpoints) into the shape
// the attendance UI works with. This is purely a client-side response
// shim — it does not change what employee.html's existing check-in/out
// buttons receive, since those call ApiService.employees.* directly.
function normalizeAttendanceRecordClient(raw) {
  if (!raw) return null;
  const checkInTime = raw.checkIn || raw.checkInTime || null;
  const checkOutTime = raw.checkOut || raw.checkOutTime || null;
  const totalMinutes = (checkInTime && checkOutTime)
    ? Math.round((new Date(checkOutTime) - new Date(checkInTime)) / 60000)
    : (raw.totalMinutes !== undefined ? raw.totalMinutes : null);
  const dayType = raw.dayType || 'FULL_DAY';
  const status = raw.status || (checkInTime ? (dayType === 'HALF_DAY' ? 'HALF_DAY' : 'PRESENT') : 'NOT_MARKED');
  return {
    date: raw.date,
    status,
    dayType,
    isLate: !!raw.isLate,
    checkInTime,
    checkOutTime,
    totalMinutes,
    holidayName: raw.holidayName || null,
    checkInLocation: raw.checkInLocation || null,
    checkOutLocation: raw.checkOutLocation || null,
  };
}

// ─── API Endpoints ────────────────────────────────────────────────────────────

const ApiService = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login:              (credentials) => api.post('/auth/login', credentials),
  register:           (data)        => api.post('/auth/register', data),
  logout:             ()            => api.post('/auth/logout'),
  getMe:              ()            => api.get('/auth/me'),
  updateMe:           (data)        => api.patch('/auth/me', data),
  uploadAvatar:       (file)        => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/auth/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  removeAvatar:       ()            => api.delete('/auth/me/avatar'),
  verifyEmail:        (token)       => api.get('/auth/verify-email', { params: { token } }),
  resendVerification: (email)       => api.post('/auth/resend-verification', { email }),

  // ── Countries (flat + namespaced) ─────────────────────────────────────────
  getCountries:  (params)   => api.get('/countries', { params }),
  getCountry:    (id)       => api.get(`/countries/${id}`),
  createCountry: (data)     => api.post('/countries', data),
  updateCountry: (id, data) => api.put(`/countries/${id}`, data),
  deleteCountry: (id)       => api.delete(`/countries/${id}`),

  countries: {
    getAll:  (params)   => api.get('/countries', { params }),
    get:     (id)       => api.get(`/countries/${id}`),
    create:  (data)     => api.post('/countries', data),
    update:  (id, data) => api.put(`/countries/${id}`, data),
    delete:  (id)       => api.delete(`/countries/${id}`),
  },

  // ── Companies (flat + namespaced) ─────────────────────────────────────────
  getCompanies:  (params)   => api.get('/companies', { params }),
  getCompany:    (id)       => api.get(`/companies/${id}`),
  createCompany: (data)     => api.post('/companies', data),
  updateCompany: (id, data) => api.put(`/companies/${id}`, data),
  deleteCompany: (id)       => api.delete(`/companies/${id}`),

  companies: {
    getAll:  (params)   => api.get('/companies', { params }),
    list:    (params)   => api.get('/companies', { params }),
    get:     (id)       => api.get(`/companies/${id}`),
    create:  (data)     => api.post('/companies', data),
    update:  (id, data) => api.put(`/companies/${id}`, data),
    delete:  (id)       => api.delete(`/companies/${id}`),
  },

  // ── Calls (flat + namespaced) ─────────────────────────────────────────────
  getCalls:  (params)   => api.get('/calls', { params }),
  createCall:(data)     => api.post('/calls', data),
  updateCall:(id, data) => api.put(`/calls/${id}`, data),
  deleteCall:(id)       => api.delete(`/calls/${id}`),

  calls: {
    list:   (params)   => api.get('/calls', { params }),
    get:    (id)       => api.get(`/calls/${id}`),
    create: (data)     => api.post('/calls', data),
    update: (id, data) => api.put(`/calls/${id}`, data),
    delete: (id)       => api.delete(`/calls/${id}`),
    remove: (id)       => api.delete(`/calls/${id}`),
    getFollowupsDue: () => api.get('/followups/due'),
  },

  // ── Appointments (flat + namespaced) ─────────────────────────────────────
  getAppointments:      (params)   => api.get('/appointments', { params }),
  createAppointment:    (data)     => api.post('/appointments', data),
  setAppointmentOutcome:(id, data) => api.patch(`/appointments/${id}/outcome`, data),
  updateAppointment:    (id, data) => api.put(`/appointments/${id}`, data),
  deleteAppointment:    (id)       => api.delete(`/appointments/${id}`),

  appointments: {
    list:       (params)   => api.get('/appointments', { params }),
    get:        (id)       => api.get(`/appointments/${id}`),
    create:     (data)     => api.post('/appointments', data),
    setOutcome: (id, data) => api.patch(`/appointments/${id}/outcome`, data),
    update:     (id, data) => api.put(`/appointments/${id}`, data),
    delete:     (id)       => api.delete(`/appointments/${id}`),
  },

  // ── Reasons ───────────────────────────────────────────────────────────────
  getReasons:   (params) => api.get('/reasons', { params }),
  createReason: (data)   => api.post('/reasons', data),

  reasons: {
    list:   (params) => api.get('/reasons', { params }),
    create: (data)   => api.post('/reasons', data),
  },

  // ── Follow-ups (flat + namespaced) ────────────────────────────────────────
  getFollowUps:    (params)   => api.get('/followups', { params }),
  getFollowUpsDue: ()         => api.get('/followups/due'),
  createFollowUp:  (data)     => api.post('/followups', data),
  updateFollowUp:  (id, data) => api.patch(`/followups/${id}`, data),
  deleteFollowUp:  (id)       => api.delete(`/followups/${id}`),

  followups: {
    list:   (params)   => api.get('/followups', { params }),
    getDue: ()         => api.get('/followups/due'),
    create: (data)     => api.post('/followups', data),
    update: (id, data) => api.patch(`/followups/${id}`, data),
    delete: (id)       => api.delete(`/followups/${id}`),
  },

  // ── Contracts (flat + namespaced) ─────────────────────────────────────────
  getContracts:  (params)   => api.get('/contracts', { params }),
  getContract:   (id)       => api.get(`/contracts/${id}`),
  createContract:(formData) => api.post('/contracts', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateContract:(id, fd)   => api.put(`/contracts/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteContract:(id)       => api.delete(`/contracts/${id}`),

  contracts: {
    list:   (params)   => api.get('/contracts', { params }),
    get:    (id)       => api.get(`/contracts/${id}`),
    create: (fd)       => api.post('/contracts', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    update: (id, fd)   => api.put(`/contracts/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    delete: (id)       => api.delete(`/contracts/${id}`),
  },

  // ── Dashboard & Reports ───────────────────────────────────────────────────
  getDashboardStats:        ()       => api.get('/dashboard/stats'),
  getCallsByStatusChart:    ()       => api.get('/dashboard/charts/calls-by-status'),
  getCountryPipelineChart:  ()       => api.get('/dashboard/charts/country-pipeline'),
  getMonthlyContractsChart: ()       => api.get('/dashboard/charts/monthly-contracts'),
  getRecentActivity:        ()       => api.get('/dashboard/activity'),
  getEmployeeDashboard:     ()       => api.get('/dashboard/employee'),
  getNotifications:         ()       => api.get('/notifications'),
  markNotificationRead:     (id)     => api.patch(`/notifications/${id}/read`),
  getDailyReport:           (date)   => api.get('/reports/daily', { params: { date } }),
  getCountryWiseReport:     ()       => api.get('/reports/country-wise'),
  getRejectionReasonReport: (params) => api.get('/reports/rejection-reasons', { params }),

  // ── Crewing & Candidates ──────────────────────────────────────────────────
  crewing: {
    requirements: {
      getAll:  (params)   => api.get('/crewing/requirements', { params }),
      create:  (data)     => api.post('/crewing/requirements', data),
      update:  (id, data) => api.put(`/crewing/requirements/${id}`, data),
      delete:  (id)       => api.delete(`/crewing/requirements/${id}`),
      match:   (id)       => api.get(`/crewing/requirements/${id}/match`),
    },
    candidates: {
      getAll:   (params)   => api.get('/crewing/candidates', { params }),
      create:   (data)     => api.post('/crewing/candidates', data),
      update:   (id, data) => api.put(`/crewing/candidates/${id}`, data),
      reassign: (id, data) => api.patch(`/crewing/candidates/${id}/reassign`, data),
      delete:   (id)       => api.delete(`/crewing/candidates/${id}`),
    },
    applications: {
      getAll:  (params)   => api.get('/crewing/applications', { params }),
      propose: (data)     => api.post('/crewing/applications/propose', data),
      setDecision: (id, data) => api.patch(`/crewing/applications/${id}/decision`, data),
    }
  },

  recruitment: {
    jobApplications: {
      getAll:       (params)   => api.get('/recruitment/job-applications', { params }),
      getStats:     ()         => api.get('/recruitment/job-applications/stats/summary'),
      get:          (id)       => api.get(`/recruitment/job-applications/${id}`),
      updateStatus: (id, data) => api.patch(`/recruitment/job-applications/${id}/status`, data),
      getFileUrl:   (id, field) => {
        const token = localStorage.getItem('token');
        const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
        return `${API_BASE_URL}/recruitment/job-applications/${id}/files/${field}${tokenQuery}`;
      }
    }
  },

  // ── Operations & Compliance ───────────────────────────────────────────────
  ops: {
    onboardings: {
      getAll:  (params)   => api.get('/ops/onboardings', { params }),
      update:  (id, data) => api.put(`/ops/onboardings/${id}`, data),
    },
    invoices: {
      getAll:  (params)   => api.get('/ops/invoices', { params }),
      create:  (data)     => api.post('/ops/invoices', data),
      update:  (id, data) => api.put(`/ops/invoices/${id}`, data),
    },
    expiryAlerts: {
      getAll:  ()         => api.get('/ops/expiry-alerts'),
    }
  },

  reception: {
    visitors: {
      getAll:   (params)   => api.get('/reception/visitors', { params }),
      create:   (data)     => api.post('/reception/visitors', data),
      checkout: (id)       => api.patch(`/reception/visitors/${id}/checkout`)
    },
    calls: {
      getAll:   (params)   => api.get('/reception/calls', { params }),
      create:   (data)     => api.post('/reception/calls', data),
      updateStatus: (id, data) => api.patch(`/reception/calls/${id}/status`, data)
    },
    ppe: {
      getStock:     ()     => api.get('/reception/ppe/stock'),
      updateStock:  (data) => api.post('/reception/ppe/stock', data),
      getIssuances: ()     => api.get('/reception/ppe/issuances'),
      issue:        (data) => api.post('/reception/ppe/issuances', data),
      return:       (id)   => api.patch(`/reception/ppe/issuances/${id}/return`)
    },
    docs: {
      getAll:       ()     => api.get('/reception/docs'),
      create:       (data) => api.post('/reception/docs', data),
      updateStatus: (id, data) => api.patch(`/reception/docs/${id}/status`, data)
    }
  },

  employees: {
    list:   ()         => api.get('/employees'),
    create: (data)     => api.post('/employees', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    delete: (id)       => api.delete(`/employees/${id}`),
    getMyProfile:       ()     => api.get('/employees/me/profile'),
    updateMyProfile:    (data) => api.patch('/employees/me/profile', data),
    getTodayAttendance: ()   => api.get('/employees/attendance/today'),
    checkIn:            (id) => api.post(`/employees/checkin/${id}`),
    checkOut:           (id) => api.post(`/employees/checkout/${id}`),
    submitWorksheet:    (data) => api.post('/employees/worksheet', data),
    getWorksheets:      (params) => api.get('/employees/worksheets', { params }),
    replyToWorksheet:      (id, reply) => api.patch(`/employees/worksheets/${id}/reply`, { reply }),
    respondToWorksheet:    (id, response) => api.patch(`/employees/worksheets/${id}/response`, { response }),
    createTask:         (data) => api.post('/employees/tasks', data),
    getTasks:           (params) => api.get('/employees/tasks', { params }),
    updateTaskStatus:   (id, data) => api.patch(`/employees/tasks/${id}/status`, data),
    bulkImport:         (data) => api.post('/employees/bulk-import', data),
    getUpcomingBirthdays: ()   => api.get('/employees/birthdays/upcoming'),
    checkMyBirthday: () => api.get('/employees/me/birthday-check'),
    listExited:          ()   => api.get('/employees', { params: { status: 'EXITED' } }),
    exit:               (id, data) => api.patch(`/employees/${id}/exit`, data),
    reactivate:         (id) => api.patch(`/employees/${id}/reactivate`),
  },

  documents: {
    getAll: (params) => api.get('/documents', { params }),
    create: (formData) => api.post('/documents', formData, {
      headers: { 'Content-Type': undefined }
    }),
  },

  // ── Attendance (navbar IN/OUT button + attendance.html) ────────────────────
  attendance: {
    getToday: () => api.get('/employees/attendance/me/today'),
    checkIn: async (coords) => {
      const id = await resolveMyEmployeeId();
      const res = await api.post(`/employees/checkin/${id}`, coords || {});
      return { success: res.success, data: normalizeAttendanceRecordClient(res.data) };
    },
    checkOut: async (coords) => {
      const id = await resolveMyEmployeeId();
      const res = await api.post(`/employees/checkout/${id}`, coords || {});
      return { success: res.success, data: normalizeAttendanceRecordClient(res.data) };
    },
    getMonth: (year, month, employeeId) => api.get('/employees/attendance/month', {
      params: { year, month, ...(employeeId ? { employeeId } : {}) },
    }),
    getSummary: (year, month, employeeId) => api.get('/employees/attendance/summary', {
      params: { year, month, ...(employeeId ? { employeeId } : {}) },
    }),
    checkMyEmployeeLink,
    getMyEmployeeId: () => resolveMyEmployeeId(),
  },

  // ── Holidays (read: everyone; write: ADMIN/HR — enforced server-side) ──────
  holidays: {
    getAll: (params) => api.get('/employees/holidays', { params }),
    create: (data) => api.post('/employees/holidays', data),
    update: (id, data) => api.put(`/employees/holidays/${id}`, data),
    delete: (id) => api.delete(`/employees/holidays/${id}`),
  },
};

window.ApiService = ApiService;
window.api = ApiService;