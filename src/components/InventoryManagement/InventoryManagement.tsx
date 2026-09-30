import { useState } from 'react';
import { Save, FolderOpen, Trash2, Copy, RefreshCw } from 'lucide-react';
import { Ingredient, Spice, Inventory, InventoryEntry } from '../../types';
import { getInventories, saveInventory, deleteInventory } from '../../utils/storage';
import { formatCurrency } from '../../utils/calculations';
import ConfirmDialog from '../shared/ConfirmDialog';

interface InventoryManagementProps {
  ingredients: Ingredient[];
  spices: Spice[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function buildEntries(ingredients: Ingredient[], spices: Spice[]): InventoryEntry[] {
  const ingEntries: InventoryEntry[] = ingredients.map(ing => ({
    itemId: `ing-${ing.id}`,
    name: ing.name,
    unit: ing.unit,
    unitPrice: ing.unitPrice,
    quantity: 0,
    value: 0,
  }));
  const spiceEntries: InventoryEntry[] = spices.map(sp => ({
    itemId: `sp-${sp.id}`,
    name: sp.name,
    unit: sp.unit,
    unitPrice: sp.unitPrice,
    quantity: 0,
    value: 0,
  }));
  return [...ingEntries, ...spiceEntries];
}

const STORES = ['下北沢本店', '用賀', '渋谷', '下北沢南口'];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function InventoryManagement({ ingredients, spices, addToast }: InventoryManagementProps) {
  const [storeName, setStoreName] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [entries, setEntries] = useState<InventoryEntry[]>(() => buildEntries(ingredients, spices));
  const [savedInventories, setSavedInventories] = useState<Inventory[]>(getInventories);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const period = `${selectedYear}年${selectedMonth}月`;

  const totalValue = entries.reduce((sum, e) => sum + e.value, 0);

  // 食材マスターの最新単価を反映してリセット
  const handleReset = () => {
    setEntries(buildEntries(ingredients, spices));
    addToast('食材マスターの単価を反映しました', 'info');
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setEntries(prev =>
      prev.map(e =>
        e.itemId === itemId
          ? { ...e, quantity, value: Math.round(quantity * e.unitPrice * 100) / 100 }
          : e
      )
    );
  };

  const handleSave = () => {
    if (!storeName.trim()) { addToast('対象店舗を入力してください', 'error'); return; }
    if (!period.trim()) { addToast('対象期間を入力してください', 'error'); return; }
    const inv: Inventory = {
      id: crypto.randomUUID(),
      storeName,
      period,
      entries,
      totalValue,
      savedAt: new Date().toISOString(),
    };
    const updated = saveInventory(inv);
    setSavedInventories(updated);
    addToast('棚卸データを保存しました');
  };

  const handleLoad = (inv: Inventory) => {
    setStoreName(inv.storeName);
    // 保存されたperiod文字列（例: "2026年9月"）から年月を復元
    const match = inv.period.match(/(\d+)年(\d+)月/);
    if (match) {
      setSelectedYear(Number(match[1]));
      setSelectedMonth(Number(match[2]));
    }
    // 読み込み時に食材マスターの最新単価を上書き反映
    const latestEntries = buildEntries(ingredients, spices);
    const merged = latestEntries.map(latest => {
      const saved = inv.entries.find(e => e.itemId === latest.itemId);
      return saved
        ? { ...latest, quantity: saved.quantity, value: Math.round(saved.quantity * latest.unitPrice * 100) / 100 }
        : latest;
    });
    setEntries(merged);
    addToast('棚卸データを読み込みました（単価は最新に更新済み）');
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

  const ingEntries = entries.filter(e => e.itemId.startsWith('ing-'));
  const spiceEntries = entries.filter(e => e.itemId.startsWith('sp-'));

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">棚卸管理</h2>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleCopyPrev}>
            <Copy size={14} />
            前回コピー
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            <RefreshCw size={14} />
            単価を最新に更新
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save size={14} />
            保存
          </button>
        </div>
      </div>

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

      <div className="inventory-note">
        <p>💡 単価は食材マスター・スパイス管理に登録された原価を自動反映しています。「単価を最新に更新」ボタンで最新単価に同期できます。</p>
      </div>

      {/* 食材セクション */}
      {ingEntries.length > 0 && (
        <div className="inventory-section">
          <h3 className="inventory-section-title">食材</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>食材名</th>
                  <th>単価（原価）</th>
                  <th>単位</th>
                  <th>在庫数量</th>
                  <th>在庫金額</th>
                </tr>
              </thead>
              <tbody>
                {ingEntries.map(entry => (
                  <tr key={entry.itemId}>
                    <td className="td-bold">{entry.name}</td>
                    <td>{formatCurrency(entry.unitPrice)}/{entry.unit}</td>
                    <td>{entry.unit}</td>
                    <td>
                      <input
                        type="number"
                        className="table-input"
                        value={entry.quantity || ''}
                        onChange={e => updateQuantity(entry.itemId, Number(e.target.value))}
                        min="0"
                        step="0.1"
                        placeholder="0"
                      />
                    </td>
                    <td className={entry.value > 0 ? 'td-value-positive' : ''}>
                      {formatCurrency(entry.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* スパイスセクション */}
      {spiceEntries.length > 0 && (
        <div className="inventory-section">
          <h3 className="inventory-section-title">スパイス・調味料</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>スパイス名</th>
                  <th>単価（原価）</th>
                  <th>単位</th>
                  <th>在庫数量</th>
                  <th>在庫金額</th>
                </tr>
              </thead>
              <tbody>
                {spiceEntries.map(entry => (
                  <tr key={entry.itemId}>
                    <td className="td-bold">{entry.name}</td>
                    <td>{formatCurrency(entry.unitPrice)}/{entry.unit}</td>
                    <td>{entry.unit}</td>
                    <td>
                      <input
                        type="number"
                        className="table-input"
                        value={entry.quantity || ''}
                        onChange={e => updateQuantity(entry.itemId, Number(e.target.value))}
                        min="0"
                        step="0.1"
                        placeholder="0"
                      />
                    </td>
                    <td className={entry.value > 0 ? 'td-value-positive' : ''}>
                      {formatCurrency(entry.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 合計 */}
      <div className="inventory-total">
        <span className="inventory-total-label">棚卸合計金額</span>
        <span className="inventory-total-value">{formatCurrency(totalValue)}</span>
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
                    <FolderOpen size={14} />
                    読み込み
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
