import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const NODES = [
  { id: "next",  label: "Next.js",      sub: "Frontend",        x: 50,  y: 8,   w: 160, h: 46, accent: "#22c55e" },
  { id: "auth",  label: "Auth Service", sub: "Node / Passport", x: 6,   y: 44,  w: 170, h: 46, accent: "#f59e0b" },
  { id: "pay",   label: "Payment API",  sub: "Stripe Wrapper",  x: 63,  y: 44,  w: 160, h: 46, accent: "#a855f7" },
  { id: "pg",    label: "PostgreSQL",   sub: "Database",        x: 6,   y: 80,  w: 150, h: 46, accent: "#3b82f6" },
  { id: "redis", label: "Redis",        sub: "Cache / Queues",  x: 60,  y: 80,  w: 140, h: 46, accent: "#ef4444" },
];

const EDGES = [
  { from: "next", to: "auth" },
  { from: "next", to: "pay" },
  { from: "auth", to: "pg" },
  { from: "pay",  to: "pg" },
  { from: "auth", to: "redis" },
];

const SVG_W = 420;
const SVG_H = 300;

function pct(pct: number, total: number) {
  return (pct / 100) * total;
}

function nodeCenter(n: (typeof NODES)[number]) {
  return {
    x: pct(n.x, SVG_W) + pct(n.w / SVG_W * 100, SVG_W) / 2,
    y: pct(n.y, SVG_H) + n.h / 2,
  };
}

function getCenter(id: string) {
  const n = NODES.find((n) => n.id === id)!;
  return nodeCenter(n);
}

export default function ServiceGraph() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const progress = (tick % 120) / 120;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width={SVG_W}
      height={SVG_H}
      style={{ overflow: "visible" }}
    >
      <defs>
        {EDGES.map((e, i) => {
          const from = getCenter(e.from);
          const to = getCenter(e.to);
          return (
            <linearGradient
              key={i}
              id={`edge-grad-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            >
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.15" />
            </linearGradient>
          );
        })}
      </defs>

      {EDGES.map((e, i) => {
        const from = getCenter(e.from);
        const to = getCenter(e.to);
        const totalLen = Math.sqrt(
          (to.x - from.x) ** 2 + (to.y - from.y) ** 2
        );
        const offset = ((progress + i * 0.2) % 1) * totalLen;

        return (
          <g key={i}>
            <line
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              stroke={`url(#edge-grad-${i})`}
              strokeWidth="1.5"
              strokeDasharray="6 4"
              strokeDashoffset={-offset}
            />
            <line
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              stroke="#22c55e"
              strokeWidth="0.5"
              opacity="0.15"
            />
          </g>
        );
      })}

      {NODES.map((n) => {
        const nx = pct(n.x, SVG_W);
        const ny = pct(n.y, SVG_H);
        const nw = n.w;
        const nh = n.h;

        return (
          <g key={n.id}>
            <rect
              x={nx} y={ny}
              width={nw} height={nh}
              rx={8}
              fill="oklch(12% 0 0)"
              stroke={n.accent}
              strokeWidth="1"
              strokeOpacity="0.5"
            />
            <rect
              x={nx} y={ny}
              width={6} height={nh}
              rx={4}
              fill={n.accent}
              fillOpacity="0.7"
            />
            <text
              x={nx + 14} y={ny + 17}
              fill="white"
              fontSize="11"
              fontWeight="600"
              fontFamily="'Inter', sans-serif"
            >
              {n.label}
            </text>
            <text
              x={nx + 14} y={ny + 32}
              fill="#71717a"
              fontSize="9"
              fontFamily="'Inter', sans-serif"
            >
              {n.sub}
            </text>
            <circle
              cx={nx + nw - 12}
              cy={ny + nh / 2}
              r={3.5}
              fill={n.accent}
              opacity="0.8"
            />
            <circle
              cx={nx + nw - 12}
              cy={ny + nh / 2}
              r={6}
              fill={n.accent}
              opacity="0.15"
            >
              <animate
                attributeName="r"
                values="4;8;4"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.2;0;0.2"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
