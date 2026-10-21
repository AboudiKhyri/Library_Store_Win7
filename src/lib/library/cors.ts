/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// CORS utilities for Tauri desktop app compatibility
// The Tauri WebView loads the bridge page from a virtual host (tauri://localhost)
// then navigates to http://127.0.0.1:3210/. Due to WebView2 security context behavior,
// fetch requests may remain cross-origin. This module provides CORS headers for
// all API routes to ensure desktop app compatibility.

import { NextRequest, NextResponse } from 'next/server'

/** Origins allowed for the Tauri desktop bridge (cross-origin from virtual host). */
function isTauriOrigin(origin: string): boolean {
  return (
    origin === 'http://tauri.localhost' ||
    origin === 'https://tauri.localhost' ||
    origin === 'tauri://localhost' ||
    origin === 'http://localhost' ||
    origin === 'http://127.0.0.1' ||
    origin === 'null' ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
  )
}

/** Returns CORS headers for the given origin if allowed, otherwise empty headers. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && isTauriOrigin(origin) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

/** Applies CORS headers to a NextResponse. */
export function applyCors(res: NextResponse, origin: string | null): NextResponse {
  const headers = corsHeaders(origin)
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v)
  }
  return res
}

/** Creates a CORS preflight (OPTIONS) response. */
export function corsPreflight(origin: string | null): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

/** Wraps an API handler to automatically add CORS headers. */
export function withCors<T>(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') {
      return corsPreflight(origin)
    }
    const res = await handler(req)
    return applyCors(res, origin)
  }
}