interface SlideNavigationProps {
  totalSlides: number;
  currentSlide: number;
  onSlideChange: (index: number) => void;
  onSkip: () => void;
  canSkip: boolean;
}

export function SlideNavigation({
  totalSlides,
  currentSlide,
  onSlideChange,
  onSkip,
  canSkip,
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

      {/* Skip button */}
      {canSkip && (
        <button
          onClick={onSkip}
          className="fixed top-8 right-8 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-sm transition-colors backdrop-blur-sm"
        >
          Skip →
        </button>
      )}
    </>
  );
}
