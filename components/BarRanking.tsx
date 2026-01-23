
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface BarRankingProps {
  title: string;
  data: Array<{ name: string; pct: number }>;
  icon?: React.ReactNode;
}

const getReliabilityColor = (val: number) => {
  if (val >= 85) return '#2E7D32';
  if (val >= 60) return '#f59e0b';
  return '#C62828';
};

export default function BarRanking({ title, data, icon }: BarRankingProps) {
  return (
    <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
      <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
        {icon || <BarChart3 className="w-4 h-4 text-brand-primary" />} {title}
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={100} 
              tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} 
              axisLine={false} 
              tickLine={false} 
            />
            <Tooltip 
              cursor={{fill: '#f8fafc'}} 
              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']} 
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getReliabilityColor(entry.pct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
