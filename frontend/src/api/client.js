import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token
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

// Response interceptor to catch unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and we're not already on the login or register page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (email, password) => {
    const response = await api.post('/auth/register', { email, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

export const serversApi = {
  list: async () => {
    const response = await api.get('/servers');
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/servers/${id}`);
    return response.data;
  },
  add: async (serverData) => {
    const response = await api.post('/servers', serverData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/servers/${id}`);
    return response.data;
  },
  testConnection: async (id) => {
    const response = await api.post(`/servers/${id}/test`);
    return response.data;
  },
  getStatus: async (id) => {
    const response = await api.get(`/servers/${id}/status`);
    return response.data;
  },
  getInbounds: async (id) => {
    const response = await api.get(`/servers/${id}/inbounds`);
    return response.data;
  },
  getInboundClients: async (serverId, inboundId) => {
    const response = await api.get(`/servers/${serverId}/inbounds/${inboundId}/clients`);
    return response.data;
  },
  addClient: async (serverId, inboundId, clientData) => {
    const response = await api.post(`/servers/${serverId}/inbounds/${inboundId}/clients`, clientData);
    return response.data;
  },
  updateClient: async (serverId, clientId, updateData) => {
    const response = await api.patch(`/servers/${serverId}/clients/${clientId}`, updateData);
    return response.data;
  },
  deleteClient: async (serverId, clientId, inboundId) => {
    const response = await api.delete(`/servers/${serverId}/clients/${clientId}`, {
      params: { inboundId }
    });
    return response.data;
  },
  resetClientTraffic: async (serverId, clientId, inboundId) => {
    const response = await api.post(`/servers/${serverId}/clients/${clientId}/reset-traffic`, null, {
      params: { inboundId }
    });
    return response.data;
  }
};

export default api;
