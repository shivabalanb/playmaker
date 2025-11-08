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
    <div className="flex items-center gap-3">
      {/* Score and Rank Text */}
      <div className="flex flex-col justify-center">
        <div className="text-3xl font-bold leading-none" style={{ color }}>
          {score}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {rank}
          {getRankSuffix(rank)}
        </div>
      </div>

      {/* Circular Progress */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="transform -rotate-90 w-16 h-16">
          {/* Background circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="#2a3a4a"
            strokeWidth="4"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
      </div>
    </div>
  );
}

