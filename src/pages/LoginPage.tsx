import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { setCredentials } from '../app/authSlice'
import { useLoginMutation } from '../app/api/apiSlice'
import heroImage from '../assets/gas.png'

export function LoginPage() {
  const token = useAppSelector((s) => s.auth.token)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [login, { isLoading }] = useLoginMutation()

  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (token) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await login({ emailOrPhone: emailOrPhone.trim(), password }).unwrap()
      dispatch(
        setCredentials({
          token: res.accessToken,
          userId: res.userId,
          name: res.name,
          email: res.email ?? null,
          role: res.role,
          businessId: res.businessId ?? null,
          stationId: res.stationId ?? null,
          selectedStationId: res.stationId ?? null,
        }),
      )
      navigate('/')
    } catch {
      setError('Invalid email, phone, or password.')
    }
  }

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-white md:flex-row">
      {/* Hero image — fills right half; absolute img avoids intrinsic height forcing page scroll */}
      <div className="relative hidden min-h-0 md:order-2 md:block md:h-full md:w-1/2 md:self-stretch">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          decoding="async"
        />
      </div>

      {/* Form — scroll inside column only if needed (zoom / small height) */}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-10 md:order-1 md:h-full md:w-1/2 md:px-12 lg:px-16 xl:px-20 bg-white">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Sign In</h1>
          <p className="mt-2 text-base text-slate-500">Please login to your account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error ? (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-600">
                Email{' '}
                <span className="font-normal text-slate-400">(or phone)</span>
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="login-email"
                  required
                  autoComplete="username"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="Email address or phone"
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-3 text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-600">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  id="login-password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-12 text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 flex h-full w-12 items-center justify-center rounded-r-lg text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              // #009966
              className="w-full rounded-lg bg-[#009966] py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#008055] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* <p className="mt-8 text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <a
              href="mailto:"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Contact to the Administrator
            </a>
          </p> */}
        </div>
      </div>
    </div>
  )
}
