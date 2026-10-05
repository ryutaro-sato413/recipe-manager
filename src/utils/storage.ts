import { Recipe, Ingredient, Spice, Order } from '../types';
import { pushToCloud } from './cloud';
import { cascadeRecipeUpdates } from './calculations';

const KEYS = {
  recipes: 'recipe_manager_recipes',
  ingredients: 'recipe_manager_ingredients',
  spices: 'recipe_manager_spices',
  orders: 'recipe_manager_orders',
};

const INVENTORY_KEY = 'recipe_manager_inventories';

// クラウド同期の対象となる全キー
export const ALL_STORAGE_KEYS = [...Object.values(KEYS), INVENTORY_KEY];

function getItem<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setItem<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
  pushToCloud(key, data);
}

// Recipes
export function getRecipes(): Recipe[] { return getItem<Recipe>(KEYS.recipes); }
export function saveRecipes(recipes: Recipe[]): void { setItem(KEYS.recipes, recipes); }
export function addRecipe(recipe: Recipe): Recipe[] {
  const list = [...getRecipes(), recipe];
  saveRecipes(list);
  return list;
}
export function updateRecipe(recipe: Recipe): Recipe[] {
  const list = getRecipes().map(r => r.id === recipe.id ? recipe : r);
  const cascadedList = cascadeRecipeUpdates(list);
  saveRecipes(cascadedList);
  return cascadedList;
}
export function deleteRecipe(id: string): Recipe[] {
  const list = getRecipes().filter(r => r.id !== id);
  saveRecipes(list);
  return list;
}

// Ingredients
export function getIngredients(): Ingredient[] { return getItem<Ingredient>(KEYS.ingredients); }
export function saveIngredients(ingredients: Ingredient[]): void { setItem(KEYS.ingredients, ingredients); }
export function addIngredient(ingredient: Ingredient): Ingredient[] {
  const list = [...getIngredients(), ingredient];
  saveIngredients(list);
  return list;
}
export function updateIngredient(ingredient: Ingredient): Ingredient[] {
  const list = getIngredients().map(i => i.id === ingredient.id ? ingredient : i);
  saveIngredients(list);
  return list;
}
export function deleteIngredient(id: string): Ingredient[] {
  const list = getIngredients().filter(i => i.id !== id);
  saveIngredients(list);
  return list;
}

// Spices
export function getSpices(): Spice[] { return getItem<Spice>(KEYS.spices); }
export function saveSpices(spices: Spice[]): void { setItem(KEYS.spices, spices); }
export function addSpice(spice: Spice): Spice[] {
  const list = [...getSpices(), spice];
  saveSpices(list);
  return list;
}
export function updateSpice(spice: Spice): Spice[] {
  const list = getSpices().map(s => s.id === spice.id ? spice : s);
  saveSpices(list);
  return list;
}
export function deleteSpice(id: string): Spice[] {
  const list = getSpices().filter(s => s.id !== id);
  saveSpices(list);
  return list;
}

// Orders
export function getOrders(): Order[] { return getItem<Order>(KEYS.orders); }
export function saveOrder(order: Order): Order[] {
  const list = [...getOrders().filter(o => o.id !== order.id), order];
  setItem(KEYS.orders, list);
  return list;
}
export function deleteOrder(id: string): Order[] {
  const list = getOrders().filter(o => o.id !== id);
  setItem(KEYS.orders, list);
  return list;
}

// Inventories
export function getInventories(): import('../types').Inventory[] {
  return getItem<import('../types').Inventory>('recipe_manager_inventories');
}
export function saveInventory(inv: import('../types').Inventory): import('../types').Inventory[] {
  const list = [...getInventories().filter(i => i.id !== inv.id), inv];
  setItem('recipe_manager_inventories', list);
  return list;
}
export function deleteInventory(id: string): import('../types').Inventory[] {
  const list = getInventories().filter(i => i.id !== id);
  setItem('recipe_manager_inventories', list);
  return list;
}
