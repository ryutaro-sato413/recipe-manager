import { Recipe, Ingredient, Spice } from '../../types';
import { calculateTotalCost, calculateCostRate, formatCurrency, formatPercent } from '../../utils/calculations';
import Modal from '../shared/Modal';
import CostRateBar from '../shared/CostRateBar';
import { Edit2 } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  food: 'フード',
  drink: 'ドリンク',
  dessert: 'デザート',
  other: 'その他',
};

interface RecipeDetailProps {
  recipe: Recipe;
  ingredients: Ingredient[];
  spices: Spice[];
  onClose: () => void;
  onEdit: () => void;
}

export default function RecipeDetail({ recipe, onClose, onEdit }: RecipeDetailProps) {
  const cost = calculateTotalCost(recipe);
  const costRate = calculateCostRate(cost, recipe.sellingPrice);

  return (
    <Modal title={recipe.name} onClose={onClose} size="lg">
      <div className="recipe-detail">
        <div className="detail-header">
          <span className={`category-badge category-${recipe.category}`}>
            {CATEGORY_LABELS[recipe.category]}
          </span>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>
            <Edit2 size={14} />
            編集
          </button>
        </div>

        <div className="detail-summary">
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
        </div>

        <CostRateBar costRate={costRate} targetCostRate={recipe.targetCostRate} />

        {recipe.ingredients.length > 0 && (
          <div className="detail-section">
            <h4 className="detail-section-title">食材一覧</h4>
            <table className="detail-table">
              <thead>
                <tr>
                  <th>食材名</th>
                  <th>使用量</th>
                  <th>単位</th>
                  <th>単価</th>
                  <th>コスト</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td>{ing.name}</td>
                    <td>{ing.amount}</td>
                    <td>{ing.unit}</td>
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
              <thead>
                <tr>
                  <th>スパイス名</th>
                  <th>使用量</th>
                  <th>単位</th>
                  <th>単価</th>
                  <th>コスト</th>
                </tr>
              </thead>
              <tbody>
                {recipe.spices.map((sp, i) => (
                  <tr key={i}>
                    <td>{sp.name}</td>
                    <td>{sp.amount}</td>
                    <td>{sp.unit}</td>
                    <td>{formatCurrency(sp.unitPrice)}</td>
                    <td>{formatCurrency(sp.amount * sp.unitPrice)}</td>
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
