import React, { useRef, useMemo } from "react";
import { motion, useSpring, useTransform, useMotionValue, useScroll } from "framer-motion";

const CHARS = "REDFORGE".split("");

/**
 * Optimized Magnetic Text Footer with "Footer Revelation" effect.
 * This component remains hidden behind the page until the user scrolls past the main content.
 */
export default function MagneticTextFooter() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mouse tracking using MotionValues (Zero re-renders)
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  const handleMouseLeave = () => {
    mouseX.set(-1000);
    mouseY.set(-1000);
  };

  // Scroll disclosure logic
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });

  const opacity = useTransform(scrollYProgress, [0.4, 0.9], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative z-0 h-[80vh] flex flex-col items-center justify-center overflow-hidden bg-black"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,30,61,0.05)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>
      
      <motion.div 
        style={{ opacity, y }}
        className="flex select-none px-4 md:px-0"
      >
        {CHARS.map((char, i) => (
          <MagneticChar 
            key={i} 
            char={char} 
            mouseX={mouseX} 
            mouseY={mouseY} 
          />
        ))}
      </motion.div>

      <motion.div 
        style={{ opacity }}
        className="absolute bottom-16 flex flex-col items-center gap-3"
      >
        <div className="w-px h-16 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
        <p className="text-[11px] font-mono uppercase tracking-[0.5em] text-zinc-500">
          Crafted for the future of API Security
        </p>
      </motion.div>
    </div>
  );
}

interface MagneticCharProps {
  char: string;
  mouseX: any;
  mouseY: any;
}

function MagneticChar({ char, mouseX, mouseY }: MagneticCharProps) {
  const charRef = useRef<HTMLDivElement>(null);

  // Springs for maximum butter-smoothness
  const springConfig = { damping: 35, stiffness: 250, mass: 0.4 };
  
  // Calculate distance without re-renders using useTransform
  // We use a helper motion value to compute distance
  const distance = useMotionValue(1000);

  // We connect the motion values using a frame-sync'd transform
  // To avoid complex JS in transforms, we'll use a local transform that tracks proximity
  const weight = useTransform(mouseX, (latestX: number) => {
    if (!charRef.current) return 200;
    const rect = charRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = latestX - centerX;
    const dy = mouseY.get() - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Closer = Thicker (900), Far = Thinner (200)
    if (dist < 500) {
      return 200 + (1 - (dist / 500)) * 700;
    }
    return 200;
  });

  const smoothWeight = useSpring(weight, springConfig);

  // Inversed Scale: Larger on hover
  const scale = useTransform(smoothWeight, [200, 900], [1, 1.25]);
  const color = useTransform(
    smoothWeight, 
    [200, 700, 900], 
    ["#a1a1aa", "#ffffff", "#e01e3d"] // Zinc to White to Red
  );
  const yOffset = useTransform(smoothWeight, [200, 900], [0, -20]);

  return (
    <motion.div
      ref={charRef}
      data-char={char}
      style={{
        fontVariationSettings: useTransform(smoothWeight, (v) => `'wght' ${Math.round(v)}`),
        scale,
        color,
        y: yOffset,
        fontFamily: "'Compressa VF', sans-serif",
        willChange: "font-variation-settings, transform"
      }}
      className="text-[18vw] leading-none tracking-[0.05em] pointer-events-none pressure-test-title stroke"
    >
      <motion.span data-char={char}>{char}</motion.span>
    </motion.div>
  );
}
