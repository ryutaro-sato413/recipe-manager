import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const CONFIG_KEY = 'recipe_manager_firebase_config';
const SHOP_CODE_KEY = 'recipe_manager_shop_code';

let _db: Firestore | null = null;

export function initFirebase(config: FirebaseConfig): Firestore {
  if (_db) return _db;
  const app: FirebaseApp = getApps().length === 0
    ? initializeApp(config)
    : getApps()[0];
  _db = getFirestore(app);
  return _db;
}

export function getDb(): Firestore | null {
  return _db;
}

export function resetDb() {
  _db = null;
}

export function getStoredConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveStoredConfig(config: FirebaseConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearStoredConfig() {
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(SHOP_CODE_KEY);
  _db = null;
}

export function getShopCode(): string {
  return localStorage.getItem(SHOP_CODE_KEY) || '';
}

export function saveShopCode(code: string) {
  localStorage.setItem(SHOP_CODE_KEY, code.trim().toLowerCase().replace(/\s+/g, '-'));
}
