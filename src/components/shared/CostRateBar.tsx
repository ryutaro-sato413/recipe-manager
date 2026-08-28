interface CostRateBarProps {
  costRate: number;
  targetCostRate: number;
  showLabel?: boolean;
}

export default function CostRateBar({ costRate, targetCostRate, showLabel = true }: CostRateBarProps) {
  const status =
    costRate <= targetCostRate ? 'good' :
    costRate <= targetCostRate * 1.1 ? 'warning' : 'danger';

  const barWidth = Math.min(costRate, 100);

  return (
    <div className="cost-rate-bar-wrapper">
      {showLabel && (
        <div className="cost-rate-bar-labels">
          <span className={`cost-rate-value cost-rate-${status}`}>
            {costRate.toFixed(1)}%
          </span>
          <span className="cost-rate-target">目標: {targetCostRate}%</span>
        </div>
      )}
      <div className="cost-rate-bar-bg">
        <div
          className={`cost-rate-bar-fill cost-rate-fill-${status}`}
          style={{ width: `${barWidth}%` }}
        />
        <div
          className="cost-rate-target-line"
          style={{ left: `${Math.min(targetCostRate, 100)}%` }}
        />
      </div>
    </div>
  );
}
