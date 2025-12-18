/**
 * 認証状態（ユーザー/ローディング/ログイン等）をアプリ全体で共有するコンテキスト。
 * バックエンドのセッション（Cookie）を前提に `/api/auth/me` で自動ログイン判定します。
 */
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

/**
 * 認証コンテキストを取得するカスタムフック。
 * `AuthProvider` 配下でのみ使用してください。
 */
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

  // マウント時に自動ログイン（セッション有無）を確認
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.me()
        setUser(response.data.user)
      } catch (error) {
        // セッションが無効/未ログイン
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  /**
   * メール/パスワードでログインします。
   */
  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    setUser(response.data.user)
  }

  /**
   * 新規登録します。
   */
  const register = async (email: string, password: string, name: string) => {
    const response = await authApi.register({ email, password, name })
    setUser(response.data.user)
  }

  /**
   * Googleログイン（クレデンシャル）を実行します。
   */
  const googleLogin = async (credential: string) => {
    const response = await authApi.googleLogin(credential)
    setUser(response.data.user)
  }

  /**
   * ログアウトしてユーザー状態をクリアします。
   */
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
