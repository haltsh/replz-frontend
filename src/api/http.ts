const BASE = import.meta.env.VITE_API_BASE || ''
const USER_ID = Number(import.meta.env.VITE_USER_ID || 1)

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    credentials: 'include', // 백엔드 CORS 허용 시
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const http = {
  get: (p: string) => req(p),
  post: (p: string, body?: any) => req(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p: string, body?: any) => req(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p: string) => req(p, { method: 'DELETE' }),
}

export const apiEnv = { BASE, USER_ID }

export async function uploadFormData(path: string, form: FormData) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Upload failed ${res.status}`)
  return res.json()
}
