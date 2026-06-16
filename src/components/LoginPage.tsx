import { useState } from 'react'
import { useLogin, useRegister } from '../api/auth'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const login = useLogin()
  const register = useRegister()

  const pending = login.isPending || register.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'login') {
      login.mutate({ email, password }, {
        onError: (err: any) => setError(err?.response?.data?.detail ?? 'Login failed'),
      })
    } else {
      if (!displayName.trim()) { setError('Display name required'); return }
      register.mutate({ email, password, display_name: displayName.trim() }, {
        onError: (err: any) => setError(err?.response?.data?.detail ?? 'Registration failed'),
      })
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-mark" aria-hidden="true" />
          <span className="logo-name" style={{ fontSize: 22 }}>PRISM</span>
        </div>
        <div className="mono mute" style={{ fontSize: 10, textAlign: 'center', marginBottom: 24, letterSpacing: 1 }}>
          PATHOGEN RECONNAISSANCE & INTELLIGENCE
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
          <button
            className={'login-tab' + (mode === 'login' ? ' active' : '')}
            onClick={() => { setMode('login'); setError('') }}
          >
            Sign In
          </button>
          <button
            className={'login-tab' + (mode === 'register' ? ' active' : '')}
            onClick={() => { setMode('register'); setError('') }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <input
              className="login-input"
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="login-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
          />
          {error && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--signal-hot)' }}>{error}</div>
          )}
          <button className="login-submit" type="submit" disabled={pending}>
            {pending ? 'AUTHENTICATING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  )
}
