import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';
import { ALL_STORAGE_KEYS } from './storage';

// Supabase の app_data テーブル（key / value）とブラウザの localStorage を同期する
// - 読み込み: 起動時に syncFromCloud() でクラウドの内容を localStorage に反映
// - 書き込み: localStorage に保存するたびに pushToCloud() でクラウドへ送信
//
// 【上書き事故防止（楽観的ロック）】
// 端末ごとに「最後に読み込んだ時点のクラウドの更新日時（updated_at）」をキーごとに記憶し、
// 書き込み時は「クラウドの updated_at が記憶している値と一致する場合のみ」更新する。
// 他の端末が先に更新していた場合や、起動時にクラウドを読み込めなかった端末からは
// 書き込みを拒否するため、古いデータ・空のデータでクラウドを上書きすることがなくなる。

const REST_URL = `${SUPABASE_URL}/rest/v1/app_data`;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export const SYNC_ERROR_EVENT = 'cloud-sync-error';
export const CLOUD_UPDATED_EVENT = 'cloud-updated-event';
// 書き込みが拒否された（＝この端末の変更はクラウドに保存されていない）ことを知らせるイベント
export const SAVE_CONFLICT_EVENT = 'cloud-save-conflict';

function notifyError(message: string) {
  window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: message }));
}

function notifyConflict(message: string) {
  window.dispatchEvent(new CustomEvent(SAVE_CONFLICT_EVENT, { detail: message }));
}

// キーごとの「この端末が知っているクラウドの updated_at」
// - string: その時点のクラウドの値をもとに編集している
// - null: クラウドにまだ存在しないことを確認済み（新規作成のみ可）
// - 未登録: クラウドを読み込めていない（書き込み禁止）
const knownVersions = new Map<string, string | null>();

export let lastSyncTime = Date.now();

// ---- 書き込み（キーごとに直列化して、古いデータが後から届くのを防ぐ） ----
const pending = new Map<string, unknown>();
const inFlight = new Set<string>();

type WriteResult = 'ok' | 'conflict' | 'offline';

async function writeKey(key: string, value: unknown): Promise<WriteResult> {
  if (!knownVersions.has(key)) return 'offline';
  const known = knownVersions.get(key);
  const now = new Date().toISOString();

  let res: Response;
  if (known === null) {
    // クラウドにまだ無いキー → 新規作成のみ（既に誰かが作成していたら 409 で失敗する）
    res = await fetch(REST_URL, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify([{ key, value, updated_at: now }]),
    });
    if (res.status === 409) return 'conflict';
  } else {
    // 記憶している updated_at と一致する行だけを更新（不一致なら 0 行更新＝他端末が先に更新済み）
    const filter = `key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(known as string)}`;
    res = await fetch(`${REST_URL}?${filter}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ value, updated_at: now }),
    });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows: { updated_at?: string }[] = await res.json();
  if (rows.length === 0) return 'conflict';

  const newVersion = rows[0].updated_at ?? now;
  knownVersions.set(key, newVersion);
  const t = new Date(newVersion).getTime();
  if (t > lastSyncTime) lastSyncTime = t;
  return 'ok';
}

async function flush(key: string): Promise<void> {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    while (pending.has(key)) {
      const value = pending.get(key);
      pending.delete(key);
      const result = await writeKey(key, value);
      if (result === 'conflict') {
        pending.delete(key);
        notifyConflict('他の端末でデータが更新されていたため、この端末の変更はクラウドに保存されませんでした。');
        return;
      }
      if (result === 'offline') {
        pending.delete(key);
        notifyConflict('起動時にクラウドからデータを読み込めなかったため、この端末の変更はクラウドに保存されませんでした。');
        return;
      }
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

// ---- バックアップ（1日1回、その日最初に読み込んだ時点のクラウドデータを別キーに保存） ----
function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function saveDailyBackups(rows: { key: string; value: unknown }[]) {
  const date = todayStr();
  const backups = rows
    .filter(r => Array.isArray(r.value) && (r.value as unknown[]).length > 0)
    .map(r => ({ key: `backup__${r.key}__${date}`, value: r.value, updated_at: new Date().toISOString() }));
  if (backups.length === 0) return;
  try {
    // 既に今日のバックアップがあれば何もしない（ignore-duplicates）
    await fetch(REST_URL, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(backups),
    });
  } catch {
    /* バックアップ失敗は通常動作に影響させない */
  }
}

// ---- 読み込み ----
// クラウドにデータがあれば localStorage を上書き。
// クラウドに無く、この端末にだけデータがある場合はクラウドへアップロード（初回の引き継ぎ）。
export async function syncFromCloud(keys: string[]): Promise<boolean> {
  try {
    const keyFilter = `key=in.(${keys.map(encodeURIComponent).join(',')})`;
    const res = await fetch(`${REST_URL}?${keyFilter}&select=key,value,updated_at`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows: { key: string; value: unknown; updated_at?: string }[] = await res.json();
    const cloud = new Map(rows.map(r => [r.key, r]));

    let maxTime = Date.now();
    for (const r of rows) {
      if (r.updated_at) {
        const t = new Date(r.updated_at).getTime();
        if (t > maxTime) maxTime = t;
      }
    }
    lastSyncTime = maxTime;

    for (const key of keys) {
      const row = cloud.get(key);
      if (row) {
        knownVersions.set(key, row.updated_at ?? null);
        localStorage.setItem(key, JSON.stringify(row.value));
      } else {
        knownVersions.set(key, null);
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

    void saveDailyBackups(rows);
    return true;
  } catch {
    notifyError('クラウドからの読み込みに失敗しました。この端末に保存されているデータを表示しています。');
    return false;
  }
}

export async function checkCloudUpdates() {
  try {
    // 同じテーブルを使う他アプリ（タスク管理アプリ等）の更新に反応しないよう、レシピアプリのキーに限定
    const keyFilter = `key=in.(${ALL_STORAGE_KEYS.map(encodeURIComponent).join(',')})`;
    const res = await fetch(`${REST_URL}?${keyFilter}&select=key,updated_at`, { headers });
    if (!res.ok) return;
    const rows: { key: string; updated_at?: string }[] = await res.json();
    for (const r of rows) {
      if (!r.updated_at || inFlight.has(r.key)) continue;
      const known = knownVersions.get(r.key);
      // この端末が知っているバージョンと異なれば、他端末が更新している
      if (known !== undefined && known !== null && new Date(r.updated_at).getTime() !== new Date(known).getTime()) {
        window.dispatchEvent(new CustomEvent(CLOUD_UPDATED_EVENT));
        return;
      }
      if (known === null) {
        window.dispatchEvent(new CustomEvent(CLOUD_UPDATED_EVENT));
        return;
      }
    }
  } catch {
    // ignore
  }
}
