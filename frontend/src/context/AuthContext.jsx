import { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
    }
  }, [user])

  async function register(name, email, password) {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.post('/auth/register', { name, email, password })
      localStorage.setItem('token', data.access_token)
      setUser(data.user)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create your account')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function login(email, password) {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.post('/auth/login', { email, password })
      localStorage.setItem('token', data.access_token)
      setUser(data.user)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Incorrect email or password')
      return false
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider')
  return ctx
}
