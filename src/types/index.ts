export type Category = 'food' | 'drink' | 'dessert' | 'other';

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

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  sellingPrice: number;
  targetCostRate: number;
  ingredients: RecipeIngredient[];
  spices: RecipeSpice[];
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

export interface OrderItem {
  recipeId: string;
  recipeName: string;
  category: string;
  quantity: number;
  sellingPrice: number;
  cost: number;
  costRate: number;
}

export interface Order {
  id: string;
  storeName: string;
  period: string;
  items: OrderItem[];
  totalFood: number;
  totalDrink: number;
  savedAt: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
