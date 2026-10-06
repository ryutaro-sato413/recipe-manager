import { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Beverage } from '../../types';
import { addBeverage, updateBeverage, deleteBeverage } from '../../utils/storage';
import { formatCurrency } from '../../utils/calculations';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';

interface BeverageMasterProps {
  beverages: Beverage[];
  onBeveragesChange: (beverages: Beverage[]) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyForm(): Omit<Beverage, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: '', unitPrice: 0, unit: '本', packageSize: 1, packagePrice: 0, supplier: '' };
}

export default function BeverageMaster({ beverages, onBeveragesChange, addToast }: BeverageMasterProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Beverage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Beverage | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = beverages.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(emptyForm()); setEditTarget(null); setErrors({}); setShowForm(true); };
  const openEdit = (bev: Beverage) => {
    setForm({ name: bev.name, unitPrice: bev.unitPrice, unit: bev.unit, packageSize: bev.packageSize, packagePrice: bev.packagePrice, supplier: bev.supplier });
    setEditTarget(bev);
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'ドリンク名は必須です';
    else {
      const duplicate = beverages.find(
        b => b.name.trim() === form.name.trim() && b.id !== editTarget?.id
      );
      if (duplicate) e.name = `「${form.name}」はすでに登録されています`;
    }
    if (form.unitPrice < 0) e.unitPrice = '単価は0以上の値を入力してください';
    if (!form.unit.trim()) e.unit = '単位は必須です';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    let updated: Beverage[];
    if (editTarget) {
      updated = updateBeverage({ ...editTarget, ...form, updatedAt: now });
      addToast(`「${form.name}」を更新しました`);
    } else {
      updated = addBeverage({ ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      addToast(`「${form.name}」を登録しました`);
    }
    onBeveragesChange(updated);
    setShowForm(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const updated = deleteBeverage(deleteTarget.id);
    onBeveragesChange(updated);
    addToast(`「${deleteTarget.name}」を削除しました`);
    setDeleteTarget(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">ドリンク管理（棚卸用）</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} />
          新規ドリンク登録
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="ドリンク名で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ドリンク名</th>
              <th>仕入先</th>
              <th>購入単価</th>
              <th>容量 / パッケージ</th>
              <th>単価（ml等）</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="empty-cell">ドリンクが登録されていません</td></tr>
            ) : (
              filtered.map(bev => (
                <tr key={bev.id}>
                  <td className="td-bold">{bev.name}</td>
                  <td>{bev.supplier || '—'}</td>
                  <td>{formatCurrency(bev.packagePrice)}</td>
                  <td>{bev.packageSize}{bev.unit}</td>
                  <td>{formatCurrency(bev.unitPrice)}/{bev.unit}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-icon" onClick={() => openEdit(bev)} title="編集"><Edit2 size={14} /></button>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(bev)} title="削除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editTarget ? 'ドリンク編集' : '新規ドリンク登録'} onClose={() => setShowForm(false)} size="md">
          <div className="form-layout">
            <div className="form-group">
              <label className="form-label">ドリンク名 <span className="required">*</span></label>
              <input className={`form-input${errors.name ? ' form-input-error' : ''}`} value={form.name}
                onChange={e => {
                  setForm(f => ({ ...f, name: e.target.value }));
                  if (errors.name) setErrors(e => ({ ...e, name: '' }));
                }} placeholder="例: 瓶ビール" />
              {errors.name && <p className="error-text">{errors.name}</p>}
              {!errors.name && form.name.trim() && beverages.some(b => b.name.trim() === form.name.trim() && b.id !== editTarget?.id) && (
                <p className="error-text">⚠️ この名前はすでに登録されています</p>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">購入単価（円）</label>
                <input type="number" className="form-input" value={form.packagePrice === 0 ? '' : form.packagePrice}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setForm(f => {
                      const next = { ...f, packagePrice: val };
                      if (next.packageSize > 0 && val >= 0) {
                        next.unitPrice = Math.round((val / next.packageSize) * 1000) / 1000;
                      }
                      return next;
                    });
                  }} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">入数・容量</label>
                <input type="number" className="form-input" value={form.packageSize === 0 ? '' : form.packageSize}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setForm(f => {
                      const next = { ...f, packageSize: val };
                      if (val > 0 && next.packagePrice >= 0) {
                        next.unitPrice = Math.round((next.packagePrice / val) * 1000) / 1000;
                      }
                      return next;
                    });
                  }} min="0" step="0.1" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">計算単価（円） <span className="required">*</span></label>
                <input type="number" className={`form-input${errors.unitPrice ? ' form-input-error' : ''}`}
                  value={form.unitPrice || ''} onChange={e => setForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} min="0" step="0.01" />
                {errors.unitPrice && <p className="error-text">{errors.unitPrice}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">単位 <span className="required">*</span></label>
                <input className={`form-input${errors.unit ? ' form-input-error' : ''}`} value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="ml / 本" />
                {errors.unit && <p className="error-text">{errors.unit}</p>}
              </div>
              <div className="form-group form-group-grow">
                <label className="form-label">仕入先</label>
                <input className="form-input" value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="例: 〇〇酒店" />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{editTarget ? '変更保存' : 'ドリンク登録'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`「${deleteTarget.name}」を本当に削除しますか？`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
