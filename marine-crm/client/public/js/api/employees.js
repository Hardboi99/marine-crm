// Employees API helper

const ApiEmployees = {
  list: () => api.get("/employees"),
  create: (data) => api.post("/employees", data),
  delete: (id) => api.delete(`/employees/${id}`),
  update: (id, data) => api.put(`/employees/${id}`, data),
  getTodayAttendance: () => api.get("/employees/attendance/today"),
  checkIn: (id) => api.post(`/employees/checkin/${id}`),
  checkOut: (id) => api.post(`/employees/checkout/${id}`),
  submitWorksheet: (data) => api.post("/employees/worksheet", data),
  getWorksheets: (params) => api.get("/employees/worksheets", { params }),
  createTask: (data) => api.post("/employees/tasks", data),
  getTasks: (params) => api.get("/employees/tasks", { params }),
  updateTaskStatus: (id, data) => api.patch(`/employees/tasks/${id}/status`, data),
  getUpcomingBirthdays: () => api.get("/employees/birthdays/upcoming"),

  // ADD THIS
  checkMyBirthday: () => api.get("/employees/me/birthday-check"),

  listExited: () => api.get("/employees", { params: { status: "EXITED" } }),
  exit: (id, data) => api.patch(`/employees/${id}/exit`, data),
  reactivate: (id) => api.patch(`/employees/${id}/reactivate`),
};

window.ApiEmployees = ApiEmployees;
