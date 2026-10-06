import { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Spice } from '../../types';
import { addSpice, updateSpice, deleteSpice } from '../../utils/storage';
import { formatCurrency } from '../../utils/calculations';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';

interface SpiceMasterProps {
  spices: Spice[];
  onSpicesChange: (spices: Spice[]) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyForm(): Omit<Spice, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: '', category: '', unitPrice: 0, unit: 'g' };
}

export default function SpiceMaster({ spices, onSpicesChange, addToast }: SpiceMasterProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Spice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Spice | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = spices.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(emptyForm()); setEditTarget(null); setErrors({}); setShowForm(true); };
  const openEdit = (sp: Spice) => {
    setForm({ name: sp.name, category: sp.category, unitPrice: sp.unitPrice, unit: sp.unit });
    setEditTarget(sp);
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'スパイス名は必須です';
    else {
      const duplicate = spices.find(s => s.name.trim() === form.name.trim() && s.id !== editTarget?.id);
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
    let updated: Spice[];
    if (editTarget) {
      updated = updateSpice({ ...editTarget, ...form, updatedAt: now });
      addToast(`「${form.name}」を更新しました`);
    } else {
      updated = addSpice({ ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      addToast(`「${form.name}」を登録しました`);
    }
    onSpicesChange(updated);
    setShowForm(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const updated = deleteSpice(deleteTarget.id);
    onSpicesChange(updated);
    addToast(`「${deleteTarget.name}」を削除しました`);
    setDeleteTarget(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">スパイス管理</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} />
          新規スパイス登録
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="スパイス名・カテゴリで検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>スパイス名</th>
              <th>カテゴリ</th>
              <th>単価</th>
              <th>単位</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="empty-cell">スパイスが登録されていません</td></tr>
            ) : (
              filtered.map(sp => (
                <tr key={sp.id}>
                  <td className="td-bold">{sp.name}</td>
                  <td>{sp.category || '—'}</td>
                  <td>{formatCurrency(sp.unitPrice)}/{sp.unit}</td>
                  <td>{sp.unit}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-icon" onClick={() => openEdit(sp)} title="編集"><Edit2 size={14} /></button>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(sp)} title="削除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editTarget ? 'スパイス編集' : 'スパイスの新規登録'} onClose={() => setShowForm(false)} size="sm">
          <div className="form-layout">
            <div className="form-group">
              <label className="form-label">スパイス名 <span className="required">*</span></label>
              <input className={`form-input${errors.name ? ' form-input-error' : ''}`} value={form.name}
                onChange={e => {
                  setForm(f => ({ ...f, name: e.target.value }));
                  if (errors.name) setErrors(e => ({ ...e, name: '' }));
                }} placeholder="例: 塩" />
              {errors.name && <p className="error-text">{errors.name}</p>}
              {!errors.name && form.name.trim() && spices.some(s => s.name.trim() === form.name.trim() && s.id !== editTarget?.id) && (
                <p className="error-text">⚠️ この名前はすでに登録されています</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">カテゴリ</label>
              <input className="form-input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="例: 塩・砂糖類" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">単価（円） <span className="required">*</span></label>
                <input type="number" className={`form-input${errors.unitPrice ? ' form-input-error' : ''}`}
                  value={form.unitPrice || ''} onChange={e => setForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} min="0" step="0.01" />
                {errors.unitPrice && <p className="error-text">{errors.unitPrice}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">単位 <span className="required">*</span></label>
                <input className={`form-input${errors.unit ? ' form-input-error' : ''}`} value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="g / ml / 個" />
                {errors.unit && <p className="error-text">{errors.unit}</p>}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{editTarget ? '変更保存' : 'スパイス登録'}</button>
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
