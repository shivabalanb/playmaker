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

  // Get color based on score - interpolate from red -> orange -> light blue -> solid blue
  const getScoreColor = () => {
    // Clamp score between 0 and 100
    const normalizedScore = Math.max(0, Math.min(100, score));
    
    // Define RGB values for the gradient stops
    const red = { r: 239, g: 68, b: 68 };        // #ef4444
    const orange = { r: 249, g: 115, b: 22 };    // #f97316
    const lightBlue = { r: 56, g: 189, b: 248 }; // #38bdf8
    const solidBlue = { r: 37, g: 99, b: 235 };  // #2563eb
    
    let r, g, b;
    
    if (normalizedScore <= 40) {
      // Red to Orange (0-40)
      const t = normalizedScore / 40;
      r = Math.round(red.r + (orange.r - red.r) * t);
      g = Math.round(red.g + (orange.g - red.g) * t);
      b = Math.round(red.b + (orange.b - red.b) * t);
    } else if (normalizedScore <= 70) {
      // Orange to Light Blue (40-70)
      const t = (normalizedScore - 40) / 30;
      r = Math.round(orange.r + (lightBlue.r - orange.r) * t);
      g = Math.round(orange.g + (lightBlue.g - orange.g) * t);
      b = Math.round(orange.b + (lightBlue.b - orange.b) * t);
    } else {
      // Light Blue to Solid Blue (70-100)
      const t = (normalizedScore - 70) / 30;
      r = Math.round(lightBlue.r + (solidBlue.r - lightBlue.r) * t);
      g = Math.round(lightBlue.g + (solidBlue.g - lightBlue.g) * t);
      b = Math.round(lightBlue.b + (solidBlue.b - lightBlue.b) * t);
    }
    
    return `rgb(${r}, ${g}, ${b})`;
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

