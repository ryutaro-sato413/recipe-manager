import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { Recipe, Ingredient, Spice, Order, Inventory } from '../types';

function db() {
  const d = getDb();
  if (!d) throw new Error('Firebase not initialized');
  return d;
}

function shopCol(shopCode: string, col: string) {
  return collection(db(), 'shops', shopCode, col);
}

function shopDoc(shopCode: string, col: string, id: string) {
  return doc(db(), 'shops', shopCode, col, id);
}

async function loadCollection<T>(shopCode: string, col: string): Promise<T[]> {
  const snap = await getDocs(shopCol(shopCode, col));
  return snap.docs.map(d => d.data() as T);
}

export async function loadAllFromCloud(shopCode: string): Promise<{
  recipes: Recipe[];
  ingredients: Ingredient[];
  spices: Spice[];
  orders: Order[];
  inventories: Inventory[];
}> {
  const [recipes, ingredients, spices, orders, inventories] = await Promise.all([
    loadCollection<Recipe>(shopCode, 'recipes'),
    loadCollection<Ingredient>(shopCode, 'ingredients'),
    loadCollection<Spice>(shopCode, 'spices'),
    loadCollection<Order>(shopCode, 'orders'),
    loadCollection<Inventory>(shopCode, 'inventories'),
  ]);
  return { recipes, ingredients, spices, orders, inventories };
}

export async function upsertItem<T extends { id: string }>(
  shopCode: string,
  col: string,
  item: T
): Promise<void> {
  await setDoc(shopDoc(shopCode, col, item.id), item);
}

export async function removeItemFromCloud(
  shopCode: string,
  col: string,
  id: string
): Promise<void> {
  await deleteDoc(shopDoc(shopCode, col, id));
}

// 既存のlocalStorageデータを一括でFirestoreへ移行
export async function migrateLocalToCloud(
  shopCode: string,
  data: {
    recipes: Recipe[];
    ingredients: Ingredient[];
    spices: Spice[];
    orders: Order[];
    inventories: Inventory[];
  }
): Promise<void> {
  const d = db();
  const batch = writeBatch(d);

  const add = <T extends { id: string }>(col: string, items: T[]) => {
    items.forEach(item => {
      batch.set(doc(d, 'shops', shopCode, col, item.id), item);
    });
  };

  add('recipes', data.recipes);
  add('ingredients', data.ingredients);
  add('spices', data.spices);
  add('orders', data.orders);
  add('inventories', data.inventories);

  await batch.commit();
}
