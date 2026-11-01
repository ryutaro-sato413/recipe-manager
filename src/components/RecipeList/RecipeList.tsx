import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, ChefHat, Eye, ArrowLeft, ChevronRight } from 'lucide-react';
import { Recipe, Ingredient, Spice } from '../../types';
import { calculateTotalCost, calculateCostRate, formatCurrency, formatPercent } from '../../utils/calculations';
import { deleteRecipe } from '../../utils/storage';
import CostRateBar from '../shared/CostRateBar';
import ConfirmDialog from '../shared/ConfirmDialog';
import RecipeForm, { CATEGORY_LABELS } from '../RecipeForm/RecipeForm';
import RecipeDetail from './RecipeDetail';

interface RecipeListProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  spices: Spice[];
  onRecipesChange: (recipes: Recipe[]) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function RecipeList({ recipes, ingredients, spices, onRecipesChange, addToast }: RecipeListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);

  const filtered = recipes.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === null || categoryFilter === 'all' || r.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // カテゴリ選択画面で表示するカテゴリ
  const CATEGORY_CARDS: { key: string; label: string; icon: string; desc: string }[] = [
    { key: 'food', label: 'フード', icon: '🍽️', desc: '料理メニューのレシピ' },
    { key: 'drink', label: 'ドリンク', icon: '🍹', desc: 'ドリンクメニューのレシピ' },
    { key: 'prep', label: '仕込み品', icon: '🥣', desc: 'ソース・下ごしらえ等の仕込み品' },
    { key: 'all', label: 'すべて', icon: '📚', desc: '全カテゴリのレシピ' },
  ];
  const isCategoryTop = categoryFilter === null && !search;

  const handleDelete = () => {
    if (!deleteTarget) return;
    const updated = deleteRecipe(deleteTarget.id);
    onRecipesChange(updated);
    addToast(`「${deleteTarget.name}」を削除しました`);
    setDeleteTarget(null);
  };

  const handleFormClose = (updated?: Recipe[]) => {
    setShowForm(false);
    setEditRecipe(null);
    if (updated) onRecipesChange(updated);
  };

  const currentCategory = CATEGORY_CARDS.find(c => c.key === categoryFilter);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">
          {currentCategory ? `${currentCategory.icon} ${currentCategory.label}のレシピ` : 'レシピ一覧'}
        </h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} />
          新規レシピ登録
        </button>
      </div>

      {categoryFilter !== null && (
        <div className="store-Select-topbar">
          <button className="btn btn-secondary btn-sm" onClick={() => { setCategoryFilter(null); setSearch(''); }}>
            <ArrowLeft size={14} /> カテゴリ選択に戻る
          </button>
          <div className="store-switcher-pills">
            {CATEGORY_CARDS.map(c => (
              <button
                key={c.key}
                type="button"
                className={`btn btn-sm ${categoryFilter === c.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCategoryFilter(c.key)}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input type="text" className="search-input"
            placeholder={currentCategory && currentCategory.key !== 'all' ? `${currentCategory.label}のレシピ名で検索...` : 'レシピ名で検索（全カテゴリ）...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isCategoryTop ? (
        <div className="store-select-grid">
          {CATEGORY_CARDS.map(c => {
            const count = c.key === 'all' ? recipes.length : recipes.filter(r => r.category === c.key).length;
            return (
              <button
                key={c.key}
                type="button"
                className="store-select-card"
                onClick={() => setCategoryFilter(c.key)}
              >
                <div className="store-select-card-header">
                  <div className="store-select-title-group">
                    <span className="store-select-icon" style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                    <span className="store-select-name">{c.label}</span>
                  </div>
                  <ChevronRight size={20} className="store-select-arrow" />
                </div>
                <div className="store-select-card-body">
                  <div className="store-select-meta">
                    <span>{c.desc}</span>
                    <span>登録数: <strong>{count}件</strong></span>
                  </div>
                </div>
                <div className="store-select-card-footer">
                  <span>{c.label}のレシピを表示</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ChefHat size={48} className="empty-icon" />
          <p>{recipes.length === 0 ? '最初のレシピを登録しましょう！' : '該当するレシピがありません'}</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {filtered.map(recipe => {
            const cost = calculateTotalCost(recipe);
            const isPrep = recipe.category === 'prep';
            const costRate = isPrep ? 0 : calculateCostRate(cost, recipe.sellingPrice);
            const status = costRate <= recipe.targetCostRate ? 'good' : costRate <= recipe.targetCostRate * 1.1 ? 'warning' : 'danger';
            return (
              <div key={recipe.id} className="recipe-card">
                <div className="recipe-card-header">
                  <div>
                    <span className={`category-badge category-${recipe.category}`}>
                      {CATEGORY_LABELS[recipe.category]}
                    </span>
                    <h3 className="recipe-name">{recipe.name}</h3>
                  </div>
                  {!isPrep && (
                    <div className={`cost-badge cost-badge-${status}`}>{formatPercent(costRate)}</div>
                  )}
                </div>
                <div className="recipe-card-body">
                  {isPrep ? (
                    <>
                      <div className="recipe-price-row">
                        <span className="label">原価合計</span>
                        <span className="value">{formatCurrency(cost)}</span>
                      </div>
                      {recipe.yieldAmount > 0 && (
                        <div className="recipe-price-row">
                          <span className="label">1{recipe.yieldUnit}あたり</span>
                          <span className="value">{formatCurrency(cost / recipe.yieldAmount)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="recipe-price-row">
                        <span className="label">販売価格</span>
                        <span className="value">{formatCurrency(recipe.sellingPrice)}</span>
                      </div>
                      <div className="recipe-price-row">
                        <span className="label">原価</span>
                        <span className="value">{formatCurrency(cost)}</span>
                      </div>
                      <CostRateBar costRate={costRate} targetCostRate={recipe.targetCostRate} />
                    </>
                  )}
                </div>
                <div className="recipe-card-footer">
                  <button className="btn btn-icon" onClick={() => setViewRecipe(recipe)} title="詳細"><Eye size={16} /></button>
                  <button className="btn btn-icon" onClick={() => { setEditRecipe(recipe); setShowForm(true); }} title="編集"><Edit2 size={16} /></button>
                  <button className="btn btn-icon btn-icon-danger" onClick={() => setDeleteTarget(recipe)} title="削除"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <RecipeForm
          recipe={editRecipe}
          ingredients={ingredients}
          spices={spices}
          allRecipes={recipes}
          onClose={handleFormClose}
          addToast={addToast}
        />
      )}

      {viewRecipe && (
        <RecipeDetail
          recipe={viewRecipe}
          ingredients={ingredients}
          spices={spices}
          onClose={() => setViewRecipe(null)}
          onEdit={() => { setEditRecipe(viewRecipe); setViewRecipe(null); setShowForm(true); }}
        />
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
