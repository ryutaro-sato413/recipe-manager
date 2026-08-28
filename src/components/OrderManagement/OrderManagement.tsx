import { useState } from 'react';
import { Plus, Trash2, Save, FolderOpen, Copy } from 'lucide-react';
import { Recipe, Order, OrderItem } from '../../types';
import { getOrders, saveOrder, deleteOrder } from '../../utils/storage';
import { calculateTotalCost, calculateCostRate, formatCurrency, formatPercent } from '../../utils/calculations';
import ConfirmDialog from '../shared/ConfirmDialog';

const CATEGORY_LABELS: Record<string, string> = {
  food: 'フード',
  drink: 'ドリンク',
  dessert: 'デザート',
  other: 'その他',
};

interface OrderManagementProps {
  recipes: Recipe[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function OrderManagement({ recipes, addToast }: OrderManagementProps) {
  const [storeName, setStoreName] = useState('');
  const [period, setPeriod] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [savedOrders, setSavedOrders] = useState<Order[]>(getOrders);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const addItem = () => {
    const recipe = recipes.find(r => r.id === selectedRecipeId);
    if (!recipe) return;
    if (items.find(i => i.recipeId === recipe.id)) {
      addToast('すでに追加されています', 'error');
      return;
    }
    const cost = calculateTotalCost(recipe);
    const costRate = calculateCostRate(cost, recipe.sellingPrice);
    setItems(prev => [...prev, {
      recipeId: recipe.id,
      recipeName: recipe.name,
      category: recipe.category,
      quantity: 1,
      sellingPrice: recipe.sellingPrice,
      cost,
      costRate,
    }]);
    setSelectedRecipeId('');
  };

  const updateQty = (recipeId: string, quantity: number) => {
    setItems(prev => prev.map(i => i.recipeId === recipeId ? { ...i, quantity } : i));
  };

  const removeItem = (recipeId: string) => {
    setItems(prev => prev.filter(i => i.recipeId !== recipeId));
  };

  const totalRevenue = items.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + i.cost * i.quantity, 0);
  const totalCostRate = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
  const foodRevenue = items.filter(i => i.category === 'food' || i.category === 'dessert').reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const drinkRevenue = items.filter(i => i.category === 'drink').reduce((s, i) => s + i.sellingPrice * i.quantity, 0);

  const handleSave = () => {
    if (!storeName.trim()) { addToast('対象店舗を入力してください', 'error'); return; }
    if (items.length === 0) { addToast('オーダー明細がありません', 'error'); return; }
    const order: Order = {
      id: crypto.randomUUID(),
      storeName,
      period,
      items,
      totalFood: foodRevenue,
      totalDrink: drinkRevenue,
      savedAt: new Date().toISOString(),
    };
    const updated = saveOrder(order);
    setSavedOrders(updated);
    addToast('オーダーデータを保存しました');
  };

  const handleLoad = (order: Order) => {
    setStoreName(order.storeName);
    setPeriod(order.period);
    setItems(order.items);
    addToast('オーダーデータを読み込みました');
  };

  const handleCopyPrev = () => {
    if (savedOrders.length === 0) { addToast('保存済みオーダーデータがありません', 'error'); return; }
    const last = savedOrders[savedOrders.length - 1];
    setItems(last.items.map(i => ({ ...i })));
    addToast('前回のオーダーデータをコピーしました');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const updated = deleteOrder(deleteTarget);
    setSavedOrders(updated);
    addToast('削除しました');
    setDeleteTarget(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">オーダー管理</h2>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleCopyPrev}>
            <Copy size={14} />
            前回コピー
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save size={14} />
            保存
          </button>
        </div>
      </div>

      <div className="order-meta">
        <div className="form-group">
          <label className="form-label">対象店舗</label>
          <input className="form-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="店舗名" />
        </div>
        <div className="form-group">
          <label className="form-label">対象期間</label>
          <input className="form-input" value={period} onChange={e => setPeriod(e.target.value)} placeholder="例: 2026年8月" />
        </div>
      </div>

      <div className="add-ingredient-row" style={{ marginBottom: '1rem' }}>
        <select className="form-select" value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}>
          <option value="">レシピを選択...</option>
          {recipes.map(r => (
            <option key={r.id} value={r.id}>{r.name}（{CATEGORY_LABELS[r.category]}）</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={addItem} disabled={!selectedRecipeId}>
          <Plus size={14} />
          追加
        </button>
      </div>

      {items.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>レシピ名</th>
                  <th>カテゴリ</th>
                  <th>数量</th>
                  <th>販売価格</th>
                  <th>売上</th>
                  <th>原価</th>
                  <th>原価率</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.recipeId}>
                    <td className="td-bold">{item.recipeName}</td>
                    <td><span className={`category-badge category-${item.category}`}>{CATEGORY_LABELS[item.category]}</span></td>
                    <td>
                      <input type="number" className="table-input" value={item.quantity}
                        onChange={e => updateQty(item.recipeId, Number(e.target.value))} min="0" />
                    </td>
                    <td>{formatCurrency(item.sellingPrice)}</td>
                    <td>{formatCurrency(item.sellingPrice * item.quantity)}</td>
                    <td>{formatCurrency(item.cost * item.quantity)}</td>
                    <td>{formatPercent(item.costRate)}</td>
                    <td>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => removeItem(item.recipeId)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="order-summary">
            <h3 className="summary-title">総合サマリー（フード＋ドリンク）</h3>
            <div className="summary-grid">
              <div className="summary-card">
                <span className="summary-card-label">総売上</span>
                <span className="summary-card-value">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">フード売上</span>
                <span className="summary-card-value">{formatCurrency(foodRevenue)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">ドリンク売上</span>
                <span className="summary-card-value">{formatCurrency(drinkRevenue)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">総原価</span>
                <span className="summary-card-value">{formatCurrency(totalCost)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-card-label">総原価率</span>
                <span className="summary-card-value">{formatPercent(totalCostRate)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {savedOrders.length > 0 && (
        <div className="saved-orders">
          <h3 className="section-title">保存済みオーダーデータ</h3>
          <div className="saved-order-list">
            {savedOrders.map(order => (
              <div key={order.id} className="saved-order-card">
                <div className="saved-order-info">
                  <span className="saved-order-store">{order.storeName}</span>
                  <span className="saved-order-period">{order.period}</span>
                  <span className="saved-order-date">{new Date(order.savedAt).toLocaleDateString('ja-JP')}</span>
                </div>
                <div className="action-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleLoad(order)}>
                    <FolderOpen size={14} />
                    読み込み
                  </button>
                  <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(order.id)}>
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
          message="このオーダーデータを削除しますか？"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
