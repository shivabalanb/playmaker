interface SlideNavigationProps {
  totalSlides: number;
  currentSlide: number;
  onSlideChange: (index: number) => void;
  onSkip: () => void;
  canSkip: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
}

export function SlideNavigation({
  totalSlides,
  currentSlide,
  onSlideChange,
  onSkip,
  canSkip,
  isPaused,
  onTogglePause,
}: SlideNavigationProps) {
  return (
    <>
      {/* Progress dots */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            onClick={() => onSlideChange(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentSlide
                ? "w-8 bg-blue-400"
                : "w-2 bg-gray-600 hover:bg-gray-500"
            }`}
          />
        ))}
      </div>

      {/* Control buttons */}
      <div className="fixed top-8 right-8 flex gap-3 z-10">
        {/* Pause/Play button */}
        <button
          onClick={onTogglePause}
          className="px-4 py-2 bg-gray-800/70 hover:bg-gray-700/70 rounded-lg text-sm transition-all backdrop-blur-sm flex items-center gap-2 border border-gray-600/50 hover:border-gray-500/50 shadow-lg"
          aria-label={isPaused ? "Play" : "Pause"}
        >
          {isPaused ? (
            <>
              <span className="text-lg">▶</span>
              <span>Play</span>
            </>
          ) : (
            <>
              <span className="text-lg">⏸</span>
              <span>Pause</span>
            </>
          )}
        </button>

      {/* Skip button */}
      {canSkip && (
        <button
          onClick={onSkip}
            className="px-4 py-2 bg-gray-800/70 hover:bg-gray-700/70 rounded-lg text-sm transition-all backdrop-blur-sm border border-gray-600/50 hover:border-gray-500/50 shadow-lg"
        >
          Skip →
        </button>
      )}
      </div>
    </>
  );
}
