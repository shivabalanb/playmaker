"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface BackgroundAnimationProps {
  variant?: "particles" | "gradient" | "waves" | "stars" | "pulse";
  intensity?: "low" | "medium" | "high";
}

export function BackgroundAnimation({
  variant = "particles",
  intensity = "medium",
}: BackgroundAnimationProps) {
  const intensityMultiplier = {
    low: 0.5,
    medium: 1,
    high: 1.5,
  }[intensity];

  // Math.random is safe here because useMemo memoizes the result
  // The random values are generated once and remain stable across re-renders
  const particleData = useMemo(() => {
    const count = Math.floor(20 * intensityMultiplier);
    return Array.from({ length: count }, () => ({
      width: Math.random() * 4 + 2,
      height: Math.random() * 4 + 2,
      left: Math.random() * 100,
      top: Math.random() * 100,
      xOffset: Math.random() * 20 - 10,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    }));
  }, [intensityMultiplier]);

  const starData = useMemo(() => {
    const count = Math.floor(30 * intensityMultiplier);
    return Array.from({ length: count }, () => ({
      width: Math.random() * 2 + 1,
      height: Math.random() * 2 + 1,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: Math.random() * 2 + 1,
      delay: Math.random() * 2,
    }));
  }, [intensityMultiplier]);

  if (variant === "particles") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particleData.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-blue-400/20"
            style={{
              width: particle.width,
              height: particle.height,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, particle.xOffset, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "gradient") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
          }}
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(147, 51, 234, 0.3) 0%, transparent 50%), radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 50% 20%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
            ],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    );
  }

  if (variant === "waves") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-full h-full"
            style={{
              background: `linear-gradient(${
                45 + i * 30
              }deg, rgba(59, 130, 246, 0.1) 0%, transparent 50%)`,
            }}
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              delay: i * 1.5,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "stars") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {starData.map((star, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: star.width,
              height: star.height,
              left: `${star.left}%`,
              top: `${star.top}%`,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-blue-400/20"
            style={{
              width: 300 + i * 200,
              height: 300 + i * 200,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 1.3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}
