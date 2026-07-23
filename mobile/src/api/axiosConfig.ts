import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_URL = 'http://192.168.100.13:8002/api/v1';

const apiClient = axios.create({
  baseURL: DEFAULT_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Inicializar la URL desde AsyncStorage al arrancar
AsyncStorage.getItem('custom_api_url').then(url => {
  if (url) {
    apiClient.defaults.baseURL = url;
  }
});

// Interceptor para agregar el token a todas las peticiones
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar el refresh token si la petición falla por token expirado (401)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        
        const baseURL = apiClient.defaults.baseURL || DEFAULT_API_URL;
        const res = await axios.post(`${baseURL}/auth/refresh/`, { refresh: refreshToken });
        const newAccess = res.data?.access || res.data?.data?.access;
        
        if (!newAccess) throw new Error('Refresh response missing access token');
        
        await AsyncStorage.setItem('access_token', newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      } catch (e) {
        // Falló el refresh, desloguear usuario
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('user_data');
        // Redirigir a login en el componente principal
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
