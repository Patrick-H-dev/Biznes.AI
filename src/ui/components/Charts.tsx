// Wykresy dashboardu w czystym SVG. Jedna seria = jeden kolor; ROMI jako słupki rozbieżne
// od linii 0% (niebieski > 0, czerwony < 0). Każdy element ma podpowiedź po najechaniu.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RowCalc } from '../../domain/calc';
import { Decimal, formatMoney, formatNumber, formatPct } from '../../domain/numbers';
import { MONTH_LABELS } from '../../domain/seasonality';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(280, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="row">
    <span className="muted">{label}</span>
    <span>{value}</span>
  </div>
);

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Pozioma belka z zaokrąglonym tylko końcem danych (4px), zakotwiczona przy osi. */
function barPath(x0: number, x1: number, y: number, h: number, r = 4): string {
  const w = x1 - x0;
  if (Math.abs(w) < 0.5) return '';
  const dir = Math.sign(w);
  const rr = Math.min(r, Math.abs(w), h / 2);
  const xe = x1 - dir * rr;
  return `M${x0},${y} H${xe} Q${x1},${y} ${x1},${y + rr} V${y + h - rr} Q${x1},${y + h} ${xe},${y + h} H${x0} Z`;
}

function columnPath(x: number, y0: number, y1: number, w: number, r = 4): string {
  const h = y0 - y1;
  if (h < 0.5) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y0} V${y1 + rr} Q${x},${y1} ${x + rr},${y1} H${x + w - rr} Q${x + w},${y1} ${x + w},${y1 + rr} V${y0} Z`;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// ---------------------------------------------------------------------------

export function StructureChart({ rows, currency }: { rows: RowCalc[]; currency: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const data = [...rows].sort((a, b) => b.cost.comparedTo(a.cost));
  if (data.length === 0) return <p className="muted">Brak pozycji w planie.</p>;
  const labelW = Math.min(170, width * 0.32);
  const valueW = 64;
  const bh = 18;
  const gap = 8;
  const plotW = width - labelW - valueW - 8;
  const max = Math.max(...data.map((r) => r.share.toNumber()), 0.0001);
  const height = data.length * (bh + gap);
  return (
    <div className="chart-box" ref={ref} onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Struktura budżetu: udział kategorii w kwocie przydzielonej">
        <line className="baseline" x1={labelW} x2={labelW} y1={0} y2={height - gap} />
        {data.map((r, i) => {
          const y = i * (bh + gap);
          const w = (r.share.toNumber() / max) * plotW;
          return (
            <g
              key={r.categoryId}
              className={hover === r.categoryId ? 'hover' : ''}
              onMouseMove={(e) => {
                setHover(r.categoryId);
                const box = ref.current!.getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  content: (
                    <>
                      <strong>{r.name}</strong>
                      <Row label="Kwota" value={formatMoney(r.cost, currency)} />
                      <Row label="Udział" value={formatPct(r.shareDisplay)} />
                      <Row label="Typ" value={r.type === 'brand' ? 'brand (wizerunkowa)' : 'performance'} />
                    </>
                  ),
                });
              }}
            >
              <rect className="hit" x={0} y={y - gap / 2} width={width} height={bh + gap} />
              <text x={labelW - 8} y={y + bh / 2 + 4} textAnchor="end">
                {truncate(r.name, 24)}
                {r.type === 'brand' ? ' · brand' : ''}
              </text>
              <path className="bar" d={barPath(labelW, labelW + Math.max(w, 1), y, bh)} />
              <text className="value-label" x={labelW + Math.max(w, 1) + 6} y={y + bh / 2 + 4}>
                {formatPct(r.shareDisplay)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function RomiChart({ rows, currency }: { rows: RowCalc[]; currency: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const perf = rows.filter((r) => r.type === 'performance' && r.romi !== null).sort((a, b) => b.romi!.comparedTo(a.romi!));
  const brandCount = rows.filter((r) => r.type === 'brand').length;
  if (perf.length === 0) return <p className="muted">Brak kategorii performance z kosztem – ROMI nie do policzenia.</p>;
  const labelW = Math.min(170, width * 0.3);
  const bh = 18;
  const gap = 8;
  const top = 18;
  const vals = perf.map((r) => r.romi!.toNumber());
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const pad = 56;
  const plotW = width - labelW - pad * 2;
  const x = (v: number) => labelW + pad + ((v - lo) / span) * plotW;
  const height = top + perf.length * (bh + gap);
  return (
    <div className="chart-box" ref={ref} onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="ROMI na marży per kategoria performance">
        <text className="axis-label" x={x(0)} y={10} textAnchor="middle">
          0%
        </text>
        {perf.map((r, i) => {
          const y = top + i * (bh + gap);
          const v = r.romi!.toNumber();
          const neg = v < 0;
          return (
            <g
              key={r.categoryId}
              className={hover === r.categoryId ? 'hover' : ''}
              onMouseMove={(e) => {
                setHover(r.categoryId);
                const box = ref.current!.getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  content: (
                    <>
                      <strong>{r.name}</strong>
                      <Row label="ROMI" value={formatPct(r.romi)} />
                      <Row label="ROI" value={formatPct(r.roi)} />
                      <Row label="ROAS" value={r.roas ? formatNumber(r.roas, 1, 1) : 'n/d'} />
                      <Row label="Koszt" value={formatMoney(r.cost, currency)} />
                      <Row label="Przychód" value={formatMoney(r.revenue, currency)} />
                    </>
                  ),
                });
              }}
            >
              <rect className="hit" x={0} y={y - gap / 2} width={width} height={bh + gap} />
              <text x={labelW - 8} y={y + bh / 2 + 4} textAnchor="end">
                {truncate(r.name, 24)}
              </text>
              <path className={neg ? 'bar-neg' : 'bar-pos'} d={barPath(x(0), x(v), y, bh)} />
              <text className="value-label" x={neg ? x(v) - 6 : x(v) + 6} y={y + bh / 2 + 4} textAnchor={neg ? 'end' : 'start'}>
                {formatPct(r.romi)}
              </text>
            </g>
          );
        })}
        <line className="zero" x1={x(0)} x2={x(0)} y1={top - 4} y2={height - gap / 2} />
      </svg>
      <Tooltip tip={tip} />
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--pos)' }} /> ROMI ≥ 0%
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--neg)' }} /> ROMI &lt; 0% – kategoria nie zwraca kosztu
        </span>
        {brandCount > 0 && <span>Pominięto {brandCount} kat. brand (ROI n/d)</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Macierz koszt × ROMI: prawy dolny obszar to duży koszt przy niskim zwrocie. */
export function CostRomiMatrix({ rows, currency }: { rows: RowCalc[]; currency: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const perf = rows.filter((r) => r.type === 'performance' && r.romi !== null);
  if (perf.length === 0) return <p className="muted">Brak kategorii performance z kosztem.</p>;
  const height = 280;
  const m = { l: 56, r: 24, t: 16, b: 40 };
  const costs = perf.map((r) => r.cost.toNumber());
  const romis = perf.map((r) => r.romi!.toNumber());
  const xMax = niceMax(Math.max(...costs) * 1.1);
  const yLo = Math.min(0, ...romis);
  const yHi = Math.max(0, ...romis);
  const yPad = (yHi - yLo || 100) * 0.12;
  const y0 = yLo - yPad;
  const y1 = yHi + yPad;
  const sx = (v: number) => m.l + (v / xMax) * (width - m.l - m.r);
  const sy = (v: number) => m.t + ((y1 - v) / (y1 - y0)) * (height - m.t - m.b);
  const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const fmtK = (v: number) => (v >= 1e6 ? `${formatNumber(new Decimal(v / 1e6), 1, 0)} mln` : v >= 1e3 ? `${formatNumber(new Decimal(v / 1e3), 0)} tys.` : formatNumber(new Decimal(v), 0));
  const labelAll = perf.length <= 8;
  const labelled = new Set(labelAll ? perf.map((r) => r.categoryId) : [...perf].sort((a, b) => b.cost.comparedTo(a.cost)).slice(0, 5).map((r) => r.categoryId));
  // Etykiety bez nakładania: dla każdej kropki próbujemy 4 pozycji i bierzemy pierwszą wolną.
  const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end'; text: string }>();
  const taken: { x0: number; x1: number; y0: number; y1: number }[] = perf.map((r) => {
    const cx = sx(r.cost.toNumber());
    const cy = sy(r.romi!.toNumber());
    return { x0: cx - 7, x1: cx + 7, y0: cy - 7, y1: cy + 7 };
  });
  const overlaps = (b: { x0: number; x1: number; y0: number; y1: number }) =>
    b.x0 < m.l || b.x1 > width - 2 || b.y0 < 0 || b.y1 > height - m.b || taken.some((t) => b.x0 < t.x1 && b.x1 > t.x0 && b.y0 < t.y1 && b.y1 > t.y0);
  for (const r of [...perf].sort((a, b) => b.cost.comparedTo(a.cost))) {
    if (!labelled.has(r.categoryId)) continue;
    const text = truncate(r.name, 20);
    const w = text.length * 6.6;
    const cx = sx(r.cost.toNumber());
    const cy = sy(r.romi!.toNumber());
    const options: { x: number; y: number; anchor: 'start' | 'end' }[] = [
      { x: cx + 10, y: cy - 8, anchor: 'start' },
      { x: cx - 10, y: cy - 8, anchor: 'end' },
      { x: cx + 10, y: cy + 16, anchor: 'start' },
      { x: cx - 10, y: cy + 16, anchor: 'end' },
    ];
    for (const o of options) {
      const box = { x0: o.anchor === 'start' ? o.x : o.x - w, x1: o.anchor === 'start' ? o.x + w : o.x, y0: o.y - 11, y1: o.y + 3 };
      if (!overlaps(box)) {
        taken.push(box);
        labels.set(r.categoryId, { ...o, text });
        break;
      }
    }
  }
  return (
    <div className="chart-box" ref={ref} onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Macierz koszt kategorii względem ROMI">
        <rect className="quadrant" x={sx(avgCost)} y={sy(0)} width={Math.max(0, sx(xMax) - sx(avgCost))} height={Math.max(0, sy(y0) - sy(0))} />
        <text className="axis-label" x={sx(xMax) - 6} y={sy(y0) - 6} textAnchor="end">
          duży koszt / ujemny zwrot
        </text>
        {xTicks.map((v) => (
          <g key={v}>
            <line className="gridline" x1={sx(v)} x2={sx(v)} y1={m.t} y2={height - m.b} />
            <text className="axis-label" x={sx(v)} y={height - m.b + 16} textAnchor="middle">
              {fmtK(v)}
            </text>
          </g>
        ))}
        <line className="zero" x1={m.l} x2={width - m.r} y1={sy(0)} y2={sy(0)} />
        <text className="axis-label" x={m.l - 6} y={sy(0) + 4} textAnchor="end">
          0%
        </text>
        <text className="axis-label" x={m.l - 6} y={m.t + 8} textAnchor="end">
          {formatNumber(new Decimal(y1), 0)}%
        </text>
        <text className="axis-label" x={(m.l + width - m.r) / 2} y={height - 6} textAnchor="middle">
          Koszt kategorii ({currency})
        </text>
        {perf.map((r) => {
          const cx = sx(r.cost.toNumber());
          const cy = sy(r.romi!.toNumber());
          const neg = r.romi!.isNegative();
          const label = labels.get(r.categoryId);
          return (
            <g
              key={r.categoryId}
              className={hover === r.categoryId ? 'hover' : ''}
              onMouseMove={(e) => {
                setHover(r.categoryId);
                const box = ref.current!.getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  content: (
                    <>
                      <strong>{r.name}</strong>
                      <Row label="Koszt" value={formatMoney(r.cost, currency)} />
                      <Row label="ROMI" value={formatPct(r.romi)} />
                      <Row label="Udział" value={formatPct(r.shareDisplay)} />
                    </>
                  ),
                });
              }}
            >
              <circle className="hit" cx={cx} cy={cy} r={14} />
              <circle className={`dot ${neg ? 'dot-neg' : ''}`} cx={cx} cy={cy} r={6} />
              {label && (
                <text x={label.x} y={label.y} textAnchor={label.anchor}>
                  {label.text}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MonthlyChart({ totals, currency }: { totals: Decimal[]; currency: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const height = 220;
  const m = { l: 56, r: 8, t: 12, b: 26 };
  const vals = totals.map((t) => t.toNumber());
  const max = niceMax(Math.max(...vals));
  const sum = vals.reduce((a, b) => a + b, 0);
  const plotW = width - m.l - m.r;
  const step = plotW / 12;
  const bw = Math.max(6, step - 6);
  const sy = (v: number) => m.t + (1 - v / max) * (height - m.t - m.b);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const fmtK = (v: number) => (v >= 1e6 ? `${formatNumber(new Decimal(v / 1e6), 1, 0)} mln` : v >= 1e3 ? `${formatNumber(new Decimal(v / 1e3), 0)} tys.` : formatNumber(new Decimal(v), 0));
  return (
    <div className="chart-box" ref={ref} onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg className="chart" width={width} height={height} role="img" aria-label="Miesięczny rozkład wydatków">
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'baseline' : 'gridline'} x1={m.l} x2={width - m.r} y1={sy(v)} y2={sy(v)} />
            <text className="axis-label" x={m.l - 6} y={sy(v) + 4} textAnchor="end">
              {fmtK(v)}
            </text>
          </g>
        ))}
        {vals.map((v, i) => {
          const x = m.l + i * step + (step - bw) / 2;
          return (
            <g
              key={i}
              className={hover === i ? 'hover' : ''}
              onMouseMove={(e) => {
                setHover(i);
                const box = ref.current!.getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  content: (
                    <>
                      <strong>{MONTH_LABELS[i]}</strong>
                      <Row label="Wydatki" value={formatMoney(totals[i], currency)} />
                      <Row label="Udział w roku" value={sum ? formatPct(new Decimal(v).dividedBy(sum).times(100)) : '–'} />
                    </>
                  ),
                });
              }}
            >
              <rect className="hit" x={m.l + i * step} y={m.t} width={step} height={height - m.t - m.b} />
              <path className="bar" d={columnPath(x, sy(0), sy(v), bw)} />
              <text className="axis-label" x={x + bw / 2} y={height - 8} textAnchor="middle">
                {MONTH_LABELS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
