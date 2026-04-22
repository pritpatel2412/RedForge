import { useRef, useEffect } from "react";

// ─── Continent polygons as [lon, lat] pairs ─────────────────────────────────
const POLYS: [number, number][][] = [
  // North America
  [
    [-168, 71], [-140, 71], [-130, 60], [-124, 49], [-117, 32], [-110, 22], [-95, 18],
    [-85, 11], [-77, 8], [-75, 14], [-60, 14], [-60, 22], [-65, 42], [-52, 46], [-54, 58],
    [-64, 63], [-72, 73], [-100, 76], [-120, 76], [-140, 70], [-168, 71],
  ],
  // Greenland
  [
    [-44, 83], [-16, 82], [-16, 70], [-44, 59], [-56, 63], [-66, 78], [-44, 83],
  ],
  // South America
  [
    [-80, 10], [-62, 12], [-50, 5], [-34, -4], [-36, -12], [-38, -15], [-40, -22],
    [-44, -24], [-50, -28], [-52, -34], [-60, -42], [-70, -56], [-75, -53],
    [-74, -42], [-65, -30], [-72, -20], [-80, -8], [-80, 10],
  ],
  // Europe (Iberia to Balkans + UK hint)
  [
    [-10, 36], [-9, 38], [-9, 44], [-2, 44], [0, 44], [2, 46], [4, 52],
    [3, 55], [8, 55], [10, 56], [14, 57], [18, 60], [24, 65], [30, 72],
    [10, 72], [0, 65], [-5, 60], [-8, 54], [-9, 38], [-10, 36],
  ],
  // Scandinavia
  [
    [4, 52], [10, 55], [14, 57], [18, 60], [24, 65], [30, 72],
    [28, 70], [22, 66], [18, 63], [14, 62], [10, 60], [6, 58], [4, 52],
  ],
  // Africa
  [
    [-18, 15], [-14, 10], [-8, 5], [0, 5], [8, 5], [14, 4], [14, -2],
    [18, -8], [22, -18], [28, -32], [32, -30], [34, -22], [36, -20],
    [40, -12], [42, -2], [44, 10], [42, 16], [44, 24], [36, 30], [26, 32],
    [10, 36], [0, 36], [-8, 34], [-10, 28], [-18, 22], [-18, 15],
  ],
  // Arabian Peninsula + Middle East
  [
    [26, 38], [30, 36], [36, 30], [42, 14], [44, 12], [50, 12],
    [58, 22], [60, 30], [58, 38], [52, 42], [44, 42], [36, 38], [26, 38],
  ],
  // Indian Subcontinent
  [
    [62, 22], [66, 22], [72, 22], [80, 22], [92, 22], [92, 8], [80, 6], [72, 8], [62, 22],
  ],
  // Russia / Northern Eurasia
  [
    [26, 65], [30, 72], [50, 72], [80, 73], [100, 75], [140, 72], [170, 65],
    [170, 50], [152, 46], [135, 40], [120, 46], [100, 50], [82, 60], [60, 65],
    [40, 65], [28, 68], [26, 65],
  ],
  // Central Asia to China
  [
    [52, 42], [58, 38], [60, 30], [62, 22], [72, 22], [80, 22], [92, 22],
    [100, 20], [112, 22], [116, 26], [130, 40], [120, 46], [100, 50],
    [82, 60], [60, 65], [52, 42],
  ],
  // Southeast Asia
  [
    [92, 22], [100, 20], [106, 12], [102, 2], [104, 0], [108, 2], [118, 8],
    [120, 14], [114, 20], [110, 20], [100, 20], [92, 22],
  ],
  // Japan
  [
    [130, 32], [134, 34], [136, 36], [140, 38], [141, 43], [130, 43], [128, 34], [130, 32],
  ],
  // Australia
  [
    [114, -22], [118, -20], [122, -18], [130, -12], [132, -14], [138, -14],
    [142, -10], [148, -20], [152, -26], [150, -38], [146, -38], [140, -36],
    [132, -34], [120, -34], [114, -32], [114, -26], [114, -22],
  ],
];

// Ray-casting point-in-polygon
function inPoly(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [lni, lai] = poly[i];
    const [lnj, laj] = poly[j];
    if (
      lai > lat !== laj > lat &&
      lon < ((lnj - lni) * (lat - lai)) / (laj - lai) + lni
    )
      inside = !inside;
  }
  return inside;
}

function isLand(lon: number, lat: number): boolean {
  return POLYS.some((p) => inPoly(lon, lat, p));
}

// Pre-compute land dot positions (lat, lon in radians)
const STEP = 3.8;
const LAND_PTS: [number, number][] = [];
for (let lat = -84; lat <= 84; lat += STEP) {
  for (let lon = -180; lon < 180; lon += STEP) {
    if (isLand(lon, lat)) {
      LAND_PTS.push([
        (lat * Math.PI) / 180,
        (lon * Math.PI) / 180,
      ]);
    }
  }
}

// ─── Hotspot cities [lat°, lon°] ────────────────────────────────────────────
const HOTSPOTS: [number, number][] = [
  [40.7, -74],    // New York
  [51.5, -0.1],   // London
  [35.7, 139.7],  // Tokyo
  [1.3, 103.8],   // Singapore
  [-33.9, 151.2], // Sydney
  [-23.5, -46.6], // São Paulo
  [6.5, 3.4],     // Lagos
  [19.1, 72.9],   // Mumbai
  [55.8, 37.6],   // Moscow
  [34.1, -118.2], // Los Angeles
].map(([la, lo]) => [(la * Math.PI) / 180, (lo * Math.PI) / 180]);

// ─── Arcs between hotspot pairs ─────────────────────────────────────────────
const ARC_PAIRS: [number, number][] = [
  [0, 1],  // NY → London
  [1, 2],  // London → Tokyo
  [0, 5],  // NY → São Paulo
  [2, 3],  // Tokyo → Singapore
  [7, 3],  // Mumbai → Singapore
  [8, 1],  // Moscow → London
  [9, 0],  // LA → NY
  [3, 4],  // Singapore → Sydney
];

// Great-circle interpolation
function slerp(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  t: number
): [number, number, number] {
  const toXYZ = (la: number, lo: number): [number, number, number] => [
    Math.cos(la) * Math.cos(lo),
    Math.sin(la),
    Math.cos(la) * Math.sin(lo),
  ];
  const [x1, y1, z1] = toXYZ(lat1, lon1);
  const [x2, y2, z2] = toXYZ(lat2, lon2);
  const dot = x1 * x2 + y1 * y2 + z1 * z2;
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (Math.abs(omega) < 1e-10) return [x1, y1, z1];
  const s = Math.sin(omega);
  const f1 = Math.sin((1 - t) * omega) / s;
  const f2 = Math.sin(t * omega) / s;
  return [f1 * x1 + f2 * x2, f1 * y1 + f2 * y2, f1 * z1 + f2 * z2];
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GlobeCanvas({ size = 380 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx!.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.43;

    // 3D rotation helpers
    function rotY(
      x: number, y: number, z: number, a: number
    ): [number, number, number] {
      return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
    }

    function project(rx: number, ry: number, rz: number) {
      const persp = 2.6 / (2.6 + rz * 0.3);
      return {
        px: cx + rx * R * persp,
        py: cy - ry * R * persp,
        visible: rz > -0.1,
        depth: rz,
      };
    }

    // lat/lon on sphere → [x,y,z]
    function latLonToXYZ(la: number, lo: number): [number, number, number] {
      return [
        Math.cos(la) * Math.cos(lo),
        Math.sin(la),
        Math.cos(la) * Math.sin(lo),
      ];
    }

    // Pre-build XYZ for land points
    const landXYZ: [number, number, number][] = LAND_PTS.map(([la, lo]) =>
      latLonToXYZ(la, lo)
    );

    // Pre-build XYZ for hotspots
    const hotspotXYZ: [number, number, number][] = HOTSPOTS.map(([la, lo]) =>
      latLonToXYZ(la, lo)
    );

    let angle = 0;
    let raf: number;
    const startTime = performance.now();

    function draw() {
      ctx!.clearRect(0, 0, size, size);
      angle += 0.0025;

      // ── Outer circle border ──────────────────────────────────────────────
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(255,255,255,0.18)";
      ctx!.lineWidth = 0.8;
      ctx!.stroke();

      // Clip to globe
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R + 1, 0, Math.PI * 2);
      ctx!.clip();

      // ── Latitude grid lines ──────────────────────────────────────────────
      const LATITUDES = [-60, -30, 0, 30, 60];
      for (const latDeg of LATITUDES) {
        const la = (latDeg * Math.PI) / 180;
        const pts: { px: number; py: number }[] = [];
        const steps = 120;
        for (let i = 0; i <= steps; i++) {
          const lo = ((i / steps) * 2 - 1) * Math.PI;
          let [x, y, z] = latLonToXYZ(la, lo);
          [x, y, z] = rotY(x, y, z, angle);
          if (z < 0) continue;
          const { px, py } = project(x, y, z);
          pts.push({ px, py });
        }
        if (pts.length > 1) {
          ctx!.beginPath();
          ctx!.moveTo(pts[0].px, pts[0].py);
          for (const p of pts.slice(1)) ctx!.lineTo(p.px, p.py);
          ctx!.strokeStyle = "rgba(255,255,255,0.04)";
          ctx!.lineWidth = 0.6;
          ctx!.stroke();
        }
      }

      // ── Longitude grid lines ─────────────────────────────────────────────
      const LONGITUDES = [-120, -60, 0, 60, 120];
      for (const lonDeg of LONGITUDES) {
        const loBias = (lonDeg * Math.PI) / 180;
        const pts: { px: number; py: number }[] = [];
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
          const la = ((i / steps) - 0.5) * Math.PI;
          const lo = loBias;
          let [x, y, z] = latLonToXYZ(la, lo);
          [x, y, z] = rotY(x, y, z, angle);
          if (z < 0) continue;
          const { px, py } = project(x, y, z);
          pts.push({ px, py });
        }
        if (pts.length > 1) {
          ctx!.beginPath();
          ctx!.moveTo(pts[0].px, pts[0].py);
          for (const p of pts.slice(1)) ctx!.lineTo(p.px, p.py);
          ctx!.strokeStyle = "rgba(255,255,255,0.04)";
          ctx!.lineWidth = 0.6;
          ctx!.stroke();
        }
      }

      // ── Land dots ────────────────────────────────────────────────────────
      for (const [ox, oy, oz] of landXYZ) {
        const [rx, ry, rz] = rotY(ox, oy, oz, angle);
        if (rz < -0.05) continue;
        const alpha = Math.max(0, (rz + 1) / 2);
        const { px, py } = project(rx, ry, rz);
        const dotR = 0.9 + alpha * 1.1;
        ctx!.beginPath();
        ctx!.arc(px, py, dotR, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${(alpha * 0.75).toFixed(2)})`;
        ctx!.fill();
      }

      // ── Arc lines ────────────────────────────────────────────────────────
      const t = ((performance.now() - startTime) / 4000) % 1;

      for (let ai = 0; ai < ARC_PAIRS.length; ai++) {
        const [i1, i2] = ARC_PAIRS[ai];
        const [la1, lo1] = HOTSPOTS[i1];
        const [la2, lo2] = HOTSPOTS[i2];
        const arcOffset = (ai / ARC_PAIRS.length + t) % 1;
        const SEGS = 60;

        // Draw the full arc as background
        let prevPt: { px: number; py: number } | null = null;
        for (let s = 0; s <= SEGS; s++) {
          const st = s / SEGS;
          const [gx, gy, gz] = slerp(la1, lo1, la2, lo2, st);
          const [rx, ry, rz] = rotY(gx, gy, gz, angle);
          if (rz < 0) { prevPt = null; continue; }
          const { px, py } = project(rx, ry, rz);
          if (prevPt) {
            ctx!.beginPath();
            ctx!.moveTo(prevPt.px, prevPt.py);
            ctx!.lineTo(px, py);
            ctx!.strokeStyle = "rgba(255,255,255,0.12)";
            ctx!.lineWidth = 0.8;
            ctx!.stroke();
          }
          prevPt = { px, py };
        }

        // Traveling bright segment
        const HEAD = 0.15;
        const segStart = arcOffset;
        const segEnd = (arcOffset + HEAD) % 1;

        prevPt = null;
        for (let s = 0; s <= SEGS; s++) {
          const st = s / SEGS;
          // Is this segment inside the traveling window?
          let inWindow = false;
          if (segEnd > segStart) {
            inWindow = st >= segStart && st <= segEnd;
          } else {
            inWindow = st >= segStart || st <= segEnd;
          }
          if (!inWindow) { prevPt = null; continue; }

          const [gx, gy, gz] = slerp(la1, lo1, la2, lo2, st);
          const [rx, ry, rz] = rotY(gx, gy, gz, angle);
          if (rz < 0) { prevPt = null; continue; }
          const { px, py } = project(rx, ry, rz);

          // Brightness fades toward tail
          let frac: number;
          if (segEnd > segStart) {
            frac = (st - segStart) / HEAD;
          } else if (st >= segStart) {
            frac = (st - segStart) / HEAD;
          } else {
            frac = (st + 1 - segStart) / HEAD;
          }
          const bright = Math.pow(frac, 0.5);

          if (prevPt) {
            ctx!.beginPath();
            ctx!.moveTo(prevPt.px, prevPt.py);
            ctx!.lineTo(px, py);
            ctx!.strokeStyle = `rgba(255,255,255,${(bright * 0.85).toFixed(2)})`;
            ctx!.lineWidth = 1.5;
            ctx!.stroke();
          }
          prevPt = { px, py };
        }
      }

      // ── Hotspot squares ──────────────────────────────────────────────────
      for (const [ox, oy, oz] of hotspotXYZ) {
        const [rx, ry, rz] = rotY(ox, oy, oz, angle);
        if (rz < 0.1) continue;
        const { px, py } = project(rx, ry, rz);
        const alpha = Math.min(1, (rz + 1) / 2 * 1.4);
        const sq = 6 + alpha * 3;
        const glowR = sq * 2.5;

        // Glow
        const grd = ctx!.createRadialGradient(px, py, 0, px, py, glowR);
        grd.addColorStop(0, `rgba(255,255,255,${(alpha * 0.35).toFixed(2)})`);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.beginPath();
        ctx!.arc(px, py, glowR, 0, Math.PI * 2);
        ctx!.fillStyle = grd;
        ctx!.fill();

        // Square
        ctx!.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx!.fillRect(px - sq / 2, py - sq / 2, sq, sq);
      }

      ctx!.restore();
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block" }}
    />
  );
}
