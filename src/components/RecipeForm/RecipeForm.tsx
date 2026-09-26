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

// 食材・スパイス統合用
interface CombinedItem {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  source: 'ingredient' | 'spice';
}

interface RecipeFormProps {
  recipe: Recipe | null;
  ingredients: Ingredient[];
  spices: Spice[];
  allRecipes: Recipe[];
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
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [selectedPrepId, setSelectedPrepId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 食材とスパイスを1つのリストに統合
  const combinedItems: CombinedItem[] = [
    ...ingredients.map(i => ({ id: i.id, name: i.name, unit: i.unit, unitPrice: i.unitPrice, source: 'ingredient' as const })),
    ...spices.map(s => ({ id: s.id, name: s.name, unit: s.unit, unitPrice: s.unitPrice, source: 'spice' as const })),
  ];

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
  const costPerUnit = form.category === 'prep' && form.yieldAmount > 0 ? totalCost / form.yieldAmount : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'レシピ名は必須です';
    if (form.category !== 'prep' && form.sellingPrice <= 0) e.sellingPrice = '販売価格は1円以上にしてください';
    if (form.targetCostRate <= 0 || form.targetCostRate > 100) e.targetCostRate = '目標原価率は1〜100%で入力してください';
    if (form.category === 'prep' && !form.yieldUnit.trim()) e.yieldUnit = '歩留まり単位を入力してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddItem = () => {
    if (!selectedItemKey) return;
    const [source, id] = selectedItemKey.split(':');
    const item = combinedItems.find(c => c.source === source && c.id === id);
    if (!item) return;

    if (source === 'ingredient') {
      if (form.ingredients.find(i => i.ingredientId === id)) { addToast('すでに追加されています', 'error'); return; }
      setForm(f => ({
        ...f,
        ingredients: [...f.ingredients, {
          ingredientId: id, name: item.name, amount: 1,
          unit: item.unit, unitPrice: item.unitPrice, cost: item.unitPrice,
        }],
      }));
    } else {
      if (form.spices.find(s => s.spiceId === id)) { addToast('すでに追加されています', 'error'); return; }
      setForm(f => ({
        ...f,
        spices: [...f.spices, {
          spiceId: id, name: item.name, amount: 1,
          unit: item.unit, unitPrice: item.unitPrice, cost: item.unitPrice,
        }],
      }));
    }
    setSelectedItemKey('');
  };

  const handleAddPrepItem = () => {
    const pr = prepRecipes.find(r => r.id === selectedPrepId);
    if (!pr) return;
    if (form.prepItems.find(p => p.recipeId === pr.id)) { addToast('すでに追加されています', 'error'); return; }
    const cpu = calcPrepCostPerUnit(pr);
    setForm(f => ({
      ...f,
      prepItems: [...f.prepItems, {
        recipeId: pr.id, recipeName: pr.name, amount: 1,
        unit: pr.yieldUnit || '', costPerUnit: cpu, cost: cpu,
      }],
    }));
    setSelectedPrepId('');
  };

  // 食材・スパイス統合テーブル用の行データ
  type IngRow = { type: 'ingredient'; idx: number; item: RecipeIngredient };
  type SpRow = { type: 'spice'; idx: number; item: RecipeSpice };
  const allRows: (IngRow | SpRow)[] = [
    ...form.ingredients.map((item, idx) => ({ type: 'ingredient' as const, idx, item })),
    ...form.spices.map((item, idx) => ({ type: 'spice' as const, idx, item })),
  ];

  const updateAmount = (row: IngRow | SpRow, amount: number) => {
    if (row.type === 'ingredient') {
      setForm(f => {
        const arr = [...f.ingredients];
        arr[row.idx] = { ...arr[row.idx], amount, cost: amount * arr[row.idx].unitPrice };
        return { ...f, ingredients: arr };
      });
    } else {
      setForm(f => {
        const arr = [...f.spices];
        arr[row.idx] = { ...arr[row.idx], amount, cost: amount * arr[row.idx].unitPrice };
        return { ...f, spices: arr };
      });
    }
  };

  const removeRow = (row: IngRow | SpRow) => {
    if (row.type === 'ingredient') {
      setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== row.idx) }));
    } else {
      setForm(f => ({ ...f, spices: f.spices.filter((_, i) => i !== row.idx) }));
    }
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
    const data = { ...form, updatedAt: now };
    let updated: Recipe[];
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
        <div className="form-section">
          <div className="form-group">
            <label className="form-label">レシピ名 <span className="required">*</span></label>
            <input className={`form-input${errors.name ? ' form-input-error' : ''}`}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例: 唐揚げ定食" />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">カテゴリ <span className="required">*</span></label>
              <select className="form-select" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {!isPrep && (
              <div className="form-group">
                <label className="form-label">販売価格（円） <span className="required">*</span></label>
                <input type="number" className={`form-input${errors.sellingPrice ? ' form-input-error' : ''}`}
                  value={form.sellingPrice || ''} onChange={e => setForm(f => ({ ...f, sellingPrice: Number(e.target.value) }))} min="0" />
                {errors.sellingPrice && <p className="error-text">{errors.sellingPrice}</p>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">目標原価率（%）</label>
              <input type="number" className={`form-input${errors.targetCostRate ? ' form-input-error' : ''}`}
                value={form.targetCostRate || ''} onChange={e => setForm(f => ({ ...f, targetCostRate: Number(e.target.value) }))} min="1" max="100" />
              {errors.targetCostRate && <p className="error-text">{errors.targetCostRate}</p>}
            </div>
          </div>

          {isPrep && (
            <div className="prep-yield-box">
              <p className="prep-yield-label">🍳 仕込み品設定（このレシピで何単位分作れるか）</p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">歩留まり量</label>
                  <input type="number" className="form-input" value={form.yieldAmount || ''}
                    onChange={e => setForm(f => ({ ...f, yieldAmount: Number(e.target.value) }))} min="0.01" step="0.1" placeholder="例: 1000" />
                </div>
                <div className="form-group">
                  <label className="form-label">単位 <span className="required">*</span></label>
                  <input className={`form-input${errors.yieldUnit ? ' form-input-error' : ''}`}
                    value={form.yieldUnit} onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))} placeholder="例: g / ml / 個" />
                  {errors.yieldUnit && <p className="error-text">{errors.yieldUnit}</p>}
                </div>
              </div>
              {costPerUnit > 0 && (
                <p className="prep-unit-cost">→ 1{form.yieldUnit}あたりの原価: <strong>{formatCurrency(costPerUnit)}</strong></p>
              )}
            </div>
          )}

          <div className="cost-summary-box" style={{ borderColor: statusColor }}>
            <div className="cost-summary-row"><span>原価合計:</span><strong>{formatCurrency(totalCost)}</strong></div>
            {!isPrep && (
              <div className="cost-summary-row">
                <span>原価率:</span>
                <strong style={{ color: statusColor }}>{formatPercent(costRate)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* 食材（統合） */}
        <div className="form-section">
          <h4 className="form-section-title">食材・調味料</h4>
          <div className="add-ingredient-row">
            <select className="form-select" value={selectedItemKey} onChange={e => setSelectedItemKey(e.target.value)}>
              <option value="">食材・調味料を選択...</option>
              {combinedItems.length === 0 && <option disabled>食材が登録されていません</option>}
              {combinedItems.map(item => (
                <option key={`${item.source}:${item.id}`} value={`${item.source}:${item.id}`}>
                  {item.name}（{formatCurrency(item.unitPrice)}/{item.unit}）
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleAddItem} disabled={!selectedItemKey}>
              <Plus size={14} />追加
            </button>
          </div>

          {allRows.length > 0 && (
            <table className="ingredient-table">
              <thead><tr><th>名称</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th><th></th></tr></thead>
              <tbody>
                {allRows.map((row, i) => {
                  const name = row.type === 'ingredient' ? row.item.name : row.item.name;
                  const amount = row.type === 'ingredient' ? row.item.amount : row.item.amount;
                  const unit = row.type === 'ingredient' ? row.item.unit : row.item.unit;
                  const unitPrice = row.type === 'ingredient' ? row.item.unitPrice : row.item.unitPrice;
                  return (
                    <tr key={i}>
                      <td>{name}</td>
                      <td><input type="number" className="table-input" value={amount}
                        onChange={e => updateAmount(row, Number(e.target.value))} min="0" step="0.1" /></td>
                      <td>{unit}</td>
                      <td>{formatCurrency(unitPrice)}</td>
                      <td>{formatCurrency(amount * unitPrice)}</td>
                      <td><button className="btn btn-icon btn-icon-danger" onClick={() => removeRow(row)}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 仕込み品 */}
          <h4 className="form-section-title" style={{ marginTop: '1.25rem' }}>仕込み品を使用する</h4>
          {prepRecipes.length === 0 ? (
            <p className="prep-empty-note">仕込み品カテゴリのレシピがまだ登録されていません。</p>
          ) : (
            <>
              <div className="add-ingredient-row">
                <select className="form-select" value={selectedPrepId} onChange={e => setSelectedPrepId(e.target.value)}>
                  <option value="">仕込み品を選択...</option>
                  {prepRecipes.map(pr => {
                    const cpu = calcPrepCostPerUnit(pr);
                    return <option key={pr.id} value={pr.id}>{pr.name}（{formatCurrency(cpu)}/{pr.yieldUnit}）</option>;
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
                        <td><input type="number" className="table-input" value={p.amount}
                          onChange={e => updatePrepAmount(idx, Number(e.target.value))} min="0" step="0.1" /></td>
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

        <div className="form-section">
          <div className="form-group">
            <label className="form-label">メモ</label>
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
