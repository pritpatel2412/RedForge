import React, { useRef } from "react";
import { motion, useSpring, useTransform, useMotionValue, useScroll } from "framer-motion";

const CHARS = "REDFORGE".split("");

/**
 * Sticky Reveal Magnetic Footer.
 * Placed behind the main content to create a premium "revelation" effect as the user reaches the end.
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

  // Scroll discovery logic for the revelation effect
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });

  // Animation values for smooth entrance
  const opacity = useTransform(scrollYProgress, [0.3, 0.8], [0, 1]);
  const yReveal = useTransform(scrollYProgress, [0, 1], [50, 0]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[60vh] bg-black pointer-events-none"
    >
      <div 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="sticky bottom-0 left-0 w-full h-[60vh] flex flex-col items-center justify-center overflow-hidden pointer-events-auto"
      >
        {/* Background Gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,30,61,0.08)_0%,transparent_70%)]" />
        </div>
        
        {/* ── Brand Typography ── */}
        <div className="relative w-full h-full flex items-center justify-center px-10 md:px-20">
          <motion.h1 
            style={{ opacity, y: yReveal }}
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

        {/* Footer Detail */}
        <motion.div 
          style={{ opacity }}
          className="absolute bottom-12 flex flex-col items-center gap-3 pointer-events-none"
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
          <p className="text-[10px] font-mono uppercase tracking-[0.6em] text-zinc-600">
            Redefining the perimeter
          </p>
        </motion.div>
      </div>
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
  const springConfig = { damping: 45, stiffness: 350, mass: 0.3 };
  
  const distance = useMotionValue(1000);

  // Compute distance in a high-performance transform
  const proxUpdate = useTransform(mouseX, (latestX: number) => {
    if (!charRef.current) return 1000;
    const rect = charRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = latestX - centerX;
    const dy = mouseY.get() - centerY;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const smoothDistance = useSpring(proxUpdate, springConfig);

  // Variable Font Axes Mapping
  const wght = useTransform(smoothDistance, [0, 400], [900, 100]);
  const wdth = useTransform(smoothDistance, [0, 400], [150, 5]);
  const ital = useTransform(smoothDistance, [0, 400], [1, 0]);

  const fontVariationSettings = useTransform(
    [wght, wdth, ital],
    ([w, wd, i]) => `'wght' ${Math.round(w as number)}, 'wdth' ${Math.round(wd as number)}, 'ital' ${i}`
  );

  const scale = useTransform(smoothDistance, [0, 400], [1.25, 1]);
  const color = useTransform(
    smoothDistance,
    [0, 250, 400],
    ["#e01e3d", "#ffffff", "#3f3f46"] // Red -> White -> Zinc-700
  );
  const yShift = useTransform(smoothDistance, [0, 400], [-25, 0]);

  return (
    <motion.span
      ref={charRef}
      data-char={char}
      style={{
        fontVariationSettings,
        scale,
        color,
        y: yShift,
        fontFamily: "'Compressa VF', sans-serif",
        fontSize: "min(280px, 16vw)",
        display: "inline-block",
        transformOrigin: "center center",
        willChange: "font-variation-settings, transform"
      }}
      className="relative stroke cursor-default"
    >
      {char}
    </motion.span>
  );
}
