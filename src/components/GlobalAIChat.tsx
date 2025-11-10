"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useDisplayedMatches } from "@/contexts/DisplayedMatchesContext";

export function GlobalAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousPathnameRef = useRef<string | null>(null);
  
  // Position and size state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 672, height: 600 }); // Default: max-w-2xl ~ 672px
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeCorner, setResizeCorner] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  
  // Calculate scale factor based on modal width (base size is 672px)
  // Cap the scale between 0.7 and 2.0 for readability
  const scale = Math.min(Math.max(size.width / 672, 0.7), 2.0);
  
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const { 
    messages, 
    isConnected, 
    isLoading, 
    sendMessage, 
    selectedMatchIds,
    selectedMatches,
    isIngesting,
    ingestionStatus,
    addMatchId,
    removeMatchId,
    clearSelectedMatches,
    clearMessages,
    stopIngestionPolling
  } = useWebSocket();

  const { displayedMatchIds } = useDisplayedMatches();

  // Determine if we should show the AI chat button
  const showAIChat = pathname?.includes("/match/") || pathname?.includes("/summoner/");

  // Function to scroll to and highlight a match
  const scrollToMatch = (matchId: string) => {
    // Find the match element by data attribute
    const matchElement = document.querySelector(`[data-match-id="${matchId}"]`);
    if (matchElement) {
      // Scroll to the match with smooth animation
      matchElement.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Add highlight class
      matchElement.classList.add("match-highlight");
      
      // Remove highlight after animation completes
      setTimeout(() => {
        matchElement.classList.remove("match-highlight");
      }, 2000);
    }
  };

  // Function to render message content with clickable match IDs
  const renderMessageContent = (content: string) => {
    // Only process on summoner page
    if (!pathname?.includes("/summoner/")) {
      return content;
    }

    // Regex to match match IDs (format: NA1_1234567890 or similar region codes)
    const matchIdRegex = /\b([A-Z]{2,4}1?_\d{10,})\b/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = matchIdRegex.exec(content)) !== null) {
      const matchId = match[1];
      
      // Add text before match ID
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      // Add clickable match ID
      parts.push(
        <button
          key={`match-${match.index}`}
          onClick={() => scrollToMatch(matchId)}
          className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded border border-blue-500/30 transition-colors cursor-pointer font-mono text-xs"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          {matchId}
        </button>
      );
      
      lastIndex = match.index + matchId.length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : content;
  };

  // Get context based on current page
  const getContext = () => {
    // Match page: /match/[matchId]
    if (pathname?.includes("/match/")) {
      const matchId = pathname.split("/match/")[1];
      const puuid = searchParams.get("puuid");
      return { matchId, puuid };
    }
    
    // Summoner page: /summoner/[name]
    if (pathname?.includes("/summoner/")) {
      const puuid = searchParams.get("puuid");
      return { puuid };
    }
    
    return {};
  };

  // Handle Ctrl keyboard shortcut
  useEffect(() => {
    if (!showAIChat) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Ctrl key press (without any other keys)
      if (e.key === "Control" && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Close on Escape
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showAIChat]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isLoading) return;

    const context = getContext();
    
    // On summoner page: use selected matches, or all displayed matches if none selected
    let matchIdsToSend: string[] | undefined;
    if (pathname?.includes("/summoner/")) {
      if (selectedMatchIds.length > 0) {
        matchIdsToSend = selectedMatchIds;
      } else if (displayedMatchIds.length > 0) {
        matchIdsToSend = displayedMatchIds;
      }
    }
    
    sendMessage(
      inputMessage.trim(),
      context.matchId,
      context.puuid || undefined,
      matchIdsToSend
    );
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const matchId = e.dataTransfer.getData("matchId");
    const championName = e.dataTransfer.getData("championName");
    const championImageUrl = e.dataTransfer.getData("championImageUrl");
    
    if (matchId) {
      addMatchId(matchId, championName || undefined, championImageUrl || undefined);
    }
  };

  // Modal drag handlers
  const handleModalDragStart = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    setIsDragging(true);
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleModalDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleModalDragEnd = () => {
    setIsDragging(false);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeCorner(corner);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !resizeCorner) return;
    
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    
    let newWidth = size.width;
    let newHeight = size.height;
    let newX = position.x;
    let newY = position.y;
    
    // Handle different corners
    switch (resizeCorner) {
      case 'se': // Bottom-right
        newWidth = Math.max(400, resizeStart.width + deltaX);
        newHeight = Math.max(300, resizeStart.height + deltaY);
        break;
      case 'sw': // Bottom-left
        newWidth = Math.max(400, resizeStart.width - deltaX);
        newHeight = Math.max(300, resizeStart.height + deltaY);
        if (newWidth > 400) {
          newX = position.x + (size.width - newWidth);
        }
        break;
      case 'ne': // Top-right
        newWidth = Math.max(400, resizeStart.width + deltaX);
        newHeight = Math.max(300, resizeStart.height - deltaY);
        if (newHeight > 300) {
          newY = position.y + (size.height - newHeight);
        }
        break;
      case 'nw': // Top-left
        newWidth = Math.max(400, resizeStart.width - deltaX);
        newHeight = Math.max(300, resizeStart.height - deltaY);
        if (newWidth > 400) {
          newX = position.x + (size.width - newWidth);
        }
        if (newHeight > 300) {
          newY = position.y + (size.height - newHeight);
        }
        break;
    }
    
    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeCorner(null);
  };

  // Add mouse move and up listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleModalDragMove);
      window.addEventListener('mouseup', handleModalDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleModalDragMove);
        window.removeEventListener('mouseup', handleModalDragEnd);
      };
    }
  }, [isDragging, dragOffset]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, resizeStart]);

  // Center modal when opened
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      setPosition({
        x: (window.innerWidth - size.width) / 2,
        y: window.innerHeight * 0.1, // 10vh from top
      });
    }
  }, [isOpen]);

  // Clear chat data when modal closes (but not ingestion polling - that's page-level)
  useEffect(() => {
    if (!isOpen) {
      clearMessages();
      clearSelectedMatches();
      // Don't stop ingestion polling when just closing modal - it's a background process
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Clear chat data when switching between different summoner profiles
  useEffect(() => {
    // Only clear if pathname actually changed and we're on a summoner page
    if (pathname?.includes("/summoner/") && previousPathnameRef.current !== null && previousPathnameRef.current !== pathname) {
      clearMessages();
      clearSelectedMatches();
      stopIngestionPolling();
    }
    previousPathnameRef.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Don't show anything if not on a valid page
  if (!showAIChat) {
    return null;
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600/90 hover:bg-blue-700 text-white p-2 rounded-lg shadow-lg flex items-center gap-1.5 transition-colors relative"
        >
          {/* Ingestion indicator */}
          {isIngesting && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          )}
          {/* AI Diamond Icon */}
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {/* Ctrl Icon */}
          <kbd className="px-1 py-0.5 text-[10px] bg-blue-800 rounded font-mono">
            ctrl
          </kbd>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Modal - Draggable and Resizable */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div 
          ref={modalRef}
          className="pointer-events-auto absolute"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            userSelect: isDragging || isResizing ? 'none' : 'auto',
          }}
        >
          <div 
            className={`relative bg-gray-900 rounded-2xl shadow-2xl border overflow-hidden transition-all h-full flex flex-col ${
              isDragOver 
                ? "border-blue-500 border-2 shadow-blue-500/50" 
                : "border-gray-700"
            } ${isDragging ? 'cursor-move' : ''}`}
            style={{ fontSize: `${scale}rem` }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Header - Draggable */}
            <div 
              className="bg-gray-800/50 px-6 py-3 border-b border-gray-700/50 flex items-center justify-between cursor-move"
              onMouseDown={handleModalDragStart}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-white text-sm font-medium">
                  {pathname?.includes("/match/") ? "Match Analysis AI" : "Summoner Analysis AI"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isConnected
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {isConnected ? "Connected" : "Connecting..."}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Selected Matches - Only show on summoner page */}
            {pathname?.includes("/summoner/") && selectedMatchIds.length > 0 && (
              <div className="bg-gray-800/30 px-6 py-3 border-b border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-medium">
                    Selected Matches ({selectedMatchIds.length})
                  </span>
                  <button
                    onClick={clearSelectedMatches}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedMatches.map((match) => (
                    <div
                      key={match.matchId}
                      className="bg-gray-700/50 px-2 py-1 rounded-full flex items-center gap-2 text-xs text-gray-300"
                    >
                      <img
                        src={match.championImageUrl}
                        alt={match.championName}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-xs font-medium">{match.championName}</span>
                      <button
                        onClick={() => removeMatchId(match.matchId)}
                        className="text-gray-400 hover:text-red-400 transition-colors ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drag Hint - Show when dragging over on summoner page */}
            {pathname?.includes("/summoner/") && isDragOver && (
              <div className="bg-blue-500/10 px-6 py-4 border-b border-blue-500/50">
                <div className="text-center text-blue-400 text-sm font-medium">
                  Drop match here to add to selection
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-12">
                  <div className="mb-2">💬</div>
                  <div>
                    {pathname?.includes("/match/")
                      ? "Ask questions about this match"
                      : "Ask questions about this summoner"}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {pathname?.includes("/match/")
                      ? 'Try: "What happened in the early game?"'
                      : 'Try: "How is this player performing overall?"'}
                  </div>
                </div>
              )}
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-gray-800 text-gray-100 shadow-md"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 text-gray-100 rounded-xl px-4 py-3 shadow-md">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700/50 bg-gray-800/30">
              {/* Ingestion status indicator */}
              {isIngesting && (
                <div className="mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-xs text-yellow-400">
                    Processing match data... ({ingestionStatus || 'PENDING'})
                  </span>
                </div>
              )}
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    isIngesting
                      ? "Waiting for match data to be processed..."
                      : pathname?.includes("/match/")
                      ? "Ask about this match..."
                      : "Ask about this summoner..."
                  }
                  disabled={!isConnected || isLoading || isIngesting}
                  className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!isConnected || isLoading || isIngesting || !inputMessage.trim()}
                  className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg hover:shadow-xl disabled:shadow-none flex items-center gap-2"
                >
                  <span>Send</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Resize Handles - invisible but functional */}
            {/* Top-left */}
            <div
              className="absolute top-0 left-0 w-8 h-8 cursor-nw-resize z-10"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
            {/* Top-right */}
            <div
              className="absolute top-0 right-0 w-8 h-8 cursor-ne-resize z-10"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            {/* Bottom-left */}
            <div
              className="absolute bottom-0 left-0 w-8 h-8 cursor-sw-resize z-10"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            {/* Bottom-right */}
            <div
              className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize z-10"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
          </div>
        </div>
      </div>
    </>
  );
}
