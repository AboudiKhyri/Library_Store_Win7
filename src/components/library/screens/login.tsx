'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — login screen
import { useState, useEffect } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, User, Loader2, LogIn, AlertTriangle, Eye, EyeOff, Store } from 'lucide-react'
import type { SessionUser } from '@/lib/library/types'

export function LoginScreen() {
  const status = useLibraryStore((s) => s.status)
  const refreshStatus = useLibraryStore((s) => s.refreshStatus)
  const setSession = useLibraryStore((s) => s.setSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('qx-last-username')
      if (saved && !username) setUsername(saved)
      const params = new URLSearchParams(window.location.search)
      const urlErr = params.get('error')
      if (urlErr) {
        setError(urlErr)
        window.history.replaceState({}, '', '/')
      }
    } catch {}
  }, [])

  const temporarilyUnavailable = status?.licenseState === 'TEMPORARILY_UNAVAILABLE'

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmedUser = username.trim()
    if (!trimmedUser) {
      setError('يرجى إدخال اسم المستخدم للمتابعة')
      document.getElementById('username')?.focus()
      return
    }
    if (!password) {
      setError('يرجى إدخال كلمة المرور للمتابعة')
      document.getElementById('password')?.focus()
      return
    }
    setPending(true)
    setError(null)
    try {
      const { user } = await api<{ user: SessionUser }>('/auth/login', {
        method: 'POST',
        body: { username: trimmedUser, password },
      })
      try {
        localStorage.setItem('qx-last-username', trimmedUser)
      } catch {}
      setSession(user)
      await refreshStatus()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setPending(false)
    }
  }

  const displayName = status?.business?.displayName || status?.business?.businessName

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/12 to-transparent" />
        <div className="absolute -bottom-24 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {status?.branding?.logoDataUrl ? (
            <img src={status?.branding?.logoDataUrl} alt={displayName ?? ''} className="h-20 w-20 rounded-2xl border bg-white p-1.5 object-contain shadow-lg" />
          ) : (
            <img src="/logo.png" alt={displayName ?? 'Library Store'} className="h-20 w-20 rounded-2xl border bg-white p-1.5 object-contain shadow-lg" />
          )}
          <div>
            <h1 className="text-xl font-extrabold">{displayName ?? 'Library Store'}</h1>
            <p className="mt-1 text-xs text-muted-foreground">نظام إدارة المتاجر ونقاط البيع (أوفلاين)</p>
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">تسجيل الدخول</CardTitle>
            <CardDescription>أدخل بيانات حسابك للمتابعة</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action="/api/library/auth/login"
              method="POST"
              onSubmit={submit}
              className="space-y-4"
            >
              {temporarilyUnavailable && (
                <Alert className="border-[var(--warning)]/40 bg-[var(--warning)]/10">
                  <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                  <AlertDescription className="text-[var(--warning)]">
                    خادم التراخيص غير متاح — وضع عدم الاتصال (متبقي{' '}
                    <span className="qx-num tabular-nums" dir="ltr">
                      {Math.max(0, Math.round(status?.license?.graceRemainingHours ?? 0))}
                    </span>{' '}
                    ساعة من فترة السماح)
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    dir="ltr"
                    className="qx-num ps-9"
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (error) setError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void submit()
                      }
                    }}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    className="qx-num ps-9 pe-9"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void submit()
                      }
                    }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                name="intent"
                value="login"
                style={{ touchAction: 'manipulation' }}
                onClick={(e) => {
                  if (!pending) {
                    void submit(e)
                  }
                }}
                onPointerUp={(e) => {
                  if (!pending && e.pointerType === 'touch') {
                    void submit()
                  }
                }}
                className="w-full cursor-pointer transition-all active:scale-[0.98] shadow-md font-semibold text-base py-5 select-none"
                size="lg"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="me-2 h-5 w-5 animate-spin" />
                    <span>جارٍ تسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="me-2 h-5 w-5" />
                    <span>دخول</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          Library Store v{status?.version ?? '1.0.0'}
        </p>
      </div>
    </div>
  )
}
