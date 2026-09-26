import { Recipe, Ingredient, Spice } from '../../types';
import { calculateTotalCost, calculateCostRate, formatCurrency, formatPercent } from '../../utils/calculations';
import Modal from '../shared/Modal';
import CostRateBar from '../shared/CostRateBar';
import { CATEGORY_LABELS } from '../RecipeForm/RecipeForm';
import { Edit2 } from 'lucide-react';

interface RecipeDetailProps {
  recipe: Recipe;
  ingredients: Ingredient[];
  spices: Spice[];
  onClose: () => void;
  onEdit: () => void;
}

export default function RecipeDetail({ recipe, onClose, onEdit }: RecipeDetailProps) {
  const cost = calculateTotalCost(recipe);
  const isPrep = recipe.category === 'prep';
  const costRate = isPrep ? 0 : calculateCostRate(cost, recipe.sellingPrice);

  return (
    <Modal title={recipe.name} onClose={onClose} size="lg">
      <div className="recipe-detail">
        <div className="detail-header">
          <span className={`category-badge category-${recipe.category}`}>
            {CATEGORY_LABELS[recipe.category]}
          </span>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>
            <Edit2 size={14} />編集
          </button>
        </div>

        <div className="detail-summary">
          {isPrep ? (
            <>
              <div className="summary-item">
                <span className="summary-label">原価合計</span>
                <span className="summary-value">{formatCurrency(cost)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">歩留まり量</span>
                <span className="summary-value">{recipe.yieldAmount}{recipe.yieldUnit}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">1{recipe.yieldUnit}あたりの原価</span>
                <span className="summary-value">
                  {recipe.yieldAmount > 0 ? formatCurrency(cost / recipe.yieldAmount) : '—'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="summary-item">
                <span className="summary-label">販売価格</span>
                <span className="summary-value">{formatCurrency(recipe.sellingPrice)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">原価合計</span>
                <span className="summary-value">{formatCurrency(cost)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">原価率</span>
                <span className="summary-value">{formatPercent(costRate)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">目標原価率</span>
                <span className="summary-value">{formatPercent(recipe.targetCostRate)}</span>
              </div>
            </>
          )}
        </div>

        {!isPrep && <CostRateBar costRate={costRate} targetCostRate={recipe.targetCostRate} />}

        {recipe.ingredients.length > 0 && (
          <div className="detail-section">
            <h4 className="detail-section-title">食材一覧</h4>
            <table className="detail-table">
              <thead><tr><th>食材名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th></tr></thead>
              <tbody>
                {recipe.ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td>{ing.name}</td><td>{ing.amount}</td><td>{ing.unit}</td>
                    <td>{formatCurrency(ing.unitPrice)}</td>
                    <td>{formatCurrency(ing.amount * ing.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recipe.spices.length > 0 && (
          <div className="detail-section">
            <h4 className="detail-section-title">スパイス一覧</h4>
            <table className="detail-table">
              <thead><tr><th>スパイス名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th></tr></thead>
              <tbody>
                {recipe.spices.map((sp, i) => (
                  <tr key={i}>
                    <td>{sp.name}</td><td>{sp.amount}</td><td>{sp.unit}</td>
                    <td>{formatCurrency(sp.unitPrice)}</td>
                    <td>{formatCurrency(sp.amount * sp.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(recipe.prepItems ?? []).length > 0 && (
          <div className="detail-section">
            <h4 className="detail-section-title">使用仕込み品</h4>
            <table className="detail-table">
              <thead><tr><th>仕込み品名</th><th>使用量</th><th>単位</th><th>単価</th><th>コスト</th></tr></thead>
              <tbody>
                {recipe.prepItems.map((p, i) => (
                  <tr key={i}>
                    <td>{p.recipeName}</td><td>{p.amount}</td><td>{p.unit}</td>
                    <td>{formatCurrency(p.costPerUnit)}</td>
                    <td>{formatCurrency(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recipe.memo && (
          <div className="detail-section">
            <h4 className="detail-section-title">メモ</h4>
            <p className="detail-memo">{recipe.memo}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
