import { useRef, useEffect } from "react";

const CHARS = "#&@\\=/+$%!*-:;.,~^`'\"<>[]{}|?_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

interface Cell {
  char: string;
  brightness: number;   // 0-1 target brightness
  current: number;      // current rendered brightness (eases toward target)
  size: number;         // font size px
  flipTimer: number;    // countdown to next char change
  flipInterval: number; // how often this cell changes
}

export default function MatrixBackground({
  className = "",
  style = {},
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = container.offsetWidth;
    let H = container.offsetHeight;

    function resize() {
      W = container!.offsetWidth;
      H = container!.offsetHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + "px";
      canvas!.style.height = H + "px";
      ctx!.scale(dpr, dpr);
      buildGrid();
    }

    // Grid parameters
    const FONT_SIZE = 11;
    const COL_W = FONT_SIZE * 0.72;
    const ROW_H = FONT_SIZE * 1.4;
    let cols = 0;
    let rows = 0;
    let grid: Cell[][] = [];

    // Build grid of cells with density map
    function buildGrid() {
      cols = Math.ceil(W / COL_W);
      rows = Math.ceil(H / ROW_H);
      grid = [];

      for (let r = 0; r < rows; r++) {
        const row: Cell[] = [];
        for (let c = 0; c < cols; c++) {
          // Horizontal density: high on left/right edges, lower in center
          const nx = c / cols; // 0→1 left to right
          const ny = r / rows; // 0→1 top to bottom

          // Horizontal: dense on sides, sparse in center
          const hEdge = Math.pow(Math.min(nx, 1 - nx) * 2, 0.5); // 0=center, 1=edge  
          const centerDip = 1 - Math.pow(1 - Math.min(nx, 1 - nx) * 2, 2);

          // Vertical: concentrated in a band (roughly middle 60% of height)
          const bandCenter = 0.55;
          const bandWidth = 0.5;
          const vDist = Math.abs(ny - bandCenter) / bandWidth;
          const vDensity = Math.max(0, 1 - vDist * vDist);

          // Combined density
          const density = vDensity * (0.15 + centerDip * 0.85);

          // Decide if this cell is active
          const active = Math.random() < density;
          const b = active ? (0.05 + Math.random() * 0.45 * density) : 0;

          row.push({
            char: CHARS[Math.floor(Math.random() * CHARS.length)],
            brightness: b,
            current: b * Math.random(),
            size: FONT_SIZE * (0.85 + Math.random() * 0.3),
            flipTimer: Math.random() * 180,
            flipInterval: 40 + Math.random() * 200,
          });
        }
        grid.push(row);
      }
    }

    buildGrid();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf: number;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r]?.[c];
          if (!cell) continue;

          // Animate brightness toward target
          cell.current += (cell.brightness - cell.current) * 0.04;

          // Randomly flip char + brightness
          cell.flipTimer--;
          if (cell.flipTimer <= 0) {
            cell.flipTimer = cell.flipInterval * (0.7 + Math.random() * 0.6);
            cell.char = CHARS[Math.floor(Math.random() * CHARS.length)];
            // Occasionally spike brightness for a flash
            if (Math.random() < 0.12) {
              cell.brightness = 0.5 + Math.random() * 0.5;
              // Quickly decay back
              setTimeout(() => {
                if (cell) cell.brightness = Math.random() * 0.15;
              }, 80 + Math.random() * 200);
            } else {
              cell.brightness = Math.random() < 0.3 ? 0 : Math.random() * 0.35;
            }
          }

          const alpha = cell.current;
          if (alpha < 0.008) continue;

          const x = c * COL_W;
          const y = r * ROW_H + ROW_H;

          ctx.font = `${cell.size}px 'Courier New', monospace`;
          // Green-tinted dark chars like the reference
          // Some chars pure white-ish, most dark green
          const isHot = alpha > 0.55;
          if (isHot) {
            ctx.fillStyle = `rgba(220,255,220,${Math.min(1, alpha)})`;
          } else {
            // Dark green
            ctx.fillStyle = `rgba(80,180,80,${alpha * 0.9})`;
          }
          ctx.fillText(cell.char, x, y);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
