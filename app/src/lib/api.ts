import type { Op, Snapshot } from '../types';

export class ApiError extends Error {
  kind: 'network' | 'server' | 'not_initialised';
  constructor(message: string, kind: 'network' | 'server' | 'not_initialised' = 'server') {
    super(message);
    this.kind = kind;
  }
}

type Resp<T> = T & { ok: boolean; error?: string };

/** Normalises whatever the user pasted into a usable Apps Script /exec URL. */
export function normaliseUrl(input: string): string {
  const s = input.trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(s)) {
    throw new ApiError('That doesn’t look like an Apps Script web app URL. It should start with https://script.google.com/macros/s/');
  }
  return s.replace(/\/dev(\?.*)?$/, '/exec').replace(/\?.*$/, '');
}

async function call<T>(url: string, body: Record<string, unknown>, timeoutMs = 45000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    // text/plain keeps it a "simple" request so Apps Script needs no CORS preflight
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctl.signal,
    });
  } catch (e) {
    throw new ApiError(navigator.onLine ? 'Could not reach your sheet. Check the deployment URL and that access is set to “Anyone”.' : 'You’re offline', 'network');
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  let data: Resp<T>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError('The sheet responded with an unexpected page. Make sure the web app is deployed with access set to “Anyone”.', 'server');
  }
  if (!data.ok) {
    if (data.error === 'NOT_INITIALISED') throw new ApiError('Sheet not set up yet', 'not_initialised');
    throw new ApiError(data.error || 'Unknown error from sheet');
  }
  return data;
}

async function getVersion(url: string): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(`${url}?action=version`, { redirect: 'follow', signal: ctl.signal });
    const data = await res.json();
    if (!data.ok) throw new ApiError(data.error || 'error');
    return String(data.version);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('offline', 'network');
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  version: getVersion,
  init: (url: string) => call<Snapshot>(url, { action: 'init', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, 90000),
  pull: (url: string) => call<Snapshot>(url, { action: 'pull' }),
  batch: (url: string, ops: Op[]) => call<Snapshot>(url, { action: 'batch', ops }),
  upload: (url: string, file: { name: string; mime: string; data: string }) =>
    call<{ url: string; fileId: string }>(url, { action: 'upload', ...file }, 90000),
};

/** Drive viewer link → an <img>-friendly thumbnail URL. */
export function receiptThumb(url: string, size = 800): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  const m = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}` : url;
}
