import axios from 'axios'
import { useAuthStore } from '../store/auth'
import type { AuthTokenResponse } from '../types/domain'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 120_000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string> | null = null

apiClient.interceptors.response.use(
  res => res,
  async err => {
    const original = err?.config
    if (
      err?.response?.status === 401 &&
      !original?.url?.includes('/auth/') &&
      !original?._retry
    ) {
      original._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = apiClient
            .post<AuthTokenResponse>('/auth/refresh')
            .then(r => {
              useAuthStore.getState().setAuth(r.data.access_token, r.data.user)
              return r.data.access_token
            })
            .finally(() => { refreshPromise = null })
        }
        const newToken = await refreshPromise
        original.headers.Authorization = `Bearer ${newToken}`
        return apiClient(original)
      } catch {
        useAuthStore.getState().logout()
      }
    }
    console.error('[PRISM API]', err?.response?.status, err?.config?.url)
    return Promise.reject(err)
  },
)
