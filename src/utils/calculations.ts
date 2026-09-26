import { Recipe, RecipeIngredient, RecipeSpice } from '../types';

export function calculateIngredientCost(ingredient: RecipeIngredient): number {
  return ingredient.amount * ingredient.unitPrice;
}

export function calculateSpiceCost(spice: RecipeSpice): number {
  return spice.amount * spice.unitPrice;
}

export function calculateTotalCost(recipe: Recipe): number {
  const ingredientTotal = recipe.ingredients.reduce(
    (sum, i) => sum + i.amount * i.unitPrice,
    0
  );
  const spiceTotal = recipe.spices.reduce(
    (sum, s) => sum + s.amount * s.unitPrice,
    0
  );
  const prepTotal = (recipe.prepItems ?? []).reduce(
    (sum, p) => sum + p.cost,
    0
  );
  return ingredientTotal + spiceTotal + prepTotal;
}

// 仕込み品レシピの単価を計算（原価 ÷ 歩留まり量）
export function calcPrepCostPerUnit(recipe: Recipe): number {
  if (!recipe.yieldAmount || recipe.yieldAmount <= 0) return 0;
  const totalCost = calculateTotalCost(recipe);
  return totalCost / recipe.yieldAmount;
}

export function calculateCostRate(cost: number, sellingPrice: number): number {
  if (sellingPrice <= 0) return 0;
  return (cost / sellingPrice) * 100;
}

export function getCostRateStatus(
  costRate: number,
  targetCostRate: number
): 'good' | 'warning' | 'danger' {
  if (costRate <= targetCostRate) return 'good';
  if (costRate <= targetCostRate * 1.1) return 'warning';
  return 'danger';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
