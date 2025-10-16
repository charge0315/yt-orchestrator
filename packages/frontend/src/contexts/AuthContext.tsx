import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, User } from '../api/client'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  googleLogin: (credential: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Auto-login on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.me()
        setUser(response.data.user)
      } catch (error) {
        // No valid session
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    setUser(response.data.user)
  }

  const register = async (email: string, password: string, name: string) => {
    const response = await authApi.register({ email, password, name })
    setUser(response.data.user)
  }

  const googleLogin = async (credential: string) => {
    const response = await authApi.googleLogin(credential)
    setUser(response.data.user)
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
