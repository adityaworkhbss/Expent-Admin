import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react'
import { apiClient } from '../api/client'
import type { AdminUser } from '../types'

interface AuthContextType {
  admin: AdminUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const checkAuth = useCallback(async () => {
    apiClient.loadTokens()
    if (apiClient.isAuthenticated()) {
      try {
        const storedAdmin = localStorage.getItem('adminUser')
        if (storedAdmin) {
          setAdmin(JSON.parse(storedAdmin))
        }
        setIsAuthenticated(true)
      } catch {
        // Ignore parsing errors
      }
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (email: string, password: string) => {
    const response = await apiClient.adminLogin(email, password)
    if (response.success) {
      apiClient.setTokens(response.data.accessToken)
      setAdmin(response.data.admin)
      setIsAuthenticated(true)
      localStorage.setItem('adminUser', JSON.stringify(response.data.admin))
    } else {
      throw new Error(response.message || 'Login failed')
    }
  }

  const logout = () => {
    apiClient.clearTokens()
    setAdmin(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        admin,
        isLoading,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
