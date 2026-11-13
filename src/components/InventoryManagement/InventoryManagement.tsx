import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Copy, RefreshCw, Store, ArrowLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Ingredient, Spice, Beverage, Inventory, InventoryEntry } from '../../types';
import { getInventories, saveInventory, deleteInventory, getStoreHiddenItemIds, toggleStoreHiddenItem } from '../../utils/storage';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import ConfirmDialog from '../shared/ConfirmDialog';
import InventoryHistory from './InventoryHistory';

interface InventoryManagementProps {
  ingredients: Ingredient[];
  spices: Spice[];
  beverages: Beverage[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const STORES = ['下北沢本店', '用賀', '渋谷', '下北沢南口'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface StoreDraft {
  selectedYear: number;
  selectedMonth: number;
  entries: InventoryEntry[];
  foodSales: number;
  drinkSales: number;
  foodPurchase: number;
  drinkPurchase: number;
  prevFoodInventory: number;
  prevDrinkInventory: number;
}

// 食材カテゴリを正規化（フード/ドリンク/その他）
function normalizeCategory(cat: string): string {
  if (cat === 'フード') return 'フード';
  if (cat === 'ドリンク') return 'ドリンク';
  return 'その他';
}

function buildEntries(ingredients: Ingredient[], spices: Spice[], beverages: Beverage[]): InventoryEntry[] {
  const ingEntries: InventoryEntry[] = ingredients.map(ing => ({
    itemId: `ing-${ing.id}`,
    name: ing.name,
    unit: ing.unit,
    unitPrice: ing.unitPrice,
    packageSize: ing.packageSize || 1,
    packagePrice: ing.packagePrice || (ing.unitPrice * (ing.packageSize || 1)),
    quantity: 0,
    value: 0,
    category: normalizeCategory(ing.category),
  }));
  const bevEntries: InventoryEntry[] = beverages.map(bev => ({
    itemId: `bev-${bev.id}`,
    name: bev.name,
    unit: bev.unit,
    unitPrice: bev.unitPrice,
    packageSize: bev.packageSize || 1,
    packagePrice: bev.packagePrice || (bev.unitPrice * (bev.packageSize || 1)),
    quantity: 0,
    value: 0,
    category: 'ドリンク',
  }));
  const spiceEntries: InventoryEntry[] = spices.map(sp => ({
    itemId: `sp-${sp.id}`,
    name: sp.name,
    unit: sp.unit,
    unitPrice: sp.unitPrice,
    packageSize: 1,
    packagePrice: sp.unitPrice,
    quantity: 0,
    value: 0,
    category: 'その他',
  }));
  return [...ingEntries, ...bevEntries, ...spiceEntries];
}

function calcActualCostRate(prevInventory: number, purchase: number, currentInventory: number, sales: number): number | null {
  if (sales <= 0) return null;
  return ((prevInventory + purchase - currentInventory) / sales) * 100;
}

// 店舗・年月別下書きロード
function loadStorePeriodDraft(store: string, year: number, month: number): StoreDraft | null {
  if (!store) return null;
  try {
    const key = `recipe_manager_inventory_draft_${store}_${year}_${month}`;
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
    // 旧形式（店舗単位の下書き）があれば該当月のみ移行
    const legacyStore = localStorage.getItem(`recipe_manager_inventory_draft_${store}`);
    if (legacyStore) {
      const parsed = JSON.parse(legacyStore);
      if (parsed && parsed.selectedYear === year && parsed.selectedMonth === month) {
        return parsed;
      }
    }
    const legacyGlobal = localStorage.getItem('recipe_manager_inventory_draft');
    if (legacyGlobal) {
      const parsed = JSON.parse(legacyGlobal);
      if (parsed && parsed.storeName === store && parsed.selectedYear === year && parsed.selectedMonth === month) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

function loadLastStorePeriod(store: string): { year: number; month: number } {
  const defaultPeriod = { year: currentYear, month: new Date().getMonth() + 1 };
  if (!store) return defaultPeriod;
  try {
    const s = localStorage.getItem(`recipe_manager_inventory_last_period_${store}`);
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed?.year && parsed?.month) return parsed;
    }
    const legacyStore = localStorage.getItem(`recipe_manager_inventory_draft_${store}`);
    if (legacyStore) {
      const parsed = JSON.parse(legacyStore);
      if (parsed?.selectedYear && parsed?.selectedMonth) {
        return { year: parsed.selectedYear, month: parsed.selectedMonth };
      }
    }
  } catch (e) {}
  return defaultPeriod;
}

function hasAnyDraftValue(draft: StoreDraft | null): boolean {
  if (!draft) return false;
  if (
    draft.foodSales > 0 ||
    draft.drinkSales > 0 ||
    draft.foodPurchase > 0 ||
    draft.drinkPurchase > 0 ||
    draft.prevFoodInventory > 0 ||
    draft.prevDrinkInventory > 0
  ) {
    return true;
  }
  return Array.isArray(draft.entries) && draft.entries.some(e => (e.quantity || 0) > 0);
}

function mergeEntriesWithLatest(savedEntries: InventoryEntry[] | undefined, ingredients: Ingredient[], spices: Spice[], beverages: Beverage[]): InventoryEntry[] {
  const latest = buildEntries(ingredients, spices, beverages);
  if (!savedEntries) return latest;
  return latest.map(l => {
    const s = savedEntries.find((e: InventoryEntry) => e.itemId === l.itemId);
    if (s) {
      const q = s.quantity || 0;
      const price = l.packagePrice !== undefined ? l.packagePrice : l.unitPrice;
      return { ...l, quantity: q, rawQuantity: s.rawQuantity, value: Math.round(q * price) };
    }
    return l;
  });
}

export default function InventoryManagement({ ingredients, spices, beverages, addToast }: InventoryManagementProps) {
  const [viewMode, setViewMode] = useState<'input' | 'history'>('input');
  const [activeTab, setActiveTab] = useState<'summary' | 'food' | 'drink' | 'other'>('summary');
  const [storeName, setStoreName] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [entries, setEntries] = useState<InventoryEntry[]>(() => buildEntries(ingredients, spices, beverages));
  const [foodSales, setFoodSales] = useState<number>(0);
  const [drinkSales, setDrinkSales] = useState<number>(0);
  const [foodPurchase, setFoodPurchase] = useState<number>(0);
  const [drinkPurchase, setDrinkPurchase] = useState<number>(0);
  const [prevFoodInventory, setPrevFoodInventory] = useState<number>(0);
  const [prevDrinkInventory, setPrevDrinkInventory] = useState<number>(0);
  const [savedInventories, setSavedInventories] = useState<Inventory[]>(getInventories);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // 指定した店舗・年・月のデータ（下書き または 保存済みデータ、無ければ初期値0）を画面に反映する
  const applyStorePeriod = (
    targetStore: string,
    targetYear: number,
    targetMonth: number,
    invList: Inventory[] = savedInventories
  ) => {
    const draft = loadStorePeriodDraft(targetStore, targetYear, targetMonth);
    const targetPeriod = `${targetYear}年${targetMonth}月`;
    const savedForPeriod = invList
      .filter(inv => inv.storeName === targetStore && inv.period === targetPeriod)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];

    setStoreName(targetStore);
    setSelectedYear(targetYear);
    setSelectedMonth(targetMonth);

    if (hasAnyDraftValue(draft)) {
      setEntries(mergeEntriesWithLatest(draft!.entries, ingredients, spices, beverages));
      setFoodSales(draft!.foodSales ?? 0);
      setDrinkSales(draft!.drinkSales ?? 0);
      setFoodPurchase(draft!.foodPurchase ?? 0);
      setDrinkPurchase(draft!.drinkPurchase ?? 0);
      setPrevFoodInventory(draft!.prevFoodInventory ?? 0);
      setPrevDrinkInventory(draft!.prevDrinkInventory ?? 0);
    } else if (savedForPeriod) {
      setEntries(mergeEntriesWithLatest(savedForPeriod.entries, ingredients, spices, beverages));
      setFoodSales(savedForPeriod.foodSales ?? 0);
      setDrinkSales(savedForPeriod.drinkSales ?? 0);
      setFoodPurchase(savedForPeriod.foodPurchase ?? 0);
      setDrinkPurchase(savedForPeriod.drinkPurchase ?? 0);
      setPrevFoodInventory(savedForPeriod.prevFoodInventory ?? 0);
      setPrevDrinkInventory(savedForPeriod.prevDrinkInventory ?? 0);
    } else {
      // まだ入力も保存もされていない月はすべて0からスタート（前月の数字を残さない）
      setEntries(buildEntries(ingredients, spices, beverages));
      setFoodSales(0);
      setDrinkSales(0);
      setFoodPurchase(0);
      setDrinkPurchase(0);
      setPrevFoodInventory(0);
      setPrevDrinkInventory(0);
    }
  };

  // 店舗を選択した際に、その店舗の最後に開いていた年月のデータを読み込む
  const handleSelectStore = (targetStore: string) => {
    const last = loadLastStorePeriod(targetStore);
    setHiddenItemIds(getStoreHiddenItemIds(targetStore));
    setShowHidden(false);
    applyStorePeriod(targetStore, last.year, last.month);
    setActiveTab('summary');
  };

  // 年・月を切り替えた際に、その年月のデータを読み込む（未入力月なら0にリセット）
  const handleChangeYear = (newYear: number) => {
    if (!storeName) return;
    applyStorePeriod(storeName, newYear, selectedMonth);
  };

  const handleChangeMonth = (newMonth: number) => {
    if (!storeName) return;
    applyStorePeriod(storeName, selectedYear, newMonth);
  };

  // 店舗・年月ごとの下書き自動保存
  useEffect(() => {
    if (!storeName) return;
    const d: StoreDraft = {
      selectedYear,
      selectedMonth,
      entries,
      foodSales,
      drinkSales,
      foodPurchase,
      drinkPurchase,
      prevFoodInventory,
      prevDrinkInventory,
    };
    localStorage.setItem(`recipe_manager_inventory_draft_${storeName}_${selectedYear}_${selectedMonth}`, JSON.stringify(d));
    localStorage.setItem(`recipe_manager_inventory_last_period_${storeName}`, JSON.stringify({ year: selectedYear, month: selectedMonth }));
  }, [storeName, selectedYear, selectedMonth, entries, foodSales, drinkSales, foodPurchase, drinkPurchase, prevFoodInventory, prevDrinkInventory]);

  const period = `${selectedYear}年${selectedMonth}月`;
  const hiddenSet = new Set(hiddenItemIds);
  const visibleEntries = entries.filter(e => !hiddenSet.has(e.itemId));

  const foodEntries = visibleEntries.filter(e => e.category === 'フード');
  const drinkEntries = visibleEntries.filter(e => e.category === 'ドリンク');
  const otherEntries = visibleEntries.filter(e => e.category === 'その他');

  const allFoodEntries = entries.filter(e => e.category === 'フード');
  const allDrinkEntries = entries.filter(e => e.category === 'ドリンク');
  const allOtherEntries = entries.filter(e => e.category === 'その他');

  const handleToggleHidden = (entry: InventoryEntry, hide: boolean) => {
    if (!storeName) return;
    const nextIds = toggleStoreHiddenItem(storeName, entry.itemId, hide);
    setHiddenItemIds(nextIds);
    addToast(
      hide
        ? `「${entry.name}」を${storeName}の棚卸から非表示にしました`
        : `「${entry.name}」を${storeName}の棚卸に再表示しました`,
      'info'
    );
  };

  const foodValue = foodEntries.reduce((s, e) => s + e.value, 0);
  const drinkValue = drinkEntries.reduce((s, e) => s + e.value, 0);
  const otherValue = otherEntries.reduce((s, e) => s + e.value, 0);
  const totalValue = foodValue + drinkValue + otherValue;

  const foodCostRate = calcActualCostRate(prevFoodInventory, foodPurchase, foodValue, foodSales);
  const drinkCostRate = calcActualCostRate(prevDrinkInventory, drinkPurchase, drinkValue, drinkSales);

  const totalSales = foodSales + drinkSales;
  const totalCostRate = totalSales > 0
    ? ((prevFoodInventory + foodPurchase - foodValue + prevDrinkInventory + drinkPurchase - drinkValue) / totalSales) * 100
    : null;

  const storeSavedInventories = savedInventories
    .filter(inv => inv.storeName === storeName)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const handleReset = () => {
    setEntries(mergeEntriesWithLatest(entries, ingredients, spices, beverages));
    addToast('入力数量を維持したまま、単価を最新に更新しました', 'info');
  };

  const updateQuantity = (itemId: string, rawVal: string) => {
    const parsed = parseFloat(rawVal);
    const quantity = isNaN(parsed) ? 0 : parsed;
    setEntries(prev =>
      prev.map(e => {
        if (e.itemId === itemId) {
          const price = e.packagePrice !== undefined ? e.packagePrice : e.unitPrice;
          return { ...e, quantity, rawQuantity: rawVal, value: Math.round(quantity * price) };
        }
        return e;
      })
    );
  };

  const handleSave = () => {
    if (!storeName) { addToast('対象店舗を選択してください', 'error'); return; }
    // 同じ店舗・同じ年月の保存済みデータがあればそのIDを引き継いで上書き更新する
    const existingSamePeriod = savedInventories.find(
      i => i.storeName === storeName && i.period === period
    );
    const inv: Inventory = {
      id: existingSamePeriod?.id ?? crypto.randomUUID(),
      storeName,
      period,
      entries: visibleEntries,
      totalValue,
      foodValue,
      drinkValue,
      foodSales,
      drinkSales,
      foodPurchase,
      drinkPurchase,
      prevFoodInventory,
      prevDrinkInventory,
      savedAt: new Date().toISOString(),
    };
    const updated = saveInventory(inv);
    setSavedInventories(updated);
    addToast(`「${storeName}（${period}）」の棚卸データを保存しました`);
  };

  const handleLoad = (inv: Inventory) => {
    setStoreName(inv.storeName);
    setHiddenItemIds(getStoreHiddenItemIds(inv.storeName));
    const match = inv.period.match(/(\d+)年(\d+)月/);
    if (match) {
      setSelectedYear(Number(match[1]));
      setSelectedMonth(Number(match[2]));
    }
    setFoodSales(inv.foodSales ?? 0);
    setDrinkSales(inv.drinkSales ?? 0);
    setFoodPurchase(inv.foodPurchase ?? 0);
    setDrinkPurchase(inv.drinkPurchase ?? 0);
    setPrevFoodInventory(inv.prevFoodInventory ?? 0);
    setPrevDrinkInventory(inv.prevDrinkInventory ?? 0);
    const latestEntries = buildEntries(ingredients, spices, beverages);
    const merged = latestEntries.map(latest => {
      const saved = inv.entries.find(e => e.itemId === latest.itemId);
      if (saved) {
        const price = latest.packagePrice !== undefined ? latest.packagePrice : latest.unitPrice;
        return { ...latest, quantity: saved.quantity, rawQuantity: saved.rawQuantity, value: Math.round(saved.quantity * price) };
      }
      return latest;
    });
    setEntries(merged);
    addToast(`「${inv.storeName}（${inv.period}）」のデータを読み込みました`);
  };

  const handleCopyPrev = () => {
    const others = storeSavedInventories.filter(inv => inv.period !== period);
    const source = others[0] ?? storeSavedInventories[0];
    if (!source) {
      addToast(`「${storeName}」の保存済み棚卸データがありません`, 'error');
      return;
    }
    setEntries(mergeEntriesWithLatest(source.entries, ingredients, spices, beverages));
    setPrevFoodInventory(source.foodValue ?? 0);
    setPrevDrinkInventory(source.drinkValue ?? 0);
    addToast(`「${storeName}」の${source.period}データを${period}へコピーしました`);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const targetInv = savedInventories.find(i => i.id === deleteTarget);
    const updated = deleteInventory(deleteTarget);
    setSavedInventories(updated);
    if (targetInv) {
      const m = targetInv.period.match(/(\d+)年(\d+)月/);
      if (m) {
        localStorage.removeItem(`recipe_manager_inventory_draft_${targetInv.storeName}_${Number(m[1])}_${Number(m[2])}`);
      }
    }
    addToast('削除しました');
    setDeleteTarget(null);
  };

  const renderTable = (allCategoryEntries: InventoryEntry[], sectionTotal: number) => {
    const visibleList = allCategoryEntries.filter(e => !hiddenSet.has(e.itemId));
    const hiddenList = allCategoryEntries.filter(e => hiddenSet.has(e.itemId));

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            表示中: <strong>{visibleList.length}件</strong>
            {hiddenList.length > 0 && ` / 非表示: ${hiddenList.length}件（${storeName}のみ）`}
          </span>
          {hiddenList.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowHidden(prev => !prev)}
            >
              {showHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              {showHidden ? '非表示の食材を隠す' : `非表示の食材を管理（${hiddenList.length}件）`}
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>食材名</th>
                <th>購入単位</th>
                <th>購入単価</th>
                <th>在庫数量</th>
                <th>在庫金額</th>
                <th style={{ width: '90px', textAlign: 'center' }}>店舗表示</th>
              </tr>
            </thead>
            <tbody>
              {visibleList.length === 0 ? (
                <tr><td colSpan={6} className="empty-cell">表示中の食材がありません</td></tr>
              ) : (
                visibleList.map(entry => {
                  const isPackage = entry.packageSize !== undefined && entry.packageSize !== 1;
                  const unitStr = isPackage ? `${entry.packageSize}${entry.unit}` : entry.unit;
                  const price = entry.packagePrice !== undefined ? entry.packagePrice : entry.unitPrice;
                  return (
                    <tr key={entry.itemId}>
                      <td className="td-bold">{entry.name}</td>
                      <td>{unitStr} / 箱・本</td>
                      <td>{formatCurrency(price)}</td>
                      <td>
                        <input
                          type="number"
                          className="table-input"
                          value={entry.rawQuantity !== undefined ? entry.rawQuantity : (entry.quantity === 0 ? '' : entry.quantity)}
                          onChange={e => updateQuantity(entry.itemId, e.target.value)}
                          min="0"
                          step="0.1"
                          placeholder="0"
                        />
                      </td>
                      <td className={entry.value > 0 ? 'td-value-positive' : ''}>
                        {formatCurrency(entry.value)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleHidden(entry, true)}
                          title={`${storeName}の棚卸から非表示にする`}
                        >
                          <EyeOff size={14} /> 非表示
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showHidden && hiddenList.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              🙈 {storeName} で非表示中の項目（{hiddenList.length}件）
            </h4>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>食材名</th>
                    <th>購入単位</th>
                    <th>購入単価</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {hiddenList.map(entry => {
                    const isPackage = entry.packageSize !== undefined && entry.packageSize !== 1;
                    const unitStr = isPackage ? `${entry.packageSize}${entry.unit}` : entry.unit;
                    const price = entry.packagePrice !== undefined ? entry.packagePrice : entry.unitPrice;
                    return (
                      <tr key={entry.itemId} style={{ opacity: 0.65 }}>
                        <td className="td-bold">{entry.name}</td>
                        <td>{unitStr} / 箱・本</td>
                        <td>{formatCurrency(price)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleToggleHidden(entry, false)}
                          >
                            <Eye size={14} /> 再表示
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="inventory-section-total">
          <span>小計：</span>
          <strong>{formatCurrency(sectionTotal)}</strong>
        </div>
      </>
    );
  };

  const renderCostRateCard = (
    label: string,
    prevInv: number,
    purchase: number,
    currentInv: number,
    sales: number,
    costRate: number | null
  ) => (
    <div className="cost-rate-result-card">
      <div className="cost-rate-result-title">{label} 実原価率</div>
      <div className="cost-rate-result-rows">
        <div className="cost-rate-result-row">
          <span>先月棚卸額</span><span>{formatCurrency(prevInv)}</span>
        </div>
        <div className="cost-rate-result-row">
          <span>今月仕入額</span><span>{formatCurrency(purchase)}</span>
        </div>
        <div className="cost-rate-result-row">
          <span>今月棚卸額</span><span>{formatCurrency(currentInv)}</span>
        </div>
        <div className="cost-rate-result-row">
          <span>売上</span><span>{formatCurrency(sales)}</span>
        </div>
        <div className="cost-rate-result-divider" />
        <div className="cost-rate-result-row cost-rate-result-highlight">
          <span>実原価率</span>
          <span className={
            costRate === null ? '' :
            costRate <= 30 ? 'cost-rate-good' :
            costRate <= 35 ? 'cost-rate-warning' : 'cost-rate-danger'
          }>
            {costRate === null ? '（売上未入力）' : formatPercent(costRate)}
          </span>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'history') {
    return (
      <InventoryHistory
        initialStore={storeName || undefined}
        onClose={() => setViewMode('input')}
        addToast={addToast}
      />
    );
  }

  // 1. 初期画面：店舗選択画面（ボタン式）
  if (!storeName) {
    return (
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">棚卸管理 - 店舗選択</h2>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => setViewMode('history')}>
              <FolderOpen size={16} /> 全店舗の履歴・PDF出力
            </button>
          </div>
        </div>

        <div className="inventory-note">
          <p>🏢 棚卸の入力・確認を行う店舗を選択してください。店舗ごとに売上・仕入・在庫データおよび入力途中の下書きが個別に管理されます。</p>
        </div>

        <div className="store-select-grid">
          {STORES.map(store => {
            const lastPeriod = loadLastStorePeriod(store);
            const draft = loadStorePeriodDraft(store, lastPeriod.year, lastPeriod.month);
            const storeHiddenSet = new Set(getStoreHiddenItemIds(store));
            const mergedDraftEntries = draft ? mergeEntriesWithLatest(draft.entries, ingredients, spices, beverages) : [];
            const draftTotal = mergedDraftEntries.filter(e => !storeHiddenSet.has(e.itemId)).reduce((s, e) => s + e.value, 0);
            const hasDraft = hasAnyDraftValue(draft);
            const storeHistory = savedInventories
              .filter(inv => inv.storeName === store)
              .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
            const latestSaved = storeHistory[0];

            return (
              <button
                key={store}
                type="button"
                className="store-select-card"
                onClick={() => handleSelectStore(store)}
              >
                <div className="store-select-card-header">
                  <div className="store-select-title-group">
                    <span className="store-select-icon">
                      <Store size={22} />
                    </span>
                    <span className="store-select-name">{store}</span>
                  </div>
                  <ChevronRight size={20} className="store-select-arrow" />
                </div>

                <div className="store-select-card-body">
                  {hasDraft ? (
                    <div className="store-status-badge store-status-draft">
                      📝 入力中データあり（{draft?.selectedYear}年{draft?.selectedMonth}月 / 棚卸計: {formatCurrency(draftTotal)}）
                    </div>
                  ) : (
                    <div className="store-status-badge store-status-empty">
                      新規入力・編集が可能
                    </div>
                  )}

                  <div className="store-select-meta">
                    {latestSaved ? (
                      <>
                        <span>最終保存: <strong>{latestSaved.period}</strong></span>
                        <span>棚卸高: <strong>{formatCurrency(latestSaved.totalValue)}</strong></span>
                      </>
                    ) : (
                      <span>保存履歴: なし</span>
                    )}
                  </div>
                </div>

                <div className="store-select-card-footer">
                  <span>{store} の棚卸画面を開く</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. カテゴリ別在庫入力画面（フード / ドリンク / その他）
  if (activeTab === 'food') {
    return (
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">🍽️ 【{storeName}】フード在庫入力（{period}）</h2>
          <button className="btn btn-secondary" onClick={() => { setActiveTab('summary'); setShowHidden(false); }}>
            ← {storeName} のサマリーに戻る
          </button>
        </div>
        <div className="inventory-section">
          {renderTable(allFoodEntries, foodValue)}
        </div>
      </div>
    );
  }

  if (activeTab === 'drink') {
    return (
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">🍹 【{storeName}】ドリンク在庫入力（{period}）</h2>
          <button className="btn btn-secondary" onClick={() => { setActiveTab('summary'); setShowHidden(false); }}>
            ← {storeName} のサマリーに戻る
          </button>
        </div>
        <div className="inventory-section">
          {renderTable(allDrinkEntries, drinkValue)}
        </div>
      </div>
    );
  }

  if (activeTab === 'other') {
    return (
      <div className="page">
        <div className="page-header">
          <h2 className="page-title">📦 【{storeName}】その他在庫入力（{period}）</h2>
          <button className="btn btn-secondary" onClick={() => { setActiveTab('summary'); setShowHidden(false); }}>
            ← {storeName} のサマリーに戻る
          </button>
        </div>
        <div className="inventory-section">
          {renderTable(allOtherEntries, otherValue)}
        </div>
      </div>
    );
  }

  // 3. 選択した店舗の棚卸管理サマリー画面
  return (
    <div className="page">
      {/* 店舗切り替え＆戻るバー */}
      <div className="store-Select-topbar">
        <button className="btn btn-secondary btn-sm" onClick={() => setStoreName('')}>
          <ArrowLeft size={14} /> 店舗選択に戻る
        </button>
        <div className="store-switcher-pills">
          {STORES.map(s => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${storeName === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleSelectStore(s)}
            >
              🏢 {s}
            </button>
          ))}
        </div>
      </div>

      <div className="page-header">
        <h2 className="page-title">🏢 {storeName} - 棚卸管理</h2>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setViewMode('history')}>
            <FolderOpen size={14} />履歴・PDF出力
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyPrev}>
            <Copy size={14} />前回コピー
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RefreshCw size={14} />単価最新化
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save size={14} />保存
          </button>
        </div>
      </div>

      {/* 対象期間（年・月） */}
      <div className="order-meta" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="form-group">
          <label className="form-label">対象年</label>
          <select className="form-select" value={selectedYear} onChange={e => handleChangeYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">対象月</label>
          <select className="form-select" value={selectedMonth} onChange={e => handleChangeMonth(Number(e.target.value))}>
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 売上・仕入額・先月棚卸額入力 */}
      <div className="inventory-financial-grid">
        <div className="inventory-financial-card">
          <h4 className="inventory-financial-title">🍽️ フード（{storeName}）</h4>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">今月売上（円）</label>
              <input type="number" className="form-input"
                value={foodSales || ''} onChange={e => setFoodSales(parseFloat(e.target.value) || 0)}
                min="0" placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">今月仕入額（円）</label>
              <input type="number" className="form-input"
                value={foodPurchase || ''} onChange={e => setFoodPurchase(parseFloat(e.target.value) || 0)}
                min="0" placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">先月棚卸額（円）</label>
              <input type="number" className="form-input"
                value={prevFoodInventory || ''} onChange={e => setPrevFoodInventory(parseFloat(e.target.value) || 0)}
                min="0" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="inventory-financial-card">
          <h4 className="inventory-financial-title">🍹 ドリンク（{storeName}）</h4>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">今月売上（円）</label>
              <input type="number" className="form-input"
                value={drinkSales || ''} onChange={e => setDrinkSales(parseFloat(e.target.value) || 0)}
                min="0" placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">今月仕入額（円）</label>
              <input type="number" className="form-input"
                value={drinkPurchase || ''} onChange={e => setDrinkPurchase(parseFloat(e.target.value) || 0)}
                min="0" placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">先月棚卸額（円）</label>
              <input type="number" className="form-input"
                value={prevDrinkInventory || ''} onChange={e => setPrevDrinkInventory(parseFloat(e.target.value) || 0)}
                min="0" placeholder="0" />
            </div>
          </div>
        </div>
      </div>

      <div className="inventory-note">
        <p>💡 実原価率 = (前月棚卸額 ＋ 今月仕入額 − 今月棚卸額) ÷ 今月売上 × 100</p>
      </div>

      {/* 棚卸入力へのナビゲーション */}
      <div className="inventory-section">
        <h3 className="section-title">📦 今月棚卸額の入力（{storeName}）</h3>
        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>🍽️ フード在庫</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>小計: {formatCurrency(foodValue)}</div>
            </div>
            <button className="btn btn-primary" onClick={() => setActiveTab('food')}>
              フード在庫を入力 →
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>🍹 ドリンク在庫</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>小計: {formatCurrency(drinkValue)}</div>
            </div>
            <button className="btn btn-primary" onClick={() => setActiveTab('drink')}>
              ドリンク在庫を入力 →
            </button>
          </div>

          {allOtherEntries.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>📦 その他在庫（スパイス等）</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>小計: {formatCurrency(otherValue)}</div>
              </div>
              <button className="btn btn-primary" onClick={() => setActiveTab('other')}>
                その他在庫を入力 →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 合計 */}
      <div className="inventory-total">
        <span className="inventory-total-label">{storeName} 棚卸合計金額</span>
        <span className="inventory-total-value">{formatCurrency(totalValue)}</span>
      </div>

      {/* 実原価率 */}
      <div className="cost-rate-results">
        <h3 className="section-title">📊 実原価率（{storeName}）</h3>
        <div className="cost-rate-results-grid">
          {renderCostRateCard('フード', prevFoodInventory, foodPurchase, foodValue, foodSales, foodCostRate)}
          {renderCostRateCard('ドリンク', prevDrinkInventory, drinkPurchase, drinkValue, drinkSales, drinkCostRate)}
        </div>
        {/* トータル実原価率 */}
        <div className="cost-rate-result-card cost-rate-total-card">
          <div className="cost-rate-result-title">📊 フード＋ドリンク 合計実原価率（{storeName}）</div>
          <div className="cost-rate-result-rows">
            <div className="cost-rate-result-row">
              <span>合計売上</span><span>{formatCurrency(totalSales)}</span>
            </div>
            <div className="cost-rate-result-row">
              <span>合計仕入額</span><span>{formatCurrency(foodPurchase + drinkPurchase)}</span>
            </div>
            <div className="cost-rate-result-row">
              <span>合計今月棚卸額</span><span>{formatCurrency(foodValue + drinkValue)}</span>
            </div>
            <div className="cost-rate-result-divider" />
            <div className="cost-rate-result-row cost-rate-result-highlight">
              <span>合計実原価率</span>
              <span className={
                totalCostRate === null ? '' :
                totalCostRate <= 30 ? 'cost-rate-good' :
                totalCostRate <= 35 ? 'cost-rate-warning' : 'cost-rate-danger'
              }>
                {totalCostRate === null ? '（売上未入力）' : formatPercent(totalCostRate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 保存済みデータ（選択店舗のみ表示） */}
      {storeSavedInventories.length > 0 && (
        <div className="saved-orders">
          <h3 className="section-title">📁 {storeName} の保存済み棚卸データ</h3>
          <div className="saved-order-list">
            {storeSavedInventories.map(inv => (
              <div key={inv.id} className="saved-order-card">
                <div className="saved-order-info">
                  <span className="saved-order-store">{inv.storeName}</span>
                  <span className="saved-order-period">{inv.period}</span>
                  <span className="saved-order-date">{new Date(inv.savedAt).toLocaleDateString('ja-JP')}</span>
                  <span className="saved-order-total">{formatCurrency(inv.totalValue)}</span>
                </div>
                <div className="action-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleLoad(inv)}>
                    <FolderOpen size={14} />読み込み
                  </button>
                  <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(inv.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message="この棚卸データを削除しますか？"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
