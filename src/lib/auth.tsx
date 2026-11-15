import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, APIError, errorMessage } from './api'
import type { Session, Setup } from './types'

const AuthContext = createContext<{
  session: Session | null
  setup: Setup | null
  loading: boolean
  error: string
  reload: () => Promise<void>
  signOut: () => Promise<void>
}>({
  session: null,
  setup: null,
  loading: true,
  error: '',
  reload: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function reload() {
    setError('')
    try {
      const state = await api<Setup>('/api/auth/setup')
      setSetup(state)
      if (!state.setup_required) {
        try {
          setSession(await api<Session>('/api/auth/me'))
        } catch (e) {
          if (e instanceof APIError && e.status === 401) setSession(null)
          else throw e
        }
      } else setSession(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void reload()
    const expired = () => setSession(null)
    window.addEventListener('session-expired', expired)
    return () => window.removeEventListener('session-expired', expired)
  }, [])
  return (
    <AuthContext.Provider
      value={{
        session,
        setup,
        loading,
        error,
        reload,
        signOut: async () => {
          await api('/api/auth/logout', 'POST')
          setSession(null)
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  return useContext(AuthContext)
}
