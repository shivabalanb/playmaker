export function UnrankedCard() {
  return (
    <div className="backdrop-blur-sm rounded-xl p-6 border border-[#2a3544]/50 shadow-xl min-w-[400px]">
      <div className="flex items-center gap-5">
        
        {/* Unranked Info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
            Ranked Solo
          </div>
          <div className="text-3xl font-bold text-gray-300 mb-1 tracking-tight">
            Unranked
          </div>
        
        </div>
      </div>
    </div>
  );
}

