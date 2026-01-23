
import React from 'react';
import { Target, TrendingDown, TrendingUp, HardDrive, LucideIcon } from 'lucide-react';

export type KpiTone = "success" | "danger" | "neutral" | "warning";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone: KpiTone;
  icon?: LucideIcon;
}

const toneStyles: Record<KpiTone, string> = {
  success: "text-brand-success bg-brand-success/5 border-brand-success/10",
  danger: "text-brand-danger bg-brand-danger/5 border-brand-danger/10",
  warning: "text-amber-500 bg-amber-50 border-amber-100",
  neutral: "text-slate-800 bg-slate-50 border-slate-100"
};

const iconColors: Record<KpiTone, string> = {
  success: "text-brand-success",
  danger: "text-brand-danger",
  warning: "text-amber-500",
  neutral: "text-slate-400"
};

export default function KpiCard({ title, value, subtitle, tone, icon: Icon }: KpiCardProps) {
  return (
    <div className={`bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300`}>
      <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
        {Icon ? <Icon className={`w-20 h-20 ${iconColors[tone]}`} /> : <Target className={`w-20 h-20 ${iconColors[tone]}`} />}
      </div>
      <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <p className={`text-4xl font-black tabular-nums tracking-tighter ${iconColors[tone]}`}>
        {value}
      </p>
      <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">{subtitle}</p>
    </div>
  );
}
