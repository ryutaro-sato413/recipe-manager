export type Category = 'food' | 'drink' | 'prep';

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  unitPrice: number;
  cost: number;
}

export interface RecipeSpice {
  spiceId: string;
  name: string;
  amount: number;
  unit: string;
  unitPrice: number;
  cost: number;
}

// 仕込み品レシピを食材として使う場合
export interface RecipePrepItem {
  recipeId: string;
  recipeName: string;
  amount: number;       // 使用量
  unit: string;         // 単位
  costPerUnit: number;  // 仕込み品の単価（原価÷歩留まり量）
  cost: number;         // コスト（使用量×単価）
}

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  sellingPrice: number;
  targetCostRate: number;
  ingredients: RecipeIngredient[];
  spices: RecipeSpice[];
  prepItems: RecipePrepItem[];   // 仕込み品（サブレシピ）
  yieldAmount: number;           // 歩留まり量（仕込み品の場合：このレシピで何単位分作れるか）
  yieldUnit: string;             // 歩留まり単位
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  unit: string;
  packageSize: number;
  packagePrice: number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface Spice {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}



export interface Beverage {
  id: string;
  name: string;
  unitPrice: number;
  unit: string;
  packageSize: number;
  packagePrice: number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// 棚卸
export interface InventoryItem {
  id: string;
  ingredientId: string;
  name: string;
  unit: string;
  unitPrice: number;
  category: string;
  type: 'ingredient' | 'spice';
}

export interface InventoryEntry {
  itemId: string;
  name: string;
  unit: string;
  unitPrice: number;
  packageSize?: number;
  packagePrice?: number;
  quantity: number;
  value: number;
  category: string; // フード / ドリンク / その他
}

export interface Inventory {
  id: string;
  storeName: string;
  period: string;
  entries: InventoryEntry[];
  totalValue: number;
  foodValue: number;
  drinkValue: number;
  foodSales: number;
  drinkSales: number;
  foodPurchase: number;
  drinkPurchase: number;
  prevFoodInventory: number;
  prevDrinkInventory: number;
  savedAt: string;
}
