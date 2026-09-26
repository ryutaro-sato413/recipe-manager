import { useState } from 'react';
import { Recipe, Ingredient, Spice } from './types';
import { getRecipes, getIngredients, getSpices } from './utils/storage';
import { exportData, importData } from './utils/export-import';
import { saveRecipes, saveIngredients, saveSpices } from './utils/storage';
import { useToast } from './hooks/useToast';
import Layout from './components/Layout/Layout';
import RecipeList from './components/RecipeList/RecipeList';
import IngredientMaster from './components/IngredientMaster/IngredientMaster';
import SpiceMaster from './components/SpiceMaster/SpiceMaster';
import OrderManagement from './components/OrderManagement/OrderManagement';
import InventoryManagement from './components/InventoryManagement/InventoryManagement';
import ToastContainer from './components/shared/Toast';

type Page = 'recipes' | 'ingredients' | 'spices' | 'orders' | 'inventory';

export default function App() {
  const [page, setPage] = useState<Page>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(getRecipes);
  const [ingredients, setIngredients] = useState<Ingredient[]>(getIngredients);
  const [spices, setSpices] = useState<Spice[]>(getSpices);
  const { toasts, addToast, removeToast } = useToast();

  const handleExport = () => {
    exportData(recipes, ingredients, spices);
    addToast('エクスポートしました');
  };

  const handleImport = async (file: File) => {
    try {
      const data = await importData(file);
      saveRecipes(data.recipes);
      saveIngredients(data.ingredients);
      saveSpices(data.spices);
      setRecipes(data.recipes);
      setIngredients(data.ingredients);
      setSpices(data.spices);
      addToast('インポートしました');
    } catch (e) {
      addToast((e as Error).message, 'error');
    }
  };

  return (
    <>
      <Layout currentPage={page} onNavigate={setPage} onExport={handleExport} onImport={handleImport}>
        {page === 'recipes' && (
          <RecipeList
            recipes={recipes}
            ingredients={ingredients}
            spices={spices}
            onRecipesChange={setRecipes}
            addToast={addToast}
          />
        )}
        {page === 'ingredients' && (
          <IngredientMaster
            ingredients={ingredients}
            recipes={recipes}
            onIngredientsChange={setIngredients}
            addToast={addToast}
          />
        )}
        {page === 'spices' && (
          <SpiceMaster
            spices={spices}
            onSpicesChange={setSpices}
            addToast={addToast}
          />
        )}
        {page === 'orders' && (
          <OrderManagement
            recipes={recipes}
            addToast={addToast}
          />
        )}
        {page === 'inventory' && (
          <InventoryManagement
            ingredients={ingredients}
            spices={spices}
            addToast={addToast}
          />
        )}
      </Layout>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
