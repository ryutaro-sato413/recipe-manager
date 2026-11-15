interface CostRateBarProps {
  costRate: number;
  targetCostRate: number;
  showLabel?: boolean;
}

export default function CostRateBar({ costRate, targetCostRate = 30, showLabel = true }: CostRateBarProps) {
  const baseTarget = targetCostRate || 30;
  const status =
    costRate <= baseTarget ? 'good' :
    costRate <= baseTarget * 1.1 ? 'warning' : 'danger';

  const barWidth = Math.min(costRate, 100);

  return (
    <div className="cost-rate-bar-wrapper">
      {showLabel && (
        <div className="cost-rate-bar-labels">
          <span className="cost-rate-target">原価率</span>
          <span className={`cost-rate-value cost-rate-${status}`}>
            {costRate.toFixed(1)}%
          </span>
        </div>
      )}
      <div className="cost-rate-bar-bg">
        <div
          className={`cost-rate-bar-fill cost-rate-fill-${status}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
