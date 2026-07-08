// 전역 상태는 인증만 (설계원칙 8)
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authFetch, callApi } from '../lib/http.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)     // { username, nickname, email, ... } | null
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch('/api/my/info')
      if (res.ok) {
        const body = await res.json()
        setUser(body.data ?? body)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      // 공통 유틸 경유 (설계원칙 3). 실패해도 클라이언트 상태는 초기화한다.
      await callApi('/api/logout', { method: 'POST' })
    } catch {
      // 이미 만료/미인증이어도 로그아웃 처리는 계속 진행
    } finally {
      setUser(null)
    }
  }, [])

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    refresh,
    logout,
    setUser,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
