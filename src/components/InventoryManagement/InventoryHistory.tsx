import { useState } from 'react';
import { FileText, Printer, Trash2, ArrowLeft } from 'lucide-react';
import { Inventory } from '../../types';
import { getInventories, deleteInventory } from '../../utils/storage';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import ConfirmDialog from '../shared/ConfirmDialog';

interface InventoryHistoryProps {
  onClose: () => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function InventoryHistory({ onClose, addToast }: InventoryHistoryProps) {
  const [inventories, setInventories] = useState<Inventory[]>(getInventories().sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
  const [selectedInv, setSelectedInv] = useState<Inventory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inventory | null>(null);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteInventory(deleteTarget.id);
    setInventories(getInventories().sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    addToast('履歴を削除しました');
    setDeleteTarget(null);
    if (selectedInv?.id === deleteTarget.id) setSelectedInv(null);
  };

  const handlePrint = () => {
    window.print();
  };

  if (selectedInv) {
    const foodCost = selectedInv.prevFoodInventory + selectedInv.foodPurchase - selectedInv.foodValue;
    const foodCostRate = selectedInv.foodSales > 0 ? (foodCost / selectedInv.foodSales) * 100 : 0;
    const drinkCost = selectedInv.prevDrinkInventory + selectedInv.drinkPurchase - selectedInv.drinkValue;
    const drinkCostRate = selectedInv.drinkSales > 0 ? (drinkCost / selectedInv.drinkSales) * 100 : 0;

    return (
      <div className="page">
        <div className="page-header">
          <button className="btn btn-secondary" onClick={() => setSelectedInv(null)}>
            <ArrowLeft size={16} /> 履歴一覧に戻る
          </button>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /> PDF出力 / 印刷
            </button>
          </div>
        </div>

        <div className="inventory-section">
          <h2 className="section-title">{selectedInv.storeName} - {selectedInv.period} 棚卸レポート</h2>
          <p className="inventory-note">保存日時: {new Date(selectedInv.savedAt).toLocaleString()}</p>
        </div>

        <div className="cost-rate-results">
          <div className="cost-rate-results-grid">
            <div className="cost-rate-result-card">
              <h4 className="cost-rate-result-title">🍽️ フード原価率</h4>
              <div className="cost-rate-result-rows">
                <div className="cost-rate-result-row"><span>売上:</span> <span>{formatCurrency(selectedInv.foodSales)}</span></div>
                <div className="cost-rate-result-row"><span>前月棚卸額:</span> <span>{formatCurrency(selectedInv.prevFoodInventory)}</span></div>
                <div className="cost-rate-result-row"><span>今月仕入額:</span> <span>{formatCurrency(selectedInv.foodPurchase)}</span></div>
                <div className="cost-rate-result-row"><span>今月棚卸額:</span> <span>{formatCurrency(selectedInv.foodValue)}</span></div>
                <div className="cost-rate-result-divider"></div>
                <div className="cost-rate-result-row"><span>当月実原価:</span> <span>{formatCurrency(foodCost)}</span></div>
                <div className="cost-rate-result-row cost-rate-result-highlight cost-rate-good">
                  <span>実原価率:</span> <span>{formatPercent(foodCostRate)}</span>
                </div>
              </div>
            </div>

            <div className="cost-rate-result-card">
              <h4 className="cost-rate-result-title">🍹 ドリンク原価率</h4>
              <div className="cost-rate-result-rows">
                <div className="cost-rate-result-row"><span>売上:</span> <span>{formatCurrency(selectedInv.drinkSales)}</span></div>
                <div className="cost-rate-result-row"><span>前月棚卸額:</span> <span>{formatCurrency(selectedInv.prevDrinkInventory)}</span></div>
                <div className="cost-rate-result-row"><span>今月仕入額:</span> <span>{formatCurrency(selectedInv.drinkPurchase)}</span></div>
                <div className="cost-rate-result-row"><span>今月棚卸額:</span> <span>{formatCurrency(selectedInv.drinkValue)}</span></div>
                <div className="cost-rate-result-divider"></div>
                <div className="cost-rate-result-row"><span>当月実原価:</span> <span>{formatCurrency(drinkCost)}</span></div>
                <div className="cost-rate-result-row cost-rate-result-highlight cost-rate-good">
                  <span>実原価率:</span> <span>{formatPercent(drinkCostRate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="inventory-section">
          <h3 className="section-title">棚卸内訳</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>カテゴリ</th>
                  <th>品名</th>
                  <th>単価</th>
                  <th>入力数量</th>
                  <th>在庫金額</th>
                </tr>
              </thead>
              <tbody>
                {selectedInv.entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{entry.category}</td>
                    <td className="td-bold">{entry.name}</td>
                    <td>{formatCurrency(entry.unitPrice)} / {entry.unit}</td>
                    <td>{entry.quantity} {entry.packageSize ? 'パッケージ' : entry.unit}</td>
                    <td className="td-value-positive">{formatCurrency(entry.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">棚卸履歴・PDF出力</h2>
        <button className="btn btn-secondary" onClick={onClose}>
          <ArrowLeft size={16} /> 入力画面に戻る
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>対象月</th>
              <th>店舗名</th>
              <th>棚卸合計額</th>
              <th>保存日時</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {inventories.length === 0 ? (
              <tr><td colSpan={5} className="empty-cell">保存された棚卸履歴がありません</td></tr>
            ) : (
              inventories.map(inv => (
                <tr key={inv.id}>
                  <td className="td-bold">{inv.period}</td>
                  <td>{inv.storeName}</td>
                  <td className="td-value-positive">{formatCurrency(inv.totalValue)}</td>
                  <td>{new Date(inv.savedAt).toLocaleString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-sm btn-primary" onClick={() => setSelectedInv(inv)}>
                        <FileText size={14} /> 詳細・PDF
                      </button>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(inv)} title="削除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message={`${deleteTarget.period} (${deleteTarget.storeName}) の棚卸履歴を削除しますか？この操作は取り消せません。`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
