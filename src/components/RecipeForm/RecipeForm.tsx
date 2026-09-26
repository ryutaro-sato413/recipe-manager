import { useState, useEffect } from 'react';
import { Recipe, Ingredient, Spice, RecipeIngredient, RecipeSpice, RecipePrepItem, Category } from '../../types';
import { addRecipe, updateRecipe } from '../../utils/storage';
import { calculateTotalCost, calculateCostRate, calcPrepCostPerUnit, formatCurrency, formatPercent } from '../../utils/calculations';
import Modal from '../shared/Modal';
import { Plus, Trash2 } from 'lucide-react';

export const CATEGORY_LABELS: Record<string, string> = {
  food: 'フード',
  drink: 'ドリンク',
  dessert: 'デザート',
  prep: '仕込み品',
  other: 'その他',
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: 'フード' },
  { value: 'drink', label: 'ドリンク' },
  { value: 'dessert', label: 'デザート' },
  { value: 'prep', label: '仕込み品' },
  { value: 'other', label: 'その他' },
];

interface RecipeFormProps {
  recipe: Recipe | null;
  ingredients: Ingredient[];
  spices: Spice[];
  allRecipes: Recipe[];   // 仕込み品選択のため全レシピを受け取る
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
    yieldAmount: 1,
    yieldUnit: '',
    ingredients: [] as RecipeIngredient[],
    spices: [] as RecipeSpice[],
    prepItems: [] as RecipePrepItem[],
  };
}

export default function RecipeForm({ recipe, ingredients, spices, allRecipes, onClose, addToast }: RecipeFormProps) {
  const [form, setForm] = useState(emptyForm());
  const [selectedIngId, setSelectedIngId] = useState('');
  const [selectedSpiceId, setSelectedSpiceId] = useState('');
  const [selectedPrepId, setSelectedPrepId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 仕込み品レシピ一覧（自分自身は除外）
  const prepRecipes = allRecipes.filter(r => r.category === 'prep' && r.id !== recipe?.id);

  useEffect(() => {
    if (recipe) {
      setForm({
        name: recipe.name,
        category: recipe.category,
        sellingPrice: recipe.sellingPrice,
        targetCostRate: recipe.targetCostRate,
        memo: recipe.memo,
        yieldAmount: recipe.yieldAmount ?? 1,
        yieldUnit: recipe.yieldUnit ?? '',
        ingredients: recipe.ingredients,
        spices: recipe.spices,
        prepItems: recipe.prepItems ?? [],
      });
    }
  }, [recipe]);

  const totalCost = calculateTotalCost({ ...form, id: '', createdAt: '', updatedAt: '' } as Recipe);
  const costRate = calculateCostRate(totalCost, form.sellingPrice);
  const costPerUnit = form.category === 'prep' && form.yieldAmount > 0
    ? totalCost / form.yieldAmount
    : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'レシピ名は必須です';
    if (form.category !== 'prep' && form.sellingPrice <= 0) e.sellingPrice = '販売価格は1円以上にしてください';
    if (form.targetCostRate <= 0 || form.targetCostRate > 100) e.targetCostRate = '目標原価率は1〜100%で入力してください';
    if (form.category === 'prep' && (!form.yieldUnit.trim())) e.yieldUnit = '歩留まり単位を入力してください';
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

  const handleAddPrepItem = () => {
    const pr = prepRecipes.find(r => r.id === selectedPrepId);
    if (!pr) return;
    if (form.prepItems.find(p => p.recipeId === pr.id)) {
      addToast('すでに追加されている仕込み品です', 'error');
      return;
    }
    const costPerUnit = calcPrepCostPerUnit(pr);
    setForm(f => ({
      ...f,
      prepItems: [...f.prepItems, {
        recipeId: pr.id,
        recipeName: pr.name,
        amount: 1,
        unit: pr.yieldUnit || '',
        costPerUnit,
        cost: costPerUnit * 1,
      }],
    }));
    setSelectedPrepId('');
  };

  const updateIngAmount = (idx: number, amount: number) => {
    setForm(f => {
      const ing = [...f.ingredients];
      ing[idx] = { ...ing[idx], amount, cost: amount * ing[idx].unitPrice };
      return { ...f, ingredients: ing };
    });
  };

  const removeIngredient = (idx: number) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  };

  const updateSpiceAmount = (idx: number, amount: number) => {
    setForm(f => {
      const sp = [...f.spices];
      sp[idx] = { ...sp[idx], amount, cost: amount * sp[idx].unitPrice };
      return { ...f, spices: sp };
    });
  };

  const removeSpice = (idx: number) => {
    setForm(f => ({ ...f, spices: f.spices.filter((_, i) => i !== idx) }));
  };

  const updatePrepAmount = (idx: number, amount: number) => {
    setForm(f => {
      const items = [...f.prepItems];
      items[idx] = { ...items[idx], amount, cost: Math.round(amount * items[idx].costPerUnit * 100) / 100 };
      return { ...f, prepItems: items };
    });
  };

  const removePrepItem = (idx: number) => {
    setForm(f => ({ ...f, prepItems: f.prepItems.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    let updated: Recipe[];
    const data: Omit<Recipe, 'id' | 'createdAt'> = {
      ...form,
      updatedAt: now,
    };
    if (recipe) {
      updated = updateRecipe({ ...recipe, ...data });
      addToast(`「${form.name}」を更新しました`);
    } else {
      updated = addRecipe({ ...data, id: crypto.randomUUID(), createdAt: now });
      addToast(`「${form.name}」を登録しました`);
    }
    onClose(updated);
  };

  const statusColor = costRate <= form.targetCostRate ? '#16a34a' : costRate <= form.targetCostRate * 1.1 ? '#d97706' : '#dc2626';
  const isPrep = form.category === 'prep';

  return (
    <Modal title={recipe ? 'レシピ編集' : '新規レシピ登録'} onClose={() => onClose()} size="xl">
      <div className="form-layout">

        {/* 基本情報 */}
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

            {!isPrep && (
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
            )}

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

          {/* 仕込み品：歩留まり設定 */}
          {isPrep && (
            <div className="prep-yield-box">
              <p className="prep-yield-label">🍳 仕込み品設定（このレシピで何単位分作れるか）</p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">歩留まり量 <span className="required">*</span></label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.yieldAmount || ''}
                    onChange={e => setForm(f => ({ ...f, yieldAmount: Number(e.target.value) }))}
                    min="0.01"
                    step="0.1"
                    placeholder="例: 1000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">単位 <span className="required">*</span></label>
                  <input
                    className={`form-input${errors.yieldUnit ? ' form-input-error' : ''}`}
                    value={form.yieldUnit}
                    onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))}
                    placeholder="例: g / ml / 個"
                  />
                  {errors.yieldUnit && <p className="error-text">{errors.yieldUnit}</p>}
                </div>
              </div>
              {costPerUnit > 0 && (
                <p className="prep-unit-cost">
                  → 1{form.yieldUnit}あたりの原価: <strong>{formatCurrency(costPerUnit)}</strong>
                </p>
              )}
            </div>
          )}

          {/* 原価サマリー */}
          <div className="cost-summary-box" style={{ borderColor: statusColor }}>
            <div className="cost-summary-row">
              <span>原価合計:</span>
              <strong>{formatCurrency(totalCost)}</strong>
            </div>
            {!isPrep && (
              <div className="cost-summary-row">
                <span>原価率:</span>
                <strong style={{ color: statusColor }}>{formatPercent(costRate)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* 食材 */}
        <div className="form-section">
          <h4 className="form-section-title">食材</h4>
          <div className="add-ingredient-row">
            <select className="form-select" value={selectedIngId} onChange={e => setSelectedIngId(e.target.value)}>
              <option value="">食材を選択...</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name}（{formatCurrency(ing.unitPrice)}/{ing.unit}）</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleAddIngredient} disabled={!selectedIngId}>
              <Plus size={14} />追加
            </button>
          </div>
          {form.ingredients.length > 0 && (
            <table className="ingredient-table">
              <thead><tr><th>食材名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th><th></th></tr></thead>
              <tbody>
                {form.ingredients.map((ing, idx) => (
                  <tr key={idx}>
                    <td>{ing.name}</td>
                    <td><input type="number" className="table-input" value={ing.amount} onChange={e => updateIngAmount(idx, Number(e.target.value))} min="0" step="0.1" /></td>
                    <td>{ing.unit}</td>
                    <td>{formatCurrency(ing.unitPrice)}</td>
                    <td>{formatCurrency(ing.amount * ing.unitPrice)}</td>
                    <td><button className="btn btn-icon btn-icon-danger" onClick={() => removeIngredient(idx)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* スパイス */}
          <h4 className="form-section-title" style={{ marginTop: '1.25rem' }}>スパイス・調味料</h4>
          <div className="add-ingredient-row">
            <select className="form-select" value={selectedSpiceId} onChange={e => setSelectedSpiceId(e.target.value)}>
              <option value="">スパイスを選択...</option>
              {spices.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}（{formatCurrency(sp.unitPrice)}/{sp.unit}）</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleAddSpice} disabled={!selectedSpiceId}>
              <Plus size={14} />追加
            </button>
          </div>
          {form.spices.length > 0 && (
            <table className="ingredient-table">
              <thead><tr><th>スパイス名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th><th></th></tr></thead>
              <tbody>
                {form.spices.map((sp, idx) => (
                  <tr key={idx}>
                    <td>{sp.name}</td>
                    <td><input type="number" className="table-input" value={sp.amount} onChange={e => updateSpiceAmount(idx, Number(e.target.value))} min="0" step="0.1" /></td>
                    <td>{sp.unit}</td>
                    <td>{formatCurrency(sp.unitPrice)}</td>
                    <td>{formatCurrency(sp.amount * sp.unitPrice)}</td>
                    <td><button className="btn btn-icon btn-icon-danger" onClick={() => removeSpice(idx)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 仕込み品（サブレシピ） */}
          <h4 className="form-section-title" style={{ marginTop: '1.25rem' }}>仕込み品を使用する</h4>
          {prepRecipes.length === 0 ? (
            <p className="prep-empty-note">仕込み品カテゴリのレシピがまだ登録されていません。先に仕込み品レシピを登録してください。</p>
          ) : (
            <>
              <div className="add-ingredient-row">
                <select className="form-select" value={selectedPrepId} onChange={e => setSelectedPrepId(e.target.value)}>
                  <option value="">仕込み品を選択...</option>
                  {prepRecipes.map(pr => {
                    const cpu = calcPrepCostPerUnit(pr);
                    return (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}（{formatCurrency(cpu)}/{pr.yieldUnit}）
                      </option>
                    );
                  })}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={handleAddPrepItem} disabled={!selectedPrepId}>
                  <Plus size={14} />追加
                </button>
              </div>
              {form.prepItems.length > 0 && (
                <table className="ingredient-table">
                  <thead><tr><th>仕込み品名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th><th></th></tr></thead>
                  <tbody>
                    {form.prepItems.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.recipeName}</td>
                        <td><input type="number" className="table-input" value={p.amount} onChange={e => updatePrepAmount(idx, Number(e.target.value))} min="0" step="0.1" /></td>
                        <td>{p.unit}</td>
                        <td>{formatCurrency(p.costPerUnit)}</td>
                        <td>{formatCurrency(p.cost)}</td>
                        <td><button className="btn btn-icon btn-icon-danger" onClick={() => removePrepItem(idx)}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* メモ */}
        <div className="form-section">
          <div className="form-group">
            <label className="form-label">メモ（手順・備考など）</label>
            <textarea className="form-textarea" rows={3} value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="調理手順・備考など" />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => onClose()}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleSubmit}>{recipe ? '変更保存' : 'レシピ登録'}</button>
        </div>
      </div>
    </Modal>
  );
}
