interface ChemistryIndicatorProps {
  score: number;
  label?: string;
}

function getChemColor(score: number): { bg: string; text: string; border: string } {
  if (score >= 80) {
    return { bg: 'bg-green-600/80', text: 'text-white', border: 'border-green-500/50' };
  }
  if (score >= 50) {
    return { bg: 'bg-yellow-500/80', text: 'text-gray-900', border: 'border-yellow-400/50' };
  }
  return { bg: 'bg-red-500/80', text: 'text-white', border: 'border-red-400/50' };
}

export default function ChemistryIndicator({ score, label = 'CHE' }: ChemistryIndicatorProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const { bg, text, border } = getChemColor(clampedScore);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${bg} ${text} ${border} backdrop-blur-sm`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">
        {clampedScore}
      </span>
    </div>
  );
}
