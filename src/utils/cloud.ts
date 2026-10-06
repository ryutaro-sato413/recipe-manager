import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// Supabase の app_data テーブル（key / value）とブラウザの localStorage を同期する
// - 読み込み: 起動時に syncFromCloud() でクラウドの内容を localStorage に反映
// - 書き込み: localStorage に保存するたびに pushToCloud() でクラウドへ送信

const REST_URL = `${SUPABASE_URL}/rest/v1/app_data`;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export const SYNC_ERROR_EVENT = 'cloud-sync-error';

function notifyError(message: string) {
  window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: message }));
}

// ---- 書き込み（キーごとに直列化して、古いデータが後から届くのを防ぐ） ----
const pending = new Map<string, unknown>();
const inFlight = new Set<string>();

async function flush(key: string): Promise<void> {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    while (pending.has(key)) {
      const value = pending.get(key);
      pending.delete(key);
      const now = new Date();
      const res = await fetch(REST_URL, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key, value, updated_at: now.toISOString() }]),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 自分の書き込みで更新時間を進める
      const t = now.getTime();
      if (t > lastSyncTime) lastSyncTime = t;
    }
  } catch {
    notifyError('クラウドへの保存に失敗しました。通信環境を確認してください。');
  } finally {
    inFlight.delete(key);
  }
}

export function pushToCloud(key: string, value: unknown): void {
  pending.set(key, value);
  void flush(key);
}

export let lastSyncTime = Date.now();
export const CLOUD_UPDATED_EVENT = 'cloud-updated-event';

// ---- 読み込み ----
// クラウドにデータがあれば localStorage を上書き。
// クラウドに無く、この端末にだけデータがある場合はクラウドへアップロード（初回の引き継ぎ）。
export async function syncFromCloud(keys: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${REST_URL}?select=key,value,updated_at`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows: { key: string; value: unknown; updated_at?: string }[] = await res.json();
    const cloud = new Map(rows.map(r => [r.key, r.value]));
    
    let maxTime = Date.now();
    for (const r of rows) {
      if (r.updated_at) {
        const t = new Date(r.updated_at).getTime();
        if (t > maxTime) maxTime = t;
      }
    }
    lastSyncTime = maxTime;

    for (const key of keys) {
      if (cloud.has(key)) {
        localStorage.setItem(key, JSON.stringify(cloud.get(key)));
      } else {
        const local = localStorage.getItem(key);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) pushToCloud(key, parsed);
          } catch {
            /* 壊れたローカルデータは無視 */
          }
        }
      }
    }
    return true;
  } catch {
    notifyError('クラウドからの読み込みに失敗しました。この端末に保存されているデータを表示しています。');
    return false;
  }
}

export async function checkCloudUpdates() {
  try {
    const res = await fetch(`${REST_URL}?select=key,updated_at`, { headers });
    if (!res.ok) return;
    const rows: { key: string; updated_at?: string }[] = await res.json();
    for (const r of rows) {
      if (r.updated_at) {
        const t = new Date(r.updated_at).getTime();
        // 5秒のバッファを設けて、他端末からの明らかな新しい更新を検知する
        if (t > lastSyncTime + 5000) {
          window.dispatchEvent(new CustomEvent(CLOUD_UPDATED_EVENT));
          return;
        }
      }
    }
  } catch {
    // ignore
  }
}
