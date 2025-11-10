"use client";

import React, { createContext, useContext, useState } from "react";

interface DisplayedMatchesContextType {
  displayedMatchIds: string[];
  setDisplayedMatchIds: (matchIds: string[]) => void;
}

const DisplayedMatchesContext = createContext<DisplayedMatchesContextType | null>(null);

export function useDisplayedMatches() {
  const context = useContext(DisplayedMatchesContext);
  if (!context) {
    throw new Error("useDisplayedMatches must be used within DisplayedMatchesProvider");
  }
  return context;
}

export function DisplayedMatchesProvider({ children }: { children: React.ReactNode }) {
  const [displayedMatchIds, setDisplayedMatchIds] = useState<string[]>([]);

  return (
    <DisplayedMatchesContext.Provider
      value={{
        displayedMatchIds,
        setDisplayedMatchIds,
      }}
    >
      {children}
    </DisplayedMatchesContext.Provider>
  );
}
