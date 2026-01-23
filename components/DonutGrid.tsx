import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PieChart as PieIcon } from 'lucide-react';

type DonutItem = { name: string; pct: number };

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// Semáforo Auditor: >= 85% Verde, 70% – 84% Amarillo, < 70% Rojo
function trafficColor(pct: number) {
  if (pct >= 85) return "#2E7D32"; // Verde (Confiable)
  if (pct >= 70) return "#f59e0b"; // Amarillo (Riesgo medio)
  return "#C62828";               // Rojo (Crítico)
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
            innerRadius="70%"
            outerRadius="95%"
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="#f1f5f9" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Porcentaje al centro */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-[11px] font-black text-slate-800 tracking-tighter">{p.toFixed(0)}%</div>
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
    <div className="bg-white border border-slate-100 p-10 rounded-[3rem] shadow-xl">
      <div className="flex items-center gap-3 mb-8">
        <PieIcon className="w-5 h-5 text-brand-primary" />
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
          {title}
        </h3>
      </div>

      {/* Grid de torticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {safeItems.map((it) => (
          <div
            key={it.name}
            className="flex items-center gap-5 p-5 rounded-[2.5rem] border border-slate-50 bg-slate-50/40 transition-all hover:bg-white hover:shadow-md hover:border-slate-100 group"
          >
            <Donut pct={it.pct} />

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase text-slate-900 truncate tracking-tight mb-1 group-hover:text-brand-primary transition-colors">
                {it.name}
              </div>
              
              {/* Chip semáforo UX solicitado */}
              <div className="mt-2">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border"
                  style={{
                    backgroundColor: trafficColor(it.pct) + "0D",
                    color: trafficColor(it.pct),
                    borderColor: trafficColor(it.pct) + "26"
                  }}
                >
                  {it.pct >= 85 ? "OK" : it.pct >= 70 ? "ALERTA" : "CRÍTICO"}
                </span>
              </div>
            </div>
          </div>
        ))}

        {safeItems.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">
            Sin datos para graficar
          </div>
        )}
      </div>
    </div>
  );
}
