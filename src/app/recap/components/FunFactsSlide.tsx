import { motion } from "framer-motion";
import Image from "next/image";
import { BackgroundAnimation } from "./BackgroundAnimation";

interface FunFactsSlideProps {
  funFacts: string[];
}

export function FunFactsSlide({ funFacts }: FunFactsSlideProps) {
  // Extract numbers from text and make them stand out subtly
  const formatFact = (text: string) => {
    const parts = text.split(/(\d+[.,]?\d*)/g);
    return parts.map((part, i) => {
      if (/^\d+[.,]?\d*$/.test(part)) {
        return (
          <span key={i} className="text-white font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Fun icons (CommunityDragon emotes and champs) to alternate left/right
  const funIcons = [
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/summoneremotes/champions/teemo/teemo_happy_cheers_inventory.png",
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/summoneremotes/flairs/em_bee_happy_inventory.png",
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/summoneremotes/flairs/poro_happy_taunt_inventory.png",
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/summoneremotes/champions/fizz/fizz_taunt_inventory.png",
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/loadouts/summoneremotes/champions/leesin/leesin_happy_cheers_inventory.png",
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background image */}
      <Image
        src="/splash12.png"
        alt="fun-facts-background"
        fill
        priority
        className="object-cover"
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/70" />
      {/* Optional subtle background animation */}
      <BackgroundAnimation variant="stars" intensity="low" />
      <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-4xl mx-auto">
        <div className="space-y-8 w-full">
          <div className="text-center text-sm text-gray-300 font-light tracking-[0.2em] uppercase mb-3">
            Fun Times
          </div>
          <p className="text-center text-gray-300 text-sm md:text-base font-light mb-8">
            A quick lap around the wildest moments—laugh a little, learn a
            little, and enjoy the grind that made you better.
          </p>
          {funFacts.map((fact, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.3 + index * 0.15,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`relative bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 overflow-visible ${
                index % 2 === 0 ? "mr-4 sm:mr-8" : "ml-4 sm:ml-8"
              }`}
            >
              <div></div>
              {/* Sticker icon - alternates top-left / top-right and sticks out */}
              <Image
                src={funIcons[index % funIcons.length]}
                alt="fun-icon"
                width={100}
                height={100}
                className={`absolute -top-6 ${
                  index % 2 === 1 ? "-left-20" : "-right-20"
                } object-contain drop-shadow-xl pointer-events-none select-none`}
              />
              <p className="text-xl text-gray-300 leading-relaxed font-light">
                {formatFact(fact)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
