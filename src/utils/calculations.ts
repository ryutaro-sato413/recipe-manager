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

// 依存関係のある仕込み品やレシピの価格を再帰的に更新する
export function cascadeRecipeUpdates(recipes: Recipe[]): Recipe[] {
  let updatedRecipes = [...recipes];
  let changed = true;
  let iterations = 0;
  
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    
    updatedRecipes = updatedRecipes.map(recipe => {
      if (!recipe.prepItems || recipe.prepItems.length === 0) return recipe;
      
      let recipeChanged = false;
      const newPrepItems = recipe.prepItems.map(prepItem => {
        const sourceRecipe = updatedRecipes.find(r => r.id === prepItem.recipeId);
        if (!sourceRecipe) return prepItem;
        
        const currentCostPerUnit = calcPrepCostPerUnit(sourceRecipe);
        const roundedCpu = Math.round(currentCostPerUnit * 100) / 100;
        const newCost = Math.round(prepItem.amount * roundedCpu * 100) / 100;
        
        if (prepItem.costPerUnit !== roundedCpu || prepItem.cost !== newCost || prepItem.recipeName !== sourceRecipe.name) {
          recipeChanged = true;
          return {
            ...prepItem,
            recipeName: sourceRecipe.name,
            costPerUnit: roundedCpu,
            cost: newCost,
            unit: sourceRecipe.yieldUnit || prepItem.unit
          };
        }
        return prepItem;
      });
      
      if (recipeChanged) {
        changed = true;
        return { ...recipe, prepItems: newPrepItems };
      }
      return recipe;
    });
  }
  
  return updatedRecipes;
}
