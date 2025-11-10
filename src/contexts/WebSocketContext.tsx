"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: string;
  content: string;
}

interface SelectedMatch {
  matchId: string;
  championName: string;
  championImageUrl: string;
  kda?: string;
  isVictory?: boolean;
}

interface WebSocketContextType {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  connectionError: string | null;
  selectedMatchIds: string[];
  selectedMatches: SelectedMatch[];
  isIngesting: boolean;
  ingestionStatus: string | null;
  setIngesting: (ingesting: boolean) => void;
  startIngestionPolling: (uploadTime: string) => void;
  stopIngestionPolling: () => void;
  sendMessage: (message: string, matchId?: string, puuid?: string, matchIds?: string[]) => void;
  clearMessages: () => void;
  addMatchId: (matchId: string, championName?: string, championImageUrl?: string, kda?: string, isVictory?: boolean) => void;
  removeMatchId: (matchId: string) => void;
  clearSelectedMatches: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<SelectedMatch[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Establish WebSocket connection on mount
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT!;

    const connect = () => {
      console.log(`[Global WebSocket] Attempting to connect to: ${wsUrl}`);

      try {
        const ws = new WebSocket(wsUrl);

        // Set connection timeout (10 seconds)
        connectionTimeoutRef.current = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            console.error("[Global WebSocket] Connection timeout after 10 seconds");
            setConnectionError("Connection timeout - server may be unreachable");
            ws.close();
            setIsConnected(false);
            
            // Try to reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 5000);
          }
        }, 10000);

        ws.onopen = () => {
          console.log("[Global WebSocket] ✅ Connected successfully");
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setIsConnected(true);
          setConnectionError(null);
        };

        ws.onmessage = (event) => {
          try {
            const messageText = event.data;
            console.log("[Global WebSocket] 📨 Received raw message:", messageText);

            // Parse the message
            const trimmed = messageText.trim();
            let parsed;

            if (trimmed.startsWith("<")) {
              const jsonPart = trimmed.substring(1).trim();
              parsed = JSON.parse(jsonPart);
            } else {
              parsed = JSON.parse(trimmed);
            }

            console.log("[Global WebSocket] 📦 Parsed message:", parsed);

            // Handle different message types
            if (parsed.type === "chunk" && typeof parsed.content === "string") {
              console.log("[Global WebSocket] ✅ Processing chunk message");
              setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    {
                      role: "assistant",
                      content: lastMessage.content + parsed.content,
                    },
                  ];
                } else {
                  return [
                    ...prev,
                    { role: "assistant", content: parsed.content },
                  ];
                }
              });
            } else if (parsed.type === "end") {
              console.log("[Global WebSocket] ✅ Received end message - stopping loading");
              setIsLoading(false);
            } else if (parsed.type === "error") {
              console.error("[Global WebSocket] ❌ Received error message:", parsed.content || parsed.message);
              setIsLoading(false);
              // Add error message to chat
              setMessages((prev) => [
                ...prev,
                { 
                  role: "assistant", 
                  content: `Error: ${parsed.content || parsed.message || "An error occurred while processing your request."}` 
                },
              ]);
            } else {
              console.warn("[Global WebSocket] ⚠️ Unknown message type:", parsed.type);
            }
          } catch (error) {
            console.error("[Global WebSocket] ❌ Error parsing message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[Global WebSocket] ❌ WebSocket error:", error);
          setConnectionError("WebSocket connection error");
          setIsConnected(false);
        };

        ws.onclose = (event) => {
          console.log("[Global WebSocket] Connection closed:", event.code, event.reason);
          setIsConnected(false);
          
          // Try to reconnect after 3 seconds if not a normal closure
          if (event.code !== 1000) {
            console.log("[Global WebSocket] 🔄 Attempting to reconnect in 3 seconds...");
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, 3000);
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("[Global WebSocket] ❌ Failed to create WebSocket:", error);
        setConnectionError("Failed to establish connection");
        
        // Try to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };

    connect();

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, []);

  const sendMessage = (message: string, matchId?: string, puuid?: string, matchIds?: string[]) => {
    if (!message.trim()) return;

    const userMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    console.log("[Global WebSocket] 📤 Sending message:", message);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload: any = {
        messages: [userMessage],
      };

      // Add matchIds (priority: explicit matchIds > single matchId > selectedMatchIds)
      if (matchIds && matchIds.length > 0) {
        payload.matchIds = matchIds;
      } else if (matchId) {
        payload.matchIds = [matchId];
      } else if (selectedMatchIds.length > 0) {
        payload.matchIds = selectedMatchIds;
      }
      
      if (puuid) {
        payload.pid = [puuid];
      }

      const payloadStr = JSON.stringify(payload);
      console.log("[Global WebSocket] 📤 Sending payload:", payloadStr);
      wsRef.current.send(payloadStr);
    } else {
      console.error(
        "[Global WebSocket] ❌ Cannot send - WebSocket not open. State:",
        wsRef.current?.readyState
      );
      setIsLoading(false);
    }
  };

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const addMatchId = useCallback((matchId: string, championName?: string, championImageUrl?: string, kda?: string, isVictory?: boolean) => {
    setSelectedMatchIds((prev) => {
      if (prev.includes(matchId)) return prev;
      return [...prev, matchId];
    });
    
    if (championName && championImageUrl) {
      setSelectedMatches((prev) => {
        if (prev.some(m => m.matchId === matchId)) return prev;
        return [...prev, { matchId, championName, championImageUrl, kda, isVictory }];
      });
    }
  }, []);

  const removeMatchId = useCallback((matchId: string) => {
    setSelectedMatchIds((prev) => prev.filter((id) => id !== matchId));
    setSelectedMatches((prev) => prev.filter((m) => m.matchId !== matchId));
  }, []);

  const clearSelectedMatches = useCallback(() => {
    setSelectedMatchIds([]);
    setSelectedMatches([]);
  }, []);

  // Set ingestion state immediately (before polling starts)
  const setIngesting = useCallback((ingesting: boolean) => {
    setIsIngesting(ingesting);
    if (!ingesting) {
      setIngestionStatus(null);
    }
  }, []);

  // Poll ingestion status
  const startIngestionPolling = useCallback((uploadTime: string) => {
    // Don't start if already polling or already complete
    if (pollingIntervalRef.current) {
      console.log('[Ingestion Polling] Already polling, skipping');
      return;
    }
    
    console.log('[Ingestion Polling] Starting polling with uploadTime:', uploadTime);
    setIsIngesting(true);
    setIngestionStatus('PENDING');
    
    const pollStatus = async () => {
      const pollUrl = `${process.env.NEXT_PUBLIC_PARSE_ENDPOINT}?uploadTime=${encodeURIComponent(uploadTime)}`;
      console.log('[Ingestion Polling] Polling URL:', pollUrl);
      
      try {
        const response = await fetch(pollUrl);
        
        console.log('[Ingestion Polling] Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Ingestion Polling] Response data:', data);
          setIngestionStatus(data.status);
          
          // Stop polling if completed or failed
          if (data.status === 'COMPLETE' || data.status === 'FAILED') {
            console.log('[Ingestion Polling] Ingestion finished with status:', data.status);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            // Wait 10 seconds before unblocking UI
            console.log('[Ingestion Polling] Waiting 10 seconds before unblocking UI...');
            setTimeout(() => {
              console.log('[Ingestion Polling] UI unblocked');
              setIsIngesting(false);
            }, 10000);
            
            return; // Stop polling immediately
          } else {
            console.log('[Ingestion Polling] Still processing, status:', data.status);
          }
        } else {
          console.error('[Ingestion Polling] Non-OK response:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('[Ingestion Polling] Error polling ingestion status:', error);
      }
    };
    
    // Poll immediately and then every 5 seconds
    console.log('[Ingestion Polling] Starting immediate poll...');
    pollStatus();
    pollingIntervalRef.current = setInterval(() => {
      console.log('[Ingestion Polling] Interval poll triggered');
      pollStatus();
    }, 5000);
  }, []);

  const stopIngestionPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsIngesting(false);
    setIngestionStatus(null);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        messages,
        isConnected,
        isLoading,
        connectionError,
        selectedMatchIds,
        selectedMatches,
        isIngesting,
        ingestionStatus,
        setIngesting,
        startIngestionPolling,
        stopIngestionPolling,
        sendMessage,
        clearMessages,
        addMatchId,
        removeMatchId,
        clearSelectedMatches,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
