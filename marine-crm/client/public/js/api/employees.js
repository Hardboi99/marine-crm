// Employees API helper

const ApiEmployees = {
  list: () => api.get('/employees'),
  create: (data) => api.post('/employees', data),
  delete: (id) => api.delete(`/employees/${id}`),
  update: (id, data) => api.put(`/employees/${id}`, data),
};

window.ApiEmployees = ApiEmployees;
