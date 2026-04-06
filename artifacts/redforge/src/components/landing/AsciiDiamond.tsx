import { useRef, useEffect } from "react";

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()[]{}|;:,.<>?";

export default function AsciiDiamond({ size = 340 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const fontSize = 10;
    const charW = fontSize * 0.62;
    const charH = fontSize * 1.2;

    const cols = Math.floor(size / charW);
    const rows = Math.floor(size / charH);

    type Cell = { char: string; brightness: number; changeRate: number; timer: number };
    const grid: (Cell | null)[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(null)
    );

    const R_outer = size * 0.42;
    const R_inner = size * 0.22;

    function inDiamond(x: number, y: number): number | null {
      const nx = (x / cx) - 1;
      const ny = (y / cy) - 1;
      const absSum = Math.abs(nx) + Math.abs(ny);
      const innerAbsSum = Math.abs(nx * 1.4) + Math.abs(ny * 1.4);

      if (absSum < 1.0 && innerAbsSum > 0.78) {
        const dist = 1.0 - absSum;
        const brightness = Math.max(0.3, 1 - dist * 3.5);
        return brightness;
      }

      const r = Math.sqrt(nx * nx + ny * ny);
      const rimW = 0.06;
      const r_outer_n = R_outer / cx;
      const r_inner_n = R_inner / cx;
      if (r > r_inner_n && r < r_outer_n) {
        const brightness = 0.15 + Math.random() * 0.15;
        return brightness;
      }

      return null;
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * charW + charW / 2;
        const y = row * charH + charH / 2;
        const brightness = inDiamond(x, y);
        if (brightness !== null) {
          grid[row][col] = {
            char: CHARS[Math.floor(Math.random() * CHARS.length)],
            brightness,
            changeRate: 0.02 + Math.random() * 0.06,
            timer: Math.random(),
          };
        }
      }
    }

    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.font = `${fontSize}px 'Courier New', monospace`;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = grid[row][col];
          if (!cell) continue;

          cell.timer += cell.changeRate;
          if (cell.timer >= 1) {
            cell.timer = 0;
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
          }

          const alpha = cell.brightness * (0.6 + Math.sin(cell.timer * Math.PI * 2) * 0.3);
          ctx.fillStyle = `rgba(34, 197, 94, ${Math.max(0.05, alpha)})`;
          ctx.fillText(cell.char, col * charW, row * charH + charH);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
