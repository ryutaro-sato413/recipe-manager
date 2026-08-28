import { useState, useEffect } from 'react';
import { Recipe, Ingredient, Spice, RecipeIngredient, RecipeSpice, Category } from '../../types';
import { addRecipe, updateRecipe } from '../../utils/storage';
import { calculateTotalCost, calculateCostRate, formatCurrency, formatPercent } from '../../utils/calculations';
import Modal from '../shared/Modal';
import { Plus, Trash2 } from 'lucide-react';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: 'フード' },
  { value: 'drink', label: 'ドリンク' },
  { value: 'dessert', label: 'デザート' },
  { value: 'other', label: 'その他' },
];

interface RecipeFormProps {
  recipe: Recipe | null;
  ingredients: Ingredient[];
  spices: Spice[];
  onClose: (updated?: Recipe[]) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function emptyForm() {
  return {
    name: '',
    category: 'food' as Category,
    sellingPrice: 0,
    targetCostRate: 30,
    memo: '',
    ingredients: [] as RecipeIngredient[],
    spices: [] as RecipeSpice[],
  };
}

export default function RecipeForm({ recipe, ingredients, spices, onClose, addToast }: RecipeFormProps) {
  const [form, setForm] = useState(emptyForm());
  const [selectedIngId, setSelectedIngId] = useState('');
  const [selectedSpiceId, setSelectedSpiceId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (recipe) {
      setForm({
        name: recipe.name,
        category: recipe.category,
        sellingPrice: recipe.sellingPrice,
        targetCostRate: recipe.targetCostRate,
        memo: recipe.memo,
        ingredients: recipe.ingredients,
        spices: recipe.spices,
      });
    }
  }, [recipe]);

  const totalCost = calculateTotalCost({ ...form, id: '', createdAt: '', updatedAt: '' } as Recipe);
  const costRate = calculateCostRate(totalCost, form.sellingPrice);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'レシピ名は必須です';
    if (form.sellingPrice <= 0) e.sellingPrice = '販売価格は1円以上にしてください';
    if (form.targetCostRate <= 0 || form.targetCostRate > 100) e.targetCostRate = '目標原価率は1〜100%で入力してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddIngredient = () => {
    const ing = ingredients.find(i => i.id === selectedIngId);
    if (!ing) return;
    if (form.ingredients.find(i => i.ingredientId === ing.id)) {
      addToast('すでに追加されている食材です', 'error');
      return;
    }
    setForm(f => ({
      ...f,
      ingredients: [...f.ingredients, {
        ingredientId: ing.id,
        name: ing.name,
        amount: 1,
        unit: ing.unit,
        unitPrice: ing.unitPrice,
        cost: ing.unitPrice,
      }],
    }));
    setSelectedIngId('');
  };

  const handleAddSpice = () => {
    const sp = spices.find(s => s.id === selectedSpiceId);
    if (!sp) return;
    if (form.spices.find(s => s.spiceId === sp.id)) {
      addToast('すでに追加されているスパイスです', 'error');
      return;
    }
    setForm(f => ({
      ...f,
      spices: [...f.spices, {
        spiceId: sp.id,
        name: sp.name,
        amount: 1,
        unit: sp.unit,
        unitPrice: sp.unitPrice,
        cost: sp.unitPrice,
      }],
    }));
    setSelectedSpiceId('');
  };

  const updateIngAmount = (idx: number, amount: number) => {
    setForm(f => {
      const ingredients = [...f.ingredients];
      ingredients[idx] = { ...ingredients[idx], amount, cost: amount * ingredients[idx].unitPrice };
      return { ...f, ingredients };
    });
  };

  const removeIngredient = (idx: number) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  };

  const updateSpiceAmount = (idx: number, amount: number) => {
    setForm(f => {
      const newSpices = [...f.spices];
      newSpices[idx] = { ...newSpices[idx], amount, cost: amount * newSpices[idx].unitPrice };
      return { ...f, spices: newSpices };
    });
  };

  const removeSpice = (idx: number) => {
    setForm(f => ({ ...f, spices: f.spices.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    let updated: Recipe[];
    if (recipe) {
      updated = updateRecipe({ ...recipe, ...form, updatedAt: now });
      addToast(`「${form.name}」を更新しました`);
    } else {
      updated = addRecipe({ ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      addToast(`「${form.name}」を登録しました`);
    }
    onClose(updated);
  };

  const statusColor = costRate <= form.targetCostRate ? '#16a34a' : costRate <= form.targetCostRate * 1.1 ? '#d97706' : '#dc2626';

  return (
    <Modal title={recipe ? 'レシピ編集' : '新規レシピ登録'} onClose={() => onClose()} size="xl">
      <div className="form-layout">
        <div className="form-section">
          <div className="form-group">
            <label className="form-label">レシピ名 <span className="required">*</span></label>
            <input
              className={`form-input${errors.name ? ' form-input-error' : ''}`}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例: 唐揚げ定食"
            />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">カテゴリ <span className="required">*</span></label>
              <select
                className="form-select"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">販売価格（円） <span className="required">*</span></label>
              <input
                type="number"
                className={`form-input${errors.sellingPrice ? ' form-input-error' : ''}`}
                value={form.sellingPrice || ''}
                onChange={e => setForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))}
                min="0"
              />
              {errors.sellingPrice && <p className="error-text">{errors.sellingPrice}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">目標原価率（%）</label>
              <input
                type="number"
                className={`form-input${errors.targetCostRate ? ' form-input-error' : ''}`}
                value={form.targetCostRate || ''}
                onChange={e => setForm(f => ({ ...f, targetCostRate: Number(e.target.value) }))}
                min="1"
                max="100"
              />
              {errors.targetCostRate && <p className="error-text">{errors.targetCostRate}</p>}
            </div>
          </div>

          <div className="cost-summary-box" style={{ borderColor: statusColor }}>
            <div className="cost-summary-row">
              <span>原価合計:</span>
              <strong>{formatCurrency(totalCost)}</strong>
            </div>
            <div className="cost-summary-row">
              <span>原価率:</span>
              <strong style={{ color: statusColor }}>{formatPercent(costRate)}</strong>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4 className="form-section-title">食材・コスト</h4>
          <div className="add-ingredient-row">
            <select
              className="form-select"
              value={selectedIngId}
              onChange={e => setSelectedIngId(e.target.value)}
            >
              <option value="">食材を選択...</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}（{formatCurrency(ing.unitPrice)}/{ing.unit}）
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleAddIngredient} disabled={!selectedIngId}>
              <Plus size={14} />
              追加
            </button>
          </div>

          {form.ingredients.length > 0 && (
            <table className="ingredient-table">
              <thead>
                <tr>
                  <th>食材名</th>
                  <th>使用量</th>
                  <th>単位</th>
                  <th>単価</th>
                  <th>コスト</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.ingredients.map((ing, idx) => (
                  <tr key={idx}>
                    <td>{ing.name}</td>
                    <td>
                      <input
                        type="number"
                        className="table-input"
                        value={ing.amount}
                        onChange={e => updateIngAmount(idx, Number(e.target.value))}
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td>{ing.unit}</td>
                    <td>{formatCurrency(ing.unitPrice)}</td>
                    <td>{formatCurrency(ing.amount * ing.unitPrice)}</td>
                    <td>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => removeIngredient(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 className="form-section-title" style={{ marginTop: '1.5rem' }}>スパイス・調味料</h4>
          <div className="add-ingredient-row">
            <select
              className="form-select"
              value={selectedSpiceId}
              onChange={e => setSelectedSpiceId(e.target.value)}
            >
              <option value="">スパイスを選択...</option>
              {spices.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}（{formatCurrency(sp.unitPrice)}/{sp.unit}）
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleAddSpice} disabled={!selectedSpiceId}>
              <Plus size={14} />
              追加
            </button>
          </div>

          {form.spices.length > 0 && (
            <table className="ingredient-table">
              <thead>
                <tr>
                  <th>スパイス名</th>
                  <th>使用量</th>
                  <th>単位</th>
                  <th>単価</th>
                  <th>コスト</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.spices.map((sp, idx) => (
                  <tr key={idx}>
                    <td>{sp.name}</td>
                    <td>
                      <input
                        type="number"
                        className="table-input"
                        value={sp.amount}
                        onChange={e => updateSpiceAmount(idx, Number(e.target.value))}
                        min="0"
                        step="0.1"
                      />
                    </td>
                    <td>{sp.unit}</td>
                    <td>{formatCurrency(sp.unitPrice)}</td>
                    <td>{formatCurrency(sp.amount * sp.unitPrice)}</td>
                    <td>
                      <button className="btn btn-icon btn-icon-danger" onClick={() => removeSpice(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="form-section">
          <div className="form-group">
            <label className="form-label">メモ（手順・備考など）</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              placeholder="調理手順・備考など"
            />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => onClose()}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {recipe ? '変更保存' : 'レシピ登録'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
