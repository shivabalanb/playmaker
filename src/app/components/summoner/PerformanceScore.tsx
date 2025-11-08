interface PerformanceScoreProps {
  score: number;
  rank: number;
  totalPlayers: number;
}

export function PerformanceScore({
  score,
  rank,
  totalPlayers,
}: PerformanceScoreProps) {
  // Calculate percentage for circular progress (0-100)
  const percentage = Math.min(score, 100);
  const radius = 22; // radius to fit in 64px container with padding
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Get color based on score
  const getScoreColor = () => {
    if (score >= 80) return "#10b981"; // green
    if (score >= 65) return "#3b82f6"; // blue
    if (score >= 50) return "#eab308"; // yellow
    if (score >= 35) return "#f97316"; // orange
    return "#ef4444"; // red
  };

  const color = getScoreColor();

  // Get rank suffix
  const getRankSuffix = (rank: number) => {
    if (rank === 1) return "st";
    if (rank === 2) return "nd";
    if (rank === 3) return "rd";
    return "th";
  };

  return (
    <div className="flex items-center gap-2">
      {/* Score and Rank Text */}
      <div className="flex flex-col justify-center">
        <div className="text-xl font-bold leading-none" style={{ color }}>
          {score}
        </div>
        <div className="text-[8px] text-gray-400 mt-0.5">
          {rank}
          {getRankSuffix(rank)}
        </div>
      </div>

      {/* Circular Progress */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="transform -rotate-90 w-10 h-10">
          {/* Background circle */}
          <circle
            cx="20"
            cy="20"
            r={14}
            stroke="#2a3a4a"
            strokeWidth="2.5"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="20"
            cy="20"
            r={14}
            stroke={color}
            strokeWidth="2.5"
            fill="none"
            strokeDasharray={2 * Math.PI * 14}
            strokeDashoffset={2 * Math.PI * 14 - (percentage / 100) * 2 * Math.PI * 14}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
      </div>
    </div>
  );
}

