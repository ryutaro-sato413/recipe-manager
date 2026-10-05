import { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Ingredient, Recipe } from '../../types';
import { addIngredient, updateIngredient, deleteIngredient, saveRecipes } from '../../utils/storage';
import { formatCurrency } from '../../utils/calculations';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';

interface IngredientMasterProps {
  ingredients: Ingredient[];
  recipes: Recipe[];
  onIngredientsChange: (ingredients: Ingredient[]) => void;
  onRecipesChange: (recipes: Recipe[]) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyForm(): Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: '', category: '', unitPrice: 0, unit: 'g', packageSize: 1, packagePrice: 0, supplier: '' };
}

export default function IngredientMaster({ ingredients, recipes, onIngredientsChange, onRecipesChange, addToast }: IngredientMasterProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const usedInRecipes = (id: string) =>
    recipes.filter(r => r.ingredients.some(i => i.ingredientId === id)).length;

  const openAdd = () => { setForm(emptyForm()); setEditTarget(null); setErrors({}); setShowForm(true); };
  const openEdit = (ing: Ingredient) => {
    setForm({ name: ing.name, category: ing.category, unitPrice: ing.unitPrice, unit: ing.unit, packageSize: ing.packageSize, packagePrice: ing.packagePrice, supplier: ing.supplier });
    setEditTarget(ing);
    setErrors({});
    setShowForm(true);
  };

  const calcUnitPrice = () => {
    if (form.packageSize > 0 && form.packagePrice > 0) {
      setForm(f => ({ ...f, unitPrice: Math.round((f.packagePrice / f.packageSize) * 100) / 100 }));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '食材名は必須です';
    else {
      // 同じ名前の食材がすでに登録されていないかチェック（編集時は自分自身を除外）
      const duplicate = ingredients.find(
        i => i.name.trim() === form.name.trim() && i.id !== editTarget?.id
      );
      if (duplicate) e.name = `「${form.name}」はすでに登録されています`;
    }
    if (form.unitPrice <= 0) e.unitPrice = '単価は0より大きい値を入力してください';
    if (!form.unit.trim()) e.unit = '単位は必須です';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    let updated: Ingredient[];
    if (editTarget) {
      updated = updateIngredient({ ...editTarget, ...form, updatedAt: now });
      
      // レシピ側の食材情報（名前、単位、単価、コスト）も自動更新する
      let recipesUpdated = false;
      const newRecipes = recipes.map(recipe => {
        const hasIng = recipe.ingredients.some(i => i.ingredientId === editTarget.id);
        if (!hasIng) return recipe;
        
        recipesUpdated = true;
        const newIngredients = recipe.ingredients.map(i => {
          if (i.ingredientId === editTarget.id) {
            return {
              ...i,
              name: form.name,
              unit: form.unit,
              unitPrice: form.unitPrice,
              cost: form.unitPrice * i.amount
            };
          }
          return i;
        });

        return { ...recipe, ingredients: newIngredients, updatedAt: now };
      });

      if (recipesUpdated) {
        saveRecipes(newRecipes);
        onRecipesChange(newRecipes);
      }

      addToast(`「${form.name}」を更新しました`);
    } else {
      updated = addIngredient({ ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      addToast(`「${form.name}」を登録しました`);
    }
    onIngredientsChange(updated);
    setShowForm(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const inUse = usedInRecipes(deleteTarget.id);
    if (inUse > 0) {
      addToast(`${inUse}件のレシピで使用中のため削除できません`, 'error');
      setDeleteTarget(null);
      return;
    }
    const updated = deleteIngredient(deleteTarget.id);
    onIngredientsChange(updated);
    addToast(`「${deleteTarget.name}」を削除しました`);
    setDeleteTarget(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">食材マスター</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} />
          新規食材登録
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="食材名・カテゴリで検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>食材名</th>
              <th>カテゴリ</th>
              <th>単価</th>
              <th>単位</th>
              <th>仕入先</th>
              <th>使用レシピ数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="empty-cell">食材が登録されていません</td></tr>
            ) : (
              filtered.map(ing => (
                <tr key={ing.id}>
                  <td className="td-bold">{ing.name}</td>
                  <td>{ing.category || '—'}</td>
                  <td>{formatCurrency(ing.unitPrice)}/{ing.unit}</td>
                  <td>{ing.unit}</td>
                  <td>{ing.supplier || '—'}</td>
                  <td>
                    <span className={`badge ${usedInRecipes(ing.id) > 0 ? 'badge-blue' : 'badge-gray'}`}>
                      {usedInRecipes(ing.id)}件
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-icon" onClick={() => openEdit(ing)} title="編集"><Edit2 size={14} /></button>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(ing)} title="削除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editTarget ? '食材編集' : '食材マスターの新規登録'} onClose={() => setShowForm(false)} size="md">
          <div className="form-layout">
            <div className="form-row">
              <div className="form-group form-group-grow">
                <label className="form-label">食材名 <span className="required">*</span></label>
                <input className={`form-input${errors.name ? ' form-input-error' : ''}`} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例: 鶏もも肉" />
                {errors.name && <p className="error-text">{errors.name}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">カテゴリ</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">選択してください</option>
                  <option value="フード">フード</option>
                  <option value="ドリンク">ドリンク</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">購入単価（円）</label>
                <input type="number" className="form-input" value={form.packagePrice || ''}
                  onChange={e => setForm(f => ({ ...f, packagePrice: Number(e.target.value) }))} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">入数・容量</label>
                <input type="number" className="form-input" value={form.packageSize || ''}
                  onChange={e => setForm(f => ({ ...f, packageSize: Number(e.target.value) }))} min="0" step="0.1" />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={calcUnitPrice}>単価を計算</button>
              </div>
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
              <div className="form-group form-group-grow">
                <label className="form-label">仕入先</label>
                <input className="form-input" value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="例: 〇〇市場" />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{editTarget ? '変更保存' : '食材登録'}</button>
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
