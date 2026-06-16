import { useMutation } from '@tanstack/react-query'
import { apiClient } from './client'
import { useAuthStore } from '../store/auth'
import type { AuthTokenResponse } from '../types/domain'

export function useLogin() {
  const setAuth = useAuthStore(s => s.setAuth)
  return useMutation({
    mutationFn: async (req: { email: string; password: string }) => {
      const res = await apiClient.post<AuthTokenResponse>('/auth/login', req)
      return res.data
    },
    onSuccess: (data) => setAuth(data.access_token, data.user),
  })
}

export function useRegister() {
  const setAuth = useAuthStore(s => s.setAuth)
  return useMutation({
    mutationFn: async (req: { email: string; password: string; display_name: string; role?: string }) => {
      const res = await apiClient.post<AuthTokenResponse>('/auth/register', req)
      return res.data
    },
    onSuccess: (data) => setAuth(data.access_token, data.user),
  })
}

export function useRefreshToken() {
  const setAuth = useAuthStore(s => s.setAuth)
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<AuthTokenResponse>('/auth/refresh')
      return res.data
    },
    onSuccess: (data) => setAuth(data.access_token, data.user),
  })
}
