import { useState, useEffect } from 'react';
import { Recipe, Ingredient, Spice } from './types';
import { getRecipes, getIngredients, getSpices, getOrders, getInventories } from './utils/storage';
import { saveRecipes, saveIngredients, saveSpices } from './utils/storage';
import { exportData, importData } from './utils/export-import';
import { useToast } from './hooks/useToast';
import { getStoredConfig, getShopCode, initFirebase } from './lib/firebase';
import { loadAllFromCloud, upsertItem } from './lib/cloudStorage';
import Layout from './components/Layout/Layout';
import RecipeList from './components/RecipeList/RecipeList';
import IngredientMaster from './components/IngredientMaster/IngredientMaster';
import OrderManagement from './components/OrderManagement/OrderManagement';
import InventoryManagement from './components/InventoryManagement/InventoryManagement';
import Settings from './components/Settings/Settings';
import ToastContainer from './components/shared/Toast';
import { Order, Inventory } from './types';

type Page = 'recipes' | 'ingredients' | 'orders' | 'inventory' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(getRecipes);
  const [ingredients, setIngredients] = useState<Ingredient[]>(getIngredients);
  const [spices] = useState<Spice[]>(getSpices);
  const [orders] = useState<Order[]>(getOrders);
  const [inventories] = useState<Inventory[]>(getInventories);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // 起動時にFirebase設定があれば接続してクラウドデータを読み込む
  useEffect(() => {
    const config = getStoredConfig();
    const shopCode = getShopCode();
    if (config && shopCode) {
      try {
        initFirebase(config);
        loadAllFromCloud(shopCode).then(data => {
          if (data.recipes.length > 0 || data.ingredients.length > 0) {
            setRecipes(data.recipes);
            saveRecipes(data.recipes);
            setIngredients(data.ingredients);
            saveIngredients(data.ingredients);
            if (data.spices.length > 0) {
              saveSpices(data.spices);
            }
          }
          setIsCloudConnected(true);
        }).catch(err => {
          console.error('Cloud load failed:', err);
        });
      } catch (e) {
        console.error('Firebase init failed:', e);
      }
    }
  }, []);

  // クラウドへの同期ヘルパー
  const shopCode = getShopCode();

  const syncItem = async <T extends { id: string }>(col: string, item: T) => {
    if (!isCloudConnected || !shopCode) return;
    try { await upsertItem(shopCode, col, item); } catch { /* silent */ }
  };

  const handleRecipesChange = (updated: Recipe[]) => {
    setRecipes(updated);
    // 変更分だけ同期（最新の配列と以前の差分は取れないため全件同期）
    if (isCloudConnected && shopCode) {
      updated.forEach(r => syncItem('recipes', r));
    }
  };

  const handleIngredientsChange = (updated: Ingredient[]) => {
    setIngredients(updated);
    if (isCloudConnected && shopCode) {
      updated.forEach(i => syncItem('ingredients', i));
    }
  };

  const handleCloudLoad = (data: {
    recipes: Recipe[];
    ingredients: Ingredient[];
    spices: Spice[];
    orders: Order[];
    inventories: Inventory[];
  }) => {
    setRecipes(data.recipes);
    saveRecipes(data.recipes);
    setIngredients(data.ingredients);
    saveIngredients(data.ingredients);
    if (data.spices.length > 0) saveSpices(data.spices);
    setIsCloudConnected(true);
  };

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
      addToast('インポートしました');
    } catch (e) {
      addToast((e as Error).message, 'error');
    }
  };

  return (
    <>
      <Layout
        currentPage={page}
        onNavigate={setPage}
        onExport={handleExport}
        onImport={handleImport}
        isCloudConnected={isCloudConnected}
      >
        {page === 'recipes' && (
          <RecipeList
            recipes={recipes}
            ingredients={ingredients}
            spices={spices}
            onRecipesChange={handleRecipesChange}
            addToast={addToast}
          />
        )}
        {page === 'ingredients' && (
          <IngredientMaster
            ingredients={ingredients}
            recipes={recipes}
            onIngredientsChange={handleIngredientsChange}
            addToast={addToast}
          />
        )}
        {page === 'orders' && (
          <OrderManagement recipes={recipes} addToast={addToast} />
        )}
        {page === 'inventory' && (
          <InventoryManagement
            ingredients={ingredients}
            spices={spices}
            addToast={addToast}
          />
        )}
        {page === 'settings' && (
          <Settings
            recipes={recipes}
            ingredients={ingredients}
            spices={spices}
            orders={orders}
            inventories={inventories}
            onCloudLoad={handleCloudLoad}
            addToast={addToast}
          />
        )}
      </Layout>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
