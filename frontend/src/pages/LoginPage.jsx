import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl italic text-ink">Welcome back.</h1>
        <p className="mt-2 text-sm text-inkfaint">Sign in to pick up where you left off.</p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring mt-1 w-full border-b border-paperline bg-transparent py-2 text-ink"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-inkfaint">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full border-b border-paperline bg-transparent py-2 text-ink"
            />
          </div>

          {error && <p className="text-sm text-clay">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring mt-2 rounded-sm bg-ink py-2.5 text-sm text-paper hover:bg-ochredark disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-inkfaint">
          New here?{' '}
          <Link to="/register" className="text-ink underline decoration-paperline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
