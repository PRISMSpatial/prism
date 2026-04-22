import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  res => res,
  err => {
    // Log for debugging; in production route to error monitoring
    console.error('[PRISM API]', err?.response?.status, err?.config?.url)
    return Promise.reject(err)
  },
)
