import React, { useRef, useState, useEffect } from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";

const CHARS = "REDFORGE".split("");

/**
 * A "Next-level" magnetic text footer.
 * Re-reads the user's intent:
 * "when user hover any text so other become thik in size that letter is too thin and it must be supersmoother effect."
 * Interpretation: Hovering a char makes it THIN (e.g. 100) while making others THICK (e.g. 900)?
 * Or maybe the neighbors get thicker.
 * Let's implement a Proximity-based Weight effect where hovered = 100, far = 400, nearby = 800.
 * This creates eye-catching "magnetic" movement.
 */
export default function MagneticTextFooter() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <section 
      ref={containerRef}
      className="relative z-0 h-[60vh] flex items-center justify-center overflow-hidden"
      style={{ background: "oklch(4% 0 0)" }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-dot-grid" />
      
      <div className="flex select-none">
        {CHARS.map((char, i) => (
          <MagneticChar key={i} char={char} containerRef={containerRef} />
        ))}
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div className="w-px h-12 bg-gradient-to-b from-transparent to-primary/40" />
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-zinc-600">
          The future of security is autonomous
        </p>
      </div>
    </section>
  );
}

function MagneticChar({ char, containerRef }: { char: string; containerRef: React.RefObject<HTMLDivElement> }) {
  const charRef = useRef<HTMLDivElement>(null);
  
  // Motion values for interaction
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Spring for "supersmoother" interpolation
  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  
  const distance = useMotionValue(1000); // Start far away

  useEffect(() => {
    return mouseX.onChange((latestX) => {
      if (!charRef.current) return;
      const rect = charRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = latestX - centerX;
      const dy = mouseY.get() - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      distance.set(dist);
    });
  }, [mouseX, mouseY, distance]);

  const smoothDistance = useSpring(distance, springConfig);

  // Map distance to weight
  // Closer = thinner (100-200), Middle = thickest (900), Far = normal (300-400)
  // This creates a "wave" effect when moving through.
  const fontWeight = useTransform(
    smoothDistance,
    [0, 150, 400],
    [100, 900, 300]
  );

  // Map distance to scale/skew for "magnetic" feel
  const scale = useTransform(smoothDistance, [0, 200, 600], [1.15, 1, 1]);
  const skewX = useTransform(smoothDistance, [0, 300], [0, 0]); // Keep it clean for legibility

  return (
    <motion.div
      ref={charRef}
      style={{
        fontWeight: fontWeight as any,
        scale,
        // Using variable font weight if supported, fallback to fontWeight
        fontVariationSettings: useTransform(fontWeight, (val) => `'wght' ${Math.round(val as number)}`),
        fontFamily: "'Inter', sans-serif",
      }}
      className="text-[12vw] leading-none text-white tracking-[-0.05em] px-0.5 md:px-1 transition-colors duration-500 hover:text-primary shrink-0"
    >
      {char}
    </motion.div>
  );
}
