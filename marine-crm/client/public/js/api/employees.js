// Employees API helper

const ApiEmployees = {
  list: () => api.get('/employees'),
  create: (data) => api.post('/employees', data),
  delete: (id) => api.delete(`/employees/${id}`),
};

window.ApiEmployees = ApiEmployees;
