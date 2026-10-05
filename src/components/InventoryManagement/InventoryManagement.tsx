import { useState } from 'react';
import { Save, FolderOpen, Trash2, Copy, RefreshCw } from 'lucide-react';
import { Ingredient, Spice, Beverage, Inventory, InventoryEntry } from '../../types';
import { getInventories, saveInventory, deleteInventory } from '../../utils/storage';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import ConfirmDialog from '../shared/ConfirmDialog';

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

export default function InventoryManagement({ ingredients, spices, beverages, addToast }: InventoryManagementProps) {
  const [storeName, setStoreName] = useState('');
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

  const period = `${selectedYear}年${selectedMonth}月`;

  const foodEntries = entries.filter(e => e.category === 'フード');
  const drinkEntries = entries.filter(e => e.category === 'ドリンク');
  const otherEntries = entries.filter(e => e.category === 'その他');

  const foodValue = foodEntries.reduce((s, e) => s + e.value, 0);
  const drinkValue = drinkEntries.reduce((s, e) => s + e.value, 0);
  const otherValue = otherEntries.reduce((s, e) => s + e.value, 0);
  const totalValue = foodValue + drinkValue + otherValue;

  const foodCostRate = calcActualCostRate(prevFoodInventory, foodPurchase, foodValue, foodSales);
  const drinkCostRate = calcActualCostRate(prevDrinkInventory, drinkPurchase, drinkValue, drinkSales);

  // トータル実原価率
  const totalSales = foodSales + drinkSales;
  const totalCostRate = totalSales > 0
    ? ((prevFoodInventory + foodPurchase - foodValue + prevDrinkInventory + drinkPurchase - drinkValue) / totalSales) * 100
    : null;

  const handleReset = () => {
    setEntries(buildEntries(ingredients, spices, beverages));
    addToast('食材マスターの単価を反映しました', 'info');
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setEntries(prev =>
      prev.map(e => {
        if (e.itemId === itemId) {
          // packagePriceが設定されている場合はそれを使用し、無い場合は古いデータ互換のためunitPriceを使用
          const price = e.packagePrice !== undefined ? e.packagePrice : e.unitPrice;
          return { ...e, quantity, value: Math.round(quantity * price) };
        }
        return e;
      })
    );
  };

  const handleSave = () => {
    if (!storeName) { addToast('対象店舗を選択してください', 'error'); return; }
    const inv: Inventory = {
      id: crypto.randomUUID(),
      storeName,
      period,
      entries,
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
    addToast('棚卸データを保存しました');
  };

  const handleLoad = (inv: Inventory) => {
    setStoreName(inv.storeName);
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
        return { ...latest, quantity: saved.quantity, value: Math.round(saved.quantity * price) };
      }
      return latest;
    });
    setEntries(merged);
    addToast('棚卸データを読み込みました');
  };

  const handleCopyPrev = () => {
    if (savedInventories.length === 0) { addToast('保存済みの棚卸データがありません', 'error'); return; }
    const last = savedInventories[savedInventories.length - 1];
    handleLoad(last);
    addToast('前回の棚卸データをコピーしました');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const updated = deleteInventory(deleteTarget);
    setSavedInventories(updated);
    addToast('削除しました');
    setDeleteTarget(null);
  };

  const renderTable = (sectionEntries: InventoryEntry[], sectionTotal: number) => (
    <>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>食材名</th>
              <th>購入単位</th>
              <th>購入単価</th>
              <th>在庫数量</th>
              <th>在庫金額</th>
            </tr>
          </thead>
          <tbody>
            {sectionEntries.length === 0 ? (
              <tr><td colSpan={5} className="empty-cell">食材マスターに登録がありません</td></tr>
            ) : (
              sectionEntries.map(entry => {
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
                      value={entry.quantity === 0 ? '' : entry.quantity}
                      onChange={e => updateQuantity(entry.itemId, parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.1"
                      placeholder="0"
                    />
                  </td>
                  <td className={entry.value > 0 ? 'td-value-positive' : ''}>
                    {formatCurrency(entry.value)}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="inventory-section-total">
        <span>小計：</span>
        <strong>{formatCurrency(sectionTotal)}</strong>
      </div>
    </>
  );

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

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">棚卸管理</h2>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleCopyPrev}>
            <Copy size={14} />前回コピー
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RefreshCw size={14} />単価を最新に更新
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save size={14} />保存
          </button>
        </div>
      </div>

      {/* 店舗・期間 */}
      <div className="order-meta" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="form-group">
          <label className="form-label">対象店舗</label>
          <select className="form-select" value={storeName} onChange={e => setStoreName(e.target.value)}>
            <option value="">選択してください</option>
            {STORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">年</label>
          <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">月</label>
          <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 売上・仕入額・先月棚卸額入力 */}
      <div className="inventory-financial-grid">
        <div className="inventory-financial-card">
          <h4 className="inventory-financial-title">🍽️ フード</h4>
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
          <h4 className="inventory-financial-title">🍹 ドリンク</h4>
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

      {/* フード棚卸 */}
      <div className="inventory-section">
        <h3 className="inventory-section-title">🍽️ フード食材</h3>
        {renderTable(foodEntries, foodValue)}
      </div>

      {/* ドリンク棚卸 */}
      <div className="inventory-section">
        <h3 className="inventory-section-title">🍹 ドリンク食材</h3>
        {renderTable(drinkEntries, drinkValue)}
      </div>

      {/* その他 */}
      {otherEntries.length > 0 && (
        <div className="inventory-section">
          <h3 className="inventory-section-title">その他（スパイス等）</h3>
          {renderTable(otherEntries, otherValue)}
        </div>
      )}

      {/* 合計 */}
      <div className="inventory-total">
        <span className="inventory-total-label">棚卸合計金額</span>
        <span className="inventory-total-value">{formatCurrency(totalValue)}</span>
      </div>

      {/* 実原価率 */}
      <div className="cost-rate-results">
        <h3 className="section-title">📊 実原価率</h3>
        <div className="cost-rate-results-grid">
          {renderCostRateCard('フード', prevFoodInventory, foodPurchase, foodValue, foodSales, foodCostRate)}
          {renderCostRateCard('ドリンク', prevDrinkInventory, drinkPurchase, drinkValue, drinkSales, drinkCostRate)}
        </div>
        {/* トータル実原価率 */}
        <div className="cost-rate-result-card cost-rate-total-card">
          <div className="cost-rate-result-title">📊 フード＋ドリンク 合計実原価率</div>
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

      {/* 保存済みデータ */}
      {savedInventories.length > 0 && (
        <div className="saved-orders">
          <h3 className="section-title">保存済み棚卸データ</h3>
          <div className="saved-order-list">
            {savedInventories.map(inv => (
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
