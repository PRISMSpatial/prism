import { create } from 'zustand'
import type { AuthUser } from '../types/domain'

export const TOKEN_KEY = 'prism_token'

interface AuthStore {
  user: AuthUser | null
  token: string | null
  loading: boolean

  setAuth: (token: string, user: AuthUser) => void
  logout: () => void
  setLoading: (v: boolean) => void
  hydrate: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  loading: true,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_KEY + '_user', JSON.stringify(user))
    set({ token, user, loading: false })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY + '_user')
    set({ token: null, user: null })
  },

  setLoading: (v) => set({ loading: v }),

  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(TOKEN_KEY + '_user')
    if (token && raw) {
      try {
        const [, payloadB64] = token.split('.')
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(TOKEN_KEY + '_user')
          set({ loading: false })
          return
        }
        set({ token, user: JSON.parse(raw), loading: false })
        return
      } catch { /* corrupted — fall through */ }
    }
    set({ loading: false })
  },
}))
