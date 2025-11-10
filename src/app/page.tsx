"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const proPlayers = [
  { displayName: "T1 Doran", accountName: "어리고싶다", tag: "KR1", region: "kr" },
  { displayName: "T1 Oner", accountName: "오 너", tag: "111", region: "kr" },
  { displayName: "T1 Faker", accountName: "Hide on bush", tag: "KR1", region: "kr" },
  { displayName: "T1 Gumayusi", accountName: "구르시", tag: "녹서스", region: "kr" },
  { displayName: "T1 Keria", accountName: "Keria", tag: "4111", region: "kr" },
  { displayName: "GenG Canyon", accountName: "JUGKlNG", tag: "kr", region: "kr" },
  { displayName: "GenG Kiin", accountName: "kiin", tag: "KR1", region: "kr" },
  { displayName: "GenG Chovy", accountName: "허거덩", tag: "0303", region: "kr" },
  { displayName: "GenG Ruler", accountName: "귀찮게하지마", tag: "KR3", region: "kr" },
  { displayName: "GenG Duro", accountName: "Duro", tag: "Gen", region: "kr" },
  { displayName: "T1 Zeus", accountName: "우제초이", tag: "Kr2", region: "kr" },
  { displayName: "HLE Zeka", accountName: "dlwldms", tag: "iuiu", region: "kr" },
  { displayName: "HLE Viper", accountName: "Blue", tag: "KR33", region: "kr" },
  { displayName: "G2 Caps", accountName: "G2 Caps", tag: "1323", region: "euw1" },
  { displayName: "G2 BrokenBlade", accountName: "G2 BrokenBlade", tag: "1918", region: "euw1" },
  { displayName: "G2 Skewmond", accountName: "G2 SkewMond", tag: "3327", region: "euw1" },
  { displayName: "G2 Hans Sama", accountName: "G2 Hans Sama", tag: "12838", region: "euw1" },
  { displayName: "Doublelift", accountName: "Peng Yiliang", tag: "NA1", region: "na1" },
  { displayName: "Sneaky", accountName: "Sneaky", tag: "NA69", region: "na1" },
  { displayName: "Rekkles", accountName: "LR Rekkles", tag: "ADC", region: "euw1" },
];

// Shuffle array
const shuffledPlayers = [...proPlayers].sort(() => Math.random() - 0.5);

export default function Home() {
  const [summonerName, setSummonerName] = useState("");
  const [region, setRegion] = useState("na1");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentFeature, setCurrentFeature] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [displayedName, setDisplayedName] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const router = useRouter();

  const features = [
    {
      title: "Timeline",
      sentences: [
        { text: "Drag and drop matches into the chatbot for frame-by-frame analysis of your gameplay", keywords: ["frame-by-frame"] },
      ],
      color: "blue",
      gradient: "from-blue-500/20 to-purple-500/20",
      image: "/timeline.png"
    },
    {
      title: "Event Tracking",
      sentences: [
        { text: "Every kill, every objective, every turret tracked and recreated.", keywords: ["tracked", "recreated"] },
      ],
      color: "purple",
      gradient: "from-purple-500/20 to-pink-500/20",
      image: "/events.png"
    },
    {
      title: "Season Rewind",
      sentences: [
        { text: "Your personal year-in-review with stunning visuals.", keywords: ["stunning visuals"] },
      ],
      color: "green",
      gradient: "from-green-500/20 to-cyan-500/20",
      image: "/end%20recap.png"
    },
    {
      title: "Match Stories",
      sentences: [
        { text: "AI-powered narratives turn your matches into epic tales.", keywords: ["epic",  "tales"] }
      ],
      color: "yellow",
      gradient: "from-yellow-500/20 to-orange-500/20",
      image: "/stories.png"
    }
  ];

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
      setAnimationKey((prev) => prev + 1); // Trigger text animation
    }, 18000); // Change every 18 seconds

    return () => clearInterval(interval);
  }, [features.length]);

  // Typing animation for pro players
  useEffect(() => {
    const currentPlayer = shuffledPlayers[currentPlayerIndex];
    const targetName = currentPlayer.displayName;
    
    if (isTyping) {
      // Typing forward
      if (displayedName.length < targetName.length) {
        const timeout = setTimeout(() => {
          setDisplayedName(targetName.slice(0, displayedName.length + 1));
        }, 80); // Type speed
        return () => clearTimeout(timeout);
      } else {
        // Finished typing, wait before deleting
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000); // Pause at full name
        return () => clearTimeout(timeout);
      }
    } else {
      // Deleting backward
      if (displayedName.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayedName(displayedName.slice(0, -1));
        }, 50); // Delete speed (faster)
        return () => clearTimeout(timeout);
      } else {
        // Finished deleting, move to next player
        setCurrentPlayerIndex((prev) => (prev + 1) % shuffledPlayers.length);
        setIsTyping(true);
      }
    }
  }, [displayedName, isTyping, currentPlayerIndex]);

  // Trigger animation when manually changing feature
  const handleFeatureChange = (index: number) => {
    setCurrentFeature(index);
    setAnimationKey((prev) => prev + 1);
  };

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
    <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#1a2332] to-[#0f1923] relative">
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage: 'url(/ielia.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'blur(3px)',
        }}
      />
      
      {/* Content Overlay */}
      <div className="relative z-10">
        {/* Header */}
        <header className="pt-8 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-6xl font-bold text-white mb-2 tracking-tight mt-10">
            PLAYMAKER
          </h1>
          <p className="text-gray-400 text-sm tracking-wider">
            LEAGUE OF LEGENDS STATS
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 max-w-5xl mt-8">
        {/* Search Box */}
        <div className="mt-20 mb-4 max-w-2xl mx-auto">
          <form onSubmit={handleSearch}>
            <div className="bg-gradient-to-r from-[#1a2332]/80 to-[#2a3544]/80 backdrop-blur-xl rounded-full shadow-2xl border border-white/5 flex items-center overflow-hidden">
              {/* Region Selector */}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={isLoading}
                className="py-4 px-5 text-gray-300 bg-transparent border-0 focus:outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer font-medium text-sm text-center"
              >
                <optgroup label="Americas">
                  <option value="na1">NA</option>
                  <option value="br1">BR</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="euw1">EUW</option>
                  <option value="eun1">EUNE</option>
                  <option value="tr1">TR</option>
                  <option value="ru">RU</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="kr">KR</option>
                  <option value="jp1">JP</option>
                </optgroup>
                <optgroup label="Southeast Asia & Oceania">
                  <option value="oc1">OCE</option>
                  <option value="ph2">PH</option>
                  <option value="sg2">SG</option>
                  <option value="th2">TH</option>
                  <option value="tw2">TW</option>
                  <option value="vn2">VN</option>
                </optgroup>
              </select>

              {/* Divider */}
              <div className="h-8 w-px bg-white/10"></div>

              {/* Search Input */}
              <input
                type="text"
                value={summonerName}
                onChange={(e) => setSummonerName(e.target.value)}
                placeholder="Player#NA1"
                disabled={isLoading}
                className="flex-1 py-4 px-6 text-gray-200 bg-transparent border-0 focus:outline-none transition-all placeholder-gray-500 disabled:opacity-50"
              />

              {/* Search Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="p-3 text-gray-400 hover:text-blue-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
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

            {error && <p className="mt-3 text-sm text-red-400 text-center">{error}</p>}
          </form>
        </div>

        {/* Quick Search Suggestions */}
        <div className="mb-8 flex justify-center">
          <button
            onClick={() => {
              const player = shuffledPlayers[currentPlayerIndex];
              setSummonerName(`${player.accountName}#${player.tag}`);
              setRegion(player.region);
            }}
            className="px-5 py-2.5 bg-purple-300/15 hover:bg-purple-300/25 text-gray-300 rounded-full text-sm transition-colors flex items-center gap-2 backdrop-blur-sm"
          >
            <span className="text-blue-400">✦</span>
            <span className="flex items-center">
              I wonder how{' '}
              <span className="text-white font-semibold inline-flex items-center justify-center min-w-[140px] text-center">
                {displayedName}
                <span className="inline-block w-0.5 h-5 bg-blue-400 ml-1 animate-pulse"></span>
              </span>
              {' '}is doing
            </span>
          </button>
        </div>

        {/* 3D Feature Carousel */}
        <div className="overflow-visible relative mt-24">
          <style jsx>{`
            @keyframes fadeInWord {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .fade-in-word {
              display: inline-block;
              opacity: 0;
              animation: fadeInWord 0.4s ease-out forwards;
            }
            .keyword {
              display: inline-block;
              opacity: 0;
              animation: fadeInWord 0.4s ease-out forwards;
              font-weight: 600;
            }
            .keyword-0 {
              color: #d8b4e2;
            }
            .keyword-1 {
              color: #9eb3d4;
            }
            .keyword-2 {
              color: #c9a87c;
            }
            .keyword-3 {
              color: #c4b5a0;
            }
            .pulse-text {
              display: inline-block;
              vertical-align: baseline;
              animation: pulse 8s ease-in-out infinite;
            }
          `}</style>
          
          <div className="flex items-center justify-between gap-20">
            {/* Left side - Title */}
            <div className="flex-shrink-0 -mt-20">
              <h2 className="text-5xl font-bold text-white leading-tight">
                Get Insights Like<br />
                <span className="text-blue-400">Never Before</span>
              </h2>
            </div>
            
            {/* Right side - Carousel */}
            <div className="flex-shrink-0 ml-auto">
              <div className="relative h-[240px] w-[420px] overflow-visible">
                <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1000px", transformStyle: "preserve-3d" }}>
                  {features.map((feature, index) => {
                    // Calculate circular position
                    const totalCards = features.length;
                    const angle = ((index - currentFeature) * 360) / totalCards;
                    const angleRad = (angle * Math.PI) / 180;
                    
                    // Circular arrangement - tighter radius
                    const radius = 150;
                    const x = Math.sin(angleRad) * radius;
                    const z = Math.cos(angleRad) * radius;
                    
                    // Determine if active (front card)
                    const isActive = Math.abs(angle) < 45 || Math.abs(angle) > 315;
                    const scale = isActive ? 1 : 0.65;
                    const opacity = z < -100 ? 0.2 : (isActive ? 1 : 0.6);
                    
                    // Dynamic blur based on distance from front
                    const blurAmount = isActive ? 0 : Math.min(8, Math.abs(z) / 30);
                    
                    // Gradual image blur - increases as card approaches center
                    const distanceFromCenter = Math.abs(angle);
                    const normalizedDistance = Math.min(distanceFromCenter, 90) / 90; // 0 at center, 1 at sides
                    const imageBlur = Math.max(0, 8 - (normalizedDistance * 8)); // 8px at center, 0px at sides
                    
                    return (
                      <div
                        key={index}
                        className="absolute cursor-pointer"
                        style={{
                          transform: `
                            translateX(${x}px)
                            translateZ(${z}px)
                            scale(${scale})
                          `,
                          opacity: opacity,
                          width: '220px',
                          height: '240px',
                          transformStyle: 'preserve-3d',
                          zIndex: Math.round(z),
                          filter: `blur(${blurAmount}px)`,
                          transition: 'all 2s cubic-bezier(0.4, 0.0, 0.2, 1)',
                        }}
                        onClick={() => handleFeatureChange(index)}
                      >
                        <div 
                          className={`rounded-2xl p-5 h-full flex flex-col items-center justify-start text-center relative overflow-hidden`}
                          style={{
                            backgroundColor: 'rgba(26, 35, 50, 0.5)',
                            backdropFilter: 'blur(16px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                            border: isActive ? `1px solid rgba(96, 165, 250, 0.15)` : '1px solid rgba(100, 116, 139, 0.08)',
                            boxShadow: isActive ? `0 25px 50px -12px rgba(59, 130, 246, 0.35)` : 'none',
                            transition: 'all 0.5s ease-out',
                          }}
                        >
                          {/* Background Image */}
                          <div 
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${feature.image})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                              opacity: isActive ? (index === 3 ? 0.08 : 0.15) : 0.35,
                              filter: `blur(${imageBlur}px)`,
                              transition: 'all 2s cubic-bezier(0.4, 0.0, 0.2, 1)',
                            }}
                          />
                          {/* Gradient Overlay */}
                          <div 
                            className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} transition-opacity duration-500`}
                            style={{ opacity: isActive ? 0.4 : 0.25 }}
                          />
                          {isActive && (
                            <h3 className="font-bold relative z-10 text-3xl mb-4 mt-4"
                              style={{
                                color: index === 0 ? `rgb(${139 + (1 - normalizedDistance) * 50}, ${123 + (1 - normalizedDistance) * 50}, ${168 + (1 - normalizedDistance) * 50})` : 
                                       index === 1 ? `rgb(${196 + (1 - normalizedDistance) * 40}, ${155 + (1 - normalizedDistance) * 60}, ${166 + (1 - normalizedDistance) * 60})` : 
                                       index === 2 ? `rgb(${107 + (1 - normalizedDistance) * 60}, ${140 + (1 - normalizedDistance) * 50}, ${175 + (1 - normalizedDistance) * 50})` : 
                                       `rgb(${168 + (1 - normalizedDistance) * 50}, ${155 + (1 - normalizedDistance) * 50}, ${139 + (1 - normalizedDistance) * 50})`,
                                textShadow: `0 0 ${Math.max(0, 40 - (normalizedDistance * 40))}px currentColor, 0 0 ${Math.max(0, 80 - (normalizedDistance * 80))}px currentColor, 0 0 ${Math.max(0, 120 - (normalizedDistance * 120))}px currentColor`,
                                transition: 'all 2s cubic-bezier(0.4, 0.0, 0.2, 1)',
                              }}
                            >
                              {feature.title.split(' ').map((word, i) => {
                                return (
                                  <span key={i}>
                                    <span className="fade-in-word" style={{ animationDelay: `${i * 0.3}s` }}>
                                      {word}
                                    </span>
                                    {i < feature.title.split(' ').length - 1 && ' '}
                                  </span>
                                );
                              })}
                            </h3>
                          )}
                          {isActive && (
                            <div key={animationKey} className="w-full relative z-10">
                              <div className="text-gray-200 text-base leading-relaxed mb-3 space-y-2">
                                {feature.sentences.map((sentence, sentenceIndex) => {
                                  const words = sentence.text.split(' ');
                                  let currentDelay = 1.0 + sentenceIndex * 5.0;
                                  
                                  return (
                                    <div key={sentenceIndex} className="block">
                                      {words.map((word, wordIndex) => {
                                        // Check if this word or the next few words form a keyword phrase
                                        let isKeyword = false;
                                        
                                        for (const kw of sentence.keywords) {
                                          const kwWords = kw.split(' ');
                                          const nextWords = words.slice(wordIndex, wordIndex + kwWords.length).join(' ');
                                          if (nextWords.toLowerCase().includes(kw.toLowerCase())) {
                                            isKeyword = true;
                                            break;
                                          }
                                        }
                                        
                                        // Add pause before keyword, normal speed for keyword, pause after
                                        if (isKeyword) {
                                          currentDelay += 0.3; // Pause before keyword
                                        }
                                        
                                        const delay = currentDelay;
                                        currentDelay += 0.15; // Normal word speed
                                        
                                        if (isKeyword) {
                                          currentDelay += 0.3; // Pause after keyword
                                        }
                                        
                                        // Keyword gets a different color than the title
                                        const keywordColorClass = `keyword-${(index + 1) % 4}`;
                                        
                                        return (
                                          <span key={wordIndex}>
                                            <span 
                                              className={isKeyword ? `keyword ${keywordColorClass}` : 'fade-in-word'}
                                              style={{ animationDelay: `${delay}s` }}
                                            >
                                              {word}
                                            </span>
                                            {' '}
                                          </span>
                               );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Navigation Dots */}
              <div className="flex justify-center gap-2.5 mt-15">
                {features.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleFeatureChange(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      index === currentFeature 
                        ? 'bg-blue-500 w-7' 
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                    aria-label={`Go to feature ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

      </main>
      </div>
    </div>
  );
}
