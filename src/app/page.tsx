"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [summonerName, setSummonerName] = useState("");
  const [region, setRegion] = useState("na1");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Map platform regions to routing regions
  const getRoutingRegion = (platform: string): string => {
    const regionMap: Record<string, string> = {
      na1: "americas",
      br1: "americas",
      la1: "americas",
      la2: "americas",
      euw1: "europe",
      eun1: "europe",
      tr1: "europe",
      ru: "europe",
      kr: "asia",
      jp1: "asia",
      oc1: "sea",
      ph2: "sea",
      sg2: "sea",
      th2: "sea",
      tw2: "sea",
      vn2: "sea",
    };
    return regionMap[platform] || "americas";
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!summonerName.trim()) {
      setError("Please enter a summoner name");
      return;
    }

    // Parse summoner name (format: gameName#tagLine)
    const parts = summonerName.trim().split("#");
    const gameName = parts[0];
    const tagLine = parts[1];

    if (!gameName) {
      setError("Please enter a summoner name");
      return;
    }

    if (!tagLine) {
      setError("Please include tag line (e.g., Player#NA1)");
      return;
    }

    setIsLoading(true);

    const routingRegion = getRoutingRegion(region);

    try {
      const response = await fetch(
        `/api/riot/account?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&region=${routingRegion}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to find summoner");
      }

      const data = await response.json();

      // Redirect to summoner profile page
      router.push(
        `/summoner/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}?puuid=${data.puuid}&region=${routingRegion}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find summoner");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923]">
      {/* Header */}
      <header className="pt-8 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-6xl font-bold text-white mb-2 tracking-tight">
            PLAYMAKER
          </h1>
          <p className="text-gray-400 text-sm tracking-wider">
            LEAGUE OF LEGENDS STATS
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 max-w-5xl">
        {/* Search Box */}
        <div className="mb-12">
          <form onSubmit={handleSearch}>
            <div className="bg-[#2a3544] rounded-2xl p-6 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Region Selector */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    disabled={isLoading}
                    className="w-full py-3 px-4 text-gray-300 bg-[#1a2332] border border-[#3a4554] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                  >
                    <optgroup label="Americas">
                      <option value="na1">North America</option>
                      <option value="br1">Brazil</option>
                    </optgroup>
                    <optgroup label="Europe">
                      <option value="euw1">Europe West</option>
                      <option value="eun1">Europe Nordic & East</option>
                      <option value="tr1">Türkiye</option>
                      <option value="ru">Russia</option>
                    </optgroup>
                    <optgroup label="Asia">
                      <option value="kr">Korea</option>
                      <option value="jp1">Japan</option>
                    </optgroup>
                    <optgroup label="Southeast Asia & Oceania">
                      <option value="oc1">Oceania</option>
                      <option value="ph2">Philippines</option>
                      <option value="sg2">Singapore</option>
                      <option value="th2">Thailand</option>
                      <option value="tw2">Taiwan</option>
                      <option value="vn2">Vietnam</option>
                    </optgroup>
                  </select>
                </div>

                {/* Search Input */}
                <div className="md:col-span-7">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Enter Summoner Name (e.g., Player#NA1)
                  </label>
                  <input
                    type="text"
                    value={summonerName}
                    onChange={(e) => setSummonerName(e.target.value)}
                    placeholder="Player#NA1"
                    disabled={isLoading}
                    className="w-full py-3 px-4 text-gray-200 bg-[#1a2332] border border-[#3a4554] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500 disabled:opacity-50"
                  />
                </div>

                {/* Search Button */}
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <span className="text-sm">...</span>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </div>
          </form>
        </div>

        {/* Quick Search Suggestions */}
        <div className="mb-12 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => {
              setSummonerName("Faker#KR1");
              setRegion("kr");
            }}
            className="px-4 py-2 bg-[#2a3544] hover:bg-[#354252] text-gray-300 rounded-full text-sm transition-colors flex items-center gap-2"
          >
            <span className="text-blue-400">✦</span>
            How&apos;s Faker doing lately?
          </button>
          <button
            onClick={() => {
              setSummonerName("Doublelift#NA1");
              setRegion("na1");
            }}
            className="px-4 py-2 bg-[#2a3544] hover:bg-[#354252] text-gray-300 rounded-full text-sm transition-colors flex items-center gap-2"
          >
            <span className="text-blue-400">✦</span>
            Check out Doublelift&apos;s matches
          </button>
          <button
            onClick={() => {
              setSummonerName("hide on bush#KR1");
              setRegion("kr");
            }}
            className="px-4 py-2 bg-[#2a3544] hover:bg-[#354252] text-gray-300 rounded-full text-sm transition-colors flex items-center gap-2"
          >
            <span className="text-blue-400">✦</span>
            Check hide on bush stats
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="bg-[#1e2a3a] border border-[#2a3a4a] rounded-xl p-6 hover:border-blue-500 transition-colors duration-200">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Player Stats
            </h3>
            <p className="text-gray-400 text-sm">
              View detailed statistics for any summoner
            </p>
          </div>

          <div className="bg-[#1e2a3a] border border-[#2a3a4a] rounded-xl p-6 hover:border-blue-500 transition-colors duration-200">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Match History
            </h3>
            <p className="text-gray-400 text-sm">
              Analyze recent games and performance
            </p>
          </div>

          <div className="bg-[#1e2a3a] border border-[#2a3a4a] rounded-xl p-6 hover:border-blue-500 transition-colors duration-200">
            <div className="text-4xl mb-4">⚔️</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Champion Data
            </h3>
            <p className="text-gray-400 text-sm">
              Explore champion builds and winrates
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-16 text-center">
          <p className="text-gray-400 text-sm">
            Enter a summoner name to view their profile, stats, and match
            history
          </p>
        </div>
      </main>
    </div>
  );
}
