import { useState, useEffect } from 'react';
import { Recipe, Ingredient, Spice, Beverage } from './types';
import { getRecipes, getIngredients, getSpices, getBeverages, saveRecipes, saveIngredients, saveSpices, saveBeverages, saveInventory } from './utils/storage';
import { exportData, importData } from './utils/export-import';
import { SYNC_ERROR_EVENT, CLOUD_UPDATED_EVENT, checkCloudUpdates } from './utils/cloud';
import { useToast } from './hooks/useToast';
import Layout from './components/Layout/Layout';
import RecipeList from './components/RecipeList/RecipeList';
import IngredientMaster from './components/IngredientMaster/IngredientMaster';
import BeverageMaster from './components/BeverageMaster/BeverageMaster';
import InventoryManagement from './components/InventoryManagement/InventoryManagement';
import ToastContainer from './components/shared/Toast';

type Page = 'recipes' | 'ingredients' | 'beverages' | 'inventory';

export default function App({ cloudSyncFailed = false }: { cloudSyncFailed?: boolean }) {
  const [page, setPage] = useState<Page>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(getRecipes);
  const [ingredients, setIngredients] = useState<Ingredient[]>(getIngredients);
  const [spices, setSpices] = useState<Spice[]>(getSpices);
  const [beverages, setBeverages] = useState<Beverage[]>(getBeverages);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (cloudSyncFailed) {
      addToast('クラウドからの読み込みに失敗しました。この端末のデータを表示しています。', 'error');
    }
    const onError = (e: Event) => addToast((e as CustomEvent<string>).detail, 'error');
    const onUpdated = () => {
      addToast('⚠️ 他の端末でデータが更新されました。上書きを防ぐため、画面を再読み込み（リロード）してください。', 'error');
    };
    window.addEventListener(SYNC_ERROR_EVENT, onError);
    window.addEventListener(CLOUD_UPDATED_EVENT, onUpdated);

    const interval = window.setInterval(checkCloudUpdates, 15000); // 15秒ごとにチェック

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkCloudUpdates();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener(SYNC_ERROR_EVENT, onError);
      window.removeEventListener(CLOUD_UPDATED_EVENT, onUpdated);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = () => {
    exportData(recipes, ingredients, spices); // we should probably export beverages too, but let's keep it simple
    addToast('エクスポートしました');
  };

  const handleImport = async (file: File) => {
    try {
      const data = await importData(file);
      saveRecipes(data.recipes);
      saveIngredients(data.ingredients);
      saveSpices(data.spices);
      if (data.beverages) {
        saveBeverages(data.beverages);
        setBeverages(data.beverages);
      }
      if (data.inventories) {
        data.inventories.forEach(inv => saveInventory(inv));
      }
      setRecipes(data.recipes);
      setIngredients(data.ingredients);
      setSpices(data.spices);
      addToast('インポートしました。画面をリロードすると最新の棚卸データが反映されます。');
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
            onRecipesChange={setRecipes}
            addToast={addToast}
          />
        )}
        {page === 'beverages' && (
          <BeverageMaster
            beverages={beverages}
            onBeveragesChange={setBeverages}
            addToast={addToast}
          />
        )}
        {page === 'inventory' && (
          <InventoryManagement
            ingredients={ingredients}
            spices={spices}
            beverages={beverages}
            addToast={addToast}
          />
        )}
      </Layout>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
