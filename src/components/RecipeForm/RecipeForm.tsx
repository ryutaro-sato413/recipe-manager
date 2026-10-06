import { useState, useEffect, useRef } from 'react';
import { Recipe, Ingredient, Spice, RecipeIngredient, RecipeSpice, RecipePrepItem, Category } from '../../types';
import { addRecipe, updateRecipe } from '../../utils/storage';
import { calculateTotalCost, calculateCostRate, calcPrepCostPerUnit, formatCurrency, formatPercent } from '../../utils/calculations';
import Modal from '../shared/Modal';
import { Trash2, Search } from 'lucide-react';

export const CATEGORY_LABELS: Record<string, string> = {
  food: 'フード',
  drink: 'ドリンク',
  prep: '仕込み品',
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: 'フード' },
  { value: 'drink', label: 'ドリンク' },
  { value: 'prep', label: '仕込み品' },
];

interface CombinedItem {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  source: 'ingredient' | 'spice';
}

interface SearchSelectProps {
  items: CombinedItem[];
  placeholder: string;
  onSelect: (item: CombinedItem) => void;
}

function SearchSelect({ items, placeholder, onSelect }: SearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item: CombinedItem) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="search-select-wrapper">
      <div className="search-select-input-row">
        <Search size={14} className="search-select-icon" />
        <input
          className="search-select-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
      </div>
      {open && (
        <ul className="search-select-dropdown">
          {filtered.length === 0 ? (
            <li className="search-select-empty">該当する食材がありません</li>
          ) : (
            filtered.map(item => (
              <li
                key={`${item.source}:${item.id}`}
                className="search-select-option"
                onMouseDown={() => handleSelect(item)}
              >
                <span className="search-select-name">{item.name}</span>
                <span className="search-select-price">{formatCurrency(item.unitPrice)}/{item.unit}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

interface PrepSearchSelectProps {
  items: Recipe[];
  onSelect: (recipe: Recipe) => void;
}

function PrepSearchSelect({ items, onSelect }: PrepSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (recipe: Recipe) => {
    onSelect(recipe);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="search-select-wrapper">
      <div className="search-select-input-row">
        <Search size={14} className="search-select-icon" />
        <input
          className="search-select-input"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="仕込み品を検索..."
        />
      </div>
      {open && (
        <ul className="search-select-dropdown">
          {filtered.length === 0 ? (
            <li className="search-select-empty">該当する仕込み品がありません</li>
          ) : (
            filtered.map(recipe => {
              const cpu = calcPrepCostPerUnit(recipe);
              return (
                <li
                  key={recipe.id}
                  className="search-select-option"
                  onMouseDown={() => handleSelect(recipe)}
                >
                  <span className="search-select-name">{recipe.name}</span>
                  <span className="search-select-price">{formatCurrency(cpu)}/{recipe.yieldUnit}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

// 先頭ゼロを防ぐ数値入力ヘルパー
function parseAmount(value: string): number {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
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
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    else {
      const duplicate = allRecipes.find(r => r.name.trim() === form.name.trim() && r.id !== recipe?.id);
      if (duplicate) e.name = `「${form.name}」はすでに登録されています`;
    }
    if (form.category !== 'prep' && form.sellingPrice <= 0) e.sellingPrice = '販売価格は1円以上にしてください';
    if (form.targetCostRate <= 0 || form.targetCostRate > 100) e.targetCostRate = '目標原価率は1〜100%で入力してください';
    if (form.category === 'prep' && !form.yieldUnit.trim()) e.yieldUnit = '歩留まり単位を入力してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSelectItem = (item: CombinedItem) => {
    if (item.source === 'ingredient') {
      if (form.ingredients.find(i => i.ingredientId === item.id)) { addToast('すでに追加されています', 'error'); return; }
      setForm(f => ({
        ...f,
        ingredients: [...f.ingredients, {
          ingredientId: item.id, name: item.name, amount: 1,
          unit: item.unit, unitPrice: item.unitPrice, cost: item.unitPrice,
        }],
      }));
    } else {
      if (form.spices.find(s => s.spiceId === item.id)) { addToast('すでに追加されています', 'error'); return; }
      setForm(f => ({
        ...f,
        spices: [...f.spices, {
          spiceId: item.id, name: item.name, amount: 1,
          unit: item.unit, unitPrice: item.unitPrice, cost: item.unitPrice,
        }],
      }));
    }
  };

  const handleSelectPrep = (pr: Recipe) => {
    if (form.prepItems.find(p => p.recipeId === pr.id)) { addToast('すでに追加されています', 'error'); return; }
    const cpu = calcPrepCostPerUnit(pr);
    setForm(f => ({
      ...f,
      prepItems: [...f.prepItems, {
        recipeId: pr.id, recipeName: pr.name, amount: 1,
        unit: pr.yieldUnit || '', costPerUnit: cpu, cost: cpu,
      }],
    }));
  };

  type IngRow = { type: 'ingredient'; idx: number; item: RecipeIngredient };
  type SpRow = { type: 'spice'; idx: number; item: RecipeSpice };
  const allRows: (IngRow | SpRow)[] = [
    ...form.ingredients.map((item, idx) => ({ type: 'ingredient' as const, idx, item })),
    ...form.spices.map((item, idx) => ({ type: 'spice' as const, idx, item })),
  ];

  const updateAmount = (row: IngRow | SpRow, value: string) => {
    const amount = parseAmount(value);
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

  const updatePrepAmount = (idx: number, value: string) => {
    const amount = parseAmount(value);
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

        {/* 基本情報 */}
        <div className="form-section">
          <div className="form-group">
            <label className="form-label">レシピ名 <span className="required">*</span></label>
            <input className={`form-input${errors.name ? ' form-input-error' : ''}`}
              value={form.name} onChange={e => {
                setForm(f => ({ ...f, name: e.target.value }));
                if (errors.name) setErrors(e => ({ ...e, name: '' }));
              }}
              placeholder="例: 唐揚げ定食" />
            {errors.name && <p className="error-text">{errors.name}</p>}
            {!errors.name && form.name.trim() && allRecipes.some(r => r.name.trim() === form.name.trim() && r.id !== recipe?.id) && (
              <p className="error-text">⚠️ このレシピ名はすでに登録されています</p>
            )}
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
                  value={form.sellingPrice || ''}
                  onChange={e => setForm(f => ({ ...f, sellingPrice: parseAmount(e.target.value) }))} min="0" />
                {errors.sellingPrice && <p className="error-text">{errors.sellingPrice}</p>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">目標原価率（%）</label>
              <input type="number" className={`form-input${errors.targetCostRate ? ' form-input-error' : ''}`}
                value={form.targetCostRate || ''}
                onChange={e => setForm(f => ({ ...f, targetCostRate: parseAmount(e.target.value) }))} min="1" max="100" />
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
                    onChange={e => setForm(f => ({ ...f, yieldAmount: parseAmount(e.target.value) }))} min="0.01" step="0.1" placeholder="例: 1000" />
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
                <span>原価率:</span><strong style={{ color: statusColor }}>{formatPercent(costRate)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* 食材・調味料（検索式） */}
        <div className="form-section">
          <h4 className="form-section-title">食材・調味料</h4>
          {combinedItems.length === 0 ? (
            <p className="prep-empty-note">食材マスターに食材が登録されていません。</p>
          ) : (
            <SearchSelect items={combinedItems} placeholder="食材名で検索して追加..." onSelect={handleSelectItem} />
          )}

          {allRows.length > 0 && (
            <table className="ingredient-table">
              <thead>
                <tr><th>名称</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th><th></th></tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => {
                  const item = row.item;
                  const amount = item.amount;
                  return (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td>
                        <input
                          type="number"
                          className="table-input"
                          value={amount === 0 ? '' : amount}
                          onChange={e => updateAmount(row, e.target.value)}
                          min="0"
                          step="0.1"
                          placeholder="0"
                        />
                      </td>
                      <td>{item.unit}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{formatCurrency(amount * item.unitPrice)}</td>
                      <td>
                        <button className="btn btn-icon btn-icon-danger" onClick={() => removeRow(row)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 仕込み品（検索式） */}
          <h4 className="form-section-title" style={{ marginTop: '1.25rem' }}>仕込み品を使用する</h4>
          {prepRecipes.length === 0 ? (
            <p className="prep-empty-note">仕込み品カテゴリのレシピがまだ登録されていません。</p>
          ) : (
            <>
              <PrepSearchSelect items={prepRecipes} onSelect={handleSelectPrep} />
              {form.prepItems.length > 0 && (
                <table className="ingredient-table">
                  <thead>
                    <tr><th>仕込み品名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th><th></th></tr>
                  </thead>
                  <tbody>
                    {form.prepItems.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.recipeName}</td>
                        <td>
                          <input
                            type="number"
                            className="table-input"
                            value={p.amount === 0 ? '' : p.amount}
                            onChange={e => updatePrepAmount(idx, e.target.value)}
                            min="0"
                            step="0.1"
                            placeholder="0"
                          />
                        </td>
                        <td>{p.unit}</td>
                        <td>{formatCurrency(p.costPerUnit)}</td>
                        <td>{formatCurrency(p.cost)}</td>
                        <td>
                          <button className="btn btn-icon btn-icon-danger" onClick={() => removePrepItem(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
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
