const fs = require('fs');
const path = require('path');

// 1. Patch src/components/library/api.ts
const apiPath = path.resolve(__dirname, '../src/components/library/api.ts');
let apiCode = fs.readFileSync(apiPath, 'utf8').replace(/\r\n/g, '\n');

if (!apiCode.includes('onAuthError')) {
  const listenerDecl = `type GateListener = (code: string) => void
let gateListener: GateListener | null = null

type AuthListener = () => void
let authListener: AuthListener | null = null

/** Registered once by the app store — called on session 401/expiry. */
export function onAuthError(listener: AuthListener | null) {
  authListener = listener
}`;

  apiCode = apiCode.replace(/type GateListener = \(code: string\) => void\s*let gateListener: GateListener \| null = null/, listenerDecl);

  const authErrorTrigger = `    const code = json.error?.code ?? 'UNKNOWN'
    if ((res.status === 401 || code === 'UNAUTHORIZED') && authListener && path !== '/auth/session' && path !== '/auth/login') {
      try {
        authListener()
      } catch {
        // ignore
      }
    }`;

  apiCode = apiCode.replace("    const code = json.error?.code ?? 'UNKNOWN'", authErrorTrigger);
  fs.writeFileSync(apiPath, apiCode.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✓ src/components/library/api.ts patched with onAuthError');
}

// 2. Patch src/components/library/store.ts
const storePath = path.resolve(__dirname, '../src/components/library/store.ts');
let storeCode = fs.readFileSync(storePath, 'utf8').replace(/\r\n/g, '\n');

// Import onAuthError
if (!storeCode.includes('onAuthError')) {
  storeCode = storeCode.replace(
    "import { api, onGateError } from './api'",
    "import { api, onGateError, onAuthError } from './api'"
  );
}

// Register onAuthError
if (!storeCode.includes('onAuthError(')) {
  storeCode = storeCode.replace(
    "  onGateError(() => {\n    void get().refreshStatus()\n  })",
    `  onGateError(() => {\n    void get().refreshStatus()\n  })\n\n  onAuthError(() => {\n    set({ session: null, view: 'login', viewParams: {} })\n  })`
  );
}

// Initial view: 'login' instead of 'dashboard'
storeCode = storeCode.replace("    view: 'dashboard',", "    view: 'login',");

// boot: view: user ? pickFirstView(status, user) : 'login'
const bootOld = `        set({
          booted: true,
          bootError: null,
          status,
          session: session.user,
          lang,
          theme,
          view: 'dashboard',
        })`;

const bootNew = `        const user = session.user
        set({
          booted: true,
          bootError: null,
          status,
          session: user,
          lang,
          theme,
          view: user ? pickFirstView(status, user) : 'login',
        })`;

if (storeCode.includes(bootOld)) {
  storeCode = storeCode.replace(bootOld, bootNew);
}

// setSession
storeCode = storeCode.replace(
  "set({ session: null, view: 'dashboard', viewParams: {} })",
  "set({ session: null, view: 'login', viewParams: {} })"
);

// logout
const logoutOld = `    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' })
      } catch {
        // local sign-out regardless
      }
      set({ session: null, view: 'dashboard', viewParams: {} })
    },`;

const logoutNew = `    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' })
      } catch {
        // local sign-out regardless
      }
      set({ session: null, view: 'login', viewParams: {} })
    },`;

if (storeCode.includes(logoutOld)) {
  storeCode = storeCode.replace(logoutOld, logoutNew);
}

// pickFirstView: Cashier -> pos, Manager/Owner -> dashboard
const pickFirstOld = `function pickFirstView(status: SystemStatus | null, user: SessionUser | null): string {
  if (!user) return 'dashboard'
  if (user.roleKey === 'owner' || user.roleKey === 'admin' || user.permissions.includes('DASHBOARD_VIEW')) {
    return 'dashboard'
  }`;

const pickFirstNew = `function pickFirstView(status: SystemStatus | null, user: SessionUser | null): string {
  if (!user) return 'login'
  // Cashier lands directly on POS
  if (user.roleKey && user.roleKey.toLowerCase() === 'cashier') {
    return 'pos'
  }
  // Manager or owner or user with DASHBOARD_VIEW lands on dashboard
  if (user.roleKey === 'owner' || user.roleKey === 'admin' || user.permissions.includes('DASHBOARD_VIEW')) {
    return 'dashboard'
  }`;

if (storeCode.includes(pickFirstOld)) {
  storeCode = storeCode.replace(pickFirstOld, pickFirstNew);
}

fs.writeFileSync(storePath, storeCode.replace(/\n/g, '\r\n'), 'utf8');
console.log('✓ src/components/library/store.ts patched with strict login gate & role landing');

// 3. Patch src/components/library/app.tsx
const appPath = path.resolve(__dirname, '../src/components/library/app.tsx');
let appCode = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

const appGateOld = `  // Startup Flow: Application Start -> Init local DB/services -> Login Screen -> Auth -> Main Application
  // No protected screen (Dashboard, POS, Home, etc.) or splash is rendered before successful authentication.
  if (!session) {
    return <LoginScreen />
  }

  if (!booted || !status) {
    return <LoginScreen />
  }

  return <MainApp status={status} session={session} />`;

const appGateNew = `  // Startup Flow: Neutral splash while booting -> Login screen -> Main App
  // While booted is false or status is not yet loaded, render neutral splash screen
  if (!booted || !status) {
    return <SplashScreen />
  }

  // Gate: Unauthenticated users MUST see ONLY LoginScreen. Never render shell, sidebar, or dashboard.
  if (!session) {
    return <LoginScreen />
  }

  return <MainApp status={status} session={session} />`;

if (appCode.includes(appGateOld)) {
  appCode = appCode.replace(appGateOld, appGateNew);
  fs.writeFileSync(appPath, appCode.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✓ src/components/library/app.tsx patched with strict splash & login gate');
} else {
  console.log('appGateOld pattern already adjusted or not matched directly');
}
