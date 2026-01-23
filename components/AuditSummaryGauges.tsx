import React from 'react';
import KpiCard, { KpiTone } from './KpiCard';
import { DonutGrid } from './DonutGrid';
import { Target, TrendingDown, TrendingUp, HardDrive } from 'lucide-react';
import { AuditoriaMetrics } from '../services/auditoriaMetrics';

interface AuditSummaryGaugesProps {
  metrics: AuditoriaMetrics;
}

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

export default function AuditSummaryGauges({ metrics }: AuditSummaryGaugesProps) {
  const reliabilityTone: KpiTone = 
    metrics.calidadConteoPct >= 85 ? "success" : 
    metrics.calidadConteoPct >= 70 ? "warning" : "danger";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="CALIDAD DEL CONTEO"
          value={`${metrics.calidadConteoPct.toFixed(1)}%`}
          subtitle={`${metrics.correctas} DE ${metrics.total} REFS COINCIDEN`}
          tone={reliabilityTone}
          icon={Target}
        />
        <KpiCard
          title="IMPACTO DE FALTANTES"
          value={formatCOP(metrics.impactoFaltantes)}
          subtitle="VALOR ECONÓMICO DE FALTANTES"
          tone="danger"
          icon={TrendingDown}
        />
        <KpiCard
          title="IMPACTO DE SOBRANTES"
          value={formatCOP(metrics.impactoSobrantes)}
          subtitle="VALOR ECONÓMICO DE EXCEDENTES"
          tone="success"
          icon={TrendingUp}
        />
        <KpiCard
          title="REFERENCIAS AUDITADAS"
          value={`${metrics.total} Refs`}
          subtitle="TOTAL ÍTEMS ANALIZADOS"
          tone="neutral"
          icon={HardDrive}
        />
      </div>

      {/* Charts Section - Sustituido BarRanking por DonutGrid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <DonutGrid 
          title="CALIDAD DE CONTEO POR SEDE (%)" 
          items={metrics.bySede.map(s => ({ name: s.name, pct: s.pct }))} 
        />
        <DonutGrid 
          title="CALIDAD DE CONTEO POR CENTRO (%)" 
          items={metrics.byCentro.map(c => ({ name: c.name, pct: c.pct }))} 
        />
      </div>
    </div>
  );
}