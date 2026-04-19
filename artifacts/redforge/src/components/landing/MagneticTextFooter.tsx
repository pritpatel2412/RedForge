import React, { useRef } from "react";
import { motion, useSpring, useTransform, useMotionValue, useScroll } from "framer-motion";

const CHARS = "REDFORGE".split("");

/**
 * Fully optimized Magnetic Text Footer based on UILORA reference logic.
 * Features: justify-between layout for full-width spanning and multi-axis variable font tracking.
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
      
      {/* ── Fixed Size Container Wrapper ── */}
      <div className="relative w-full max-w-7xl h-full bg-transparent flex items-center justify-center px-10">
        <motion.h1 
          style={{ opacity, y }}
          className="pressure-test-title flex justify-between w-full uppercase text-center text-white font-extrabold tracking-[-0.03em] leading-[1] select-none"
        >
          {CHARS.map((char, i) => (
            <MagneticChar 
              key={i} 
              char={char} 
              mouseX={mouseX} 
              mouseY={mouseY} 
            />
          ))}
        </motion.h1>
      </div>

      <motion.div 
        style={{ opacity }}
        className="absolute bottom-16 flex flex-col items-center gap-3 pointer-events-none"
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
  const charRef = useRef<HTMLSpanElement>(null);

  // Springs for maximum butter-smoothness
  const springConfig = { damping: 40, stiffness: 300, mass: 0.3 };
  
  const distance = useMotionValue(1000);

  const weightValue = useTransform(mouseX, (latestX: number) => {
    if (!charRef.current) return 200;
    const rect = charRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = latestX - centerX;
    const dy = mouseY.get() - centerY;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const smoothWeightSignal = useSpring(weightValue, springConfig);

  // Map distance to Compressa VF axes
  // Proximity range 0-500px
  const wght = useTransform(smoothWeightSignal, [0, 500], [900, 100]);
  const wdth = useTransform(smoothWeightSignal, [0, 500], [150, 5]);
  const ital = useTransform(smoothWeightSignal, [0, 500], [1, 0]);

  // Combined variation settings
  const fontVariationSettings = useTransform(
    [wght, wdth, ital],
    ([w, wd, i]) => `'wght' ${Math.round(w as number)}, 'wdth' ${Math.round(wd as number)}, 'ital' ${i}`
  );

  const scale = useTransform(smoothWeightSignal, [0, 500], [1.3, 1]);
  const color = useTransform(
    smoothWeightSignal,
    [0, 300, 500],
    ["#e01e3d", "#ffffff", "#52525b"] // Red to White to Zinc-500
  );
  const yOffset = useTransform(smoothWeightSignal, [0, 500], [-30, 0]);

  return (
    <motion.span
      ref={charRef}
      data-char={char}
      style={{
        fontVariationSettings,
        scale,
        color,
        y: yOffset,
        fontFamily: "'Compressa VF', sans-serif",
        fontSize: "min(200px, 15vw)", // Responsive but with a fixed cap
        display: "inline-block",
        transformOrigin: "center center",
        willChange: "font-variation-settings, transform"
      }}
      className="relative stroke cursor-pointer"
    >
      {char}
    </motion.span>
  );
}
