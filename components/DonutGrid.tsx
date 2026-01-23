import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartPie } from "lucide-react";

type DonutItem = { name: string; pct: number };

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function trafficColor(pct: number) {
  if (pct >= 85) return "#16a34a"; // verde
  if (pct >= 60) return "#f59e0b"; // amarillo
  return "#dc2626"; // rojo
}

function Donut({ pct }: { pct: number }) {
  const p = clampPct(pct);
  const color = trafficColor(p);

  const data = [
    { name: "ok", value: p },
    { name: "rest", value: 100 - p },
  ];

  return (
    <div className="relative w-24 h-24 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            innerRadius="75%"
            outerRadius="100%"
            stroke="none"
            isAnimationActive={true}
            animationDuration={1000}
          >
            <Cell fill={color} />
            <Cell fill="#f1f5f9" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 grid place-items-center">
        <div className="text-xs font-black text-slate-800 tracking-tighter">{p.toFixed(0)}%</div>
      </div>
    </div>
  );
}

export function DonutGrid({
  title,
  items,
}: {
  title: string;
  items: DonutItem[];
}) {
  const safeItems = (items || [])
    .map((x) => ({ ...x, pct: clampPct(x.pct) }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-8">
        <ChartPie className="w-4 h-4 text-brand-primary" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
        {safeItems.map((it) => (
          <div
            key={it.name}
            className="flex items-center gap-4 p-4 rounded-3xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:shadow-md transition-all duration-300 group"
          >
            <Donut pct={it.pct} />

            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase text-slate-800 truncate leading-tight mb-1">
                {it.name}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                CALIDAD: {it.pct.toFixed(1)}%
              </div>

              <div className="mt-3">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                  style={{
                    backgroundColor: trafficColor(it.pct) + "1A",
                    color: trafficColor(it.pct),
                    borderColor: trafficColor(it.pct) + "33",
                  }}
                >
                  {it.pct >= 85 ? "OK" : it.pct >= 60 ? "ALERTA" : "CRÍTICO"}
                </span>
              </div>
            </div>
          </div>
        ))}

        {safeItems.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <ChartPie className="w-12 h-12 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">
              Sin datos para graficar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}