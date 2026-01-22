import React, { useMemo, useState, useEffect, useRef } from "react";
import Button from "./Button";
import { 
  ArrowRightLeft, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  Table,
  Info,
  Calendar,
  ChevronDown,
  X,
  Target,
  DollarSign,
  AlertCircle,
  ShieldAlert,
  ArrowUpRight,
  BarChart3
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

type Row = Record<string, any>;

// --- Helpers de Normalización y Fechas ---
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const findHeader = (headers: string[], candidates: string[]) => {
  const map = new Map(headers.map((h) => [norm(h), h]));
  for (const c of candidates) {
    const real = map.get(norm(c));
    if (real) return real;
  }
  return null;
};

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

function excelSerialToDateString(serial: number) {
  if (!serial || isNaN(serial)) return "N/A";
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400; 
  const d = new Date(utcValue * 1000);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- Sub-componente MultiSelect Estilizado ---
function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((x) => x !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant={value.length > 0 ? "primary" : "secondary"}
        size="sm"
        onClick={() => setOpen(!open)}
        rightIcon={<ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        className="uppercase tracking-tight text-[10px]"
      >
        {label}{value.length ? ` (${value.length})` : ""}
      </Button>

      {open && (
        <div className="absolute z-[60] mt-2 w-64 max-h-72 overflow-auto rounded-2xl bg-white border border-slate-200 p-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">{label}</span>
            <button onClick={() => onChange([])} className="text-[10px] text-brand-primary font-bold hover:underline">Limpiar</button>
          </div>
          <div className="space-y-1">
            {options.length === 0 ? (
              <p className="text-[10px] text-brand-muted italic py-2">Sin opciones</p>
            ) : (
              options.map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={value.includes(opt)} 
                    onChange={() => toggle(opt)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/10"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparativoInventarios({
  headers,
  rows,
}: {
  headers: string[];
  rows: Row[];
}) {
  const colFecha = useMemo(() => findHeader(headers, ["FECHA", "DATE"]), [headers]);
  const colArticulo = useMemo(() => findHeader(headers, ["ARTICULO", "ARTÍCULO"]), [headers]);
  const colSub = useMemo(() => findHeader(headers, ["SUBARTICULO", "SUBARTÍCULO", "UNIDAD", "SUBARTICULO/UNIDAD"]), [headers]);
  const colStock = useMemo(() => findHeader(headers, ["STOCK A FECHA", "STOCK_FECHA", "STOCK", "STOCK INVENTARIO"]), [headers]);
  const colCostoUnit = useMemo(() => findHeader(headers, ["COSTE LINEA", "COSTE LANEA", "COSTO UNITARIO", "COSTO", "COSTELANEA"]), [headers]);
  const colSede = useMemo(() => findHeader(headers, ["SEDE", "ALMACEN", "ALMACÉN", "LOCAL", "TIENDA"]), [headers]);
  const colCentro = useMemo(() => findHeader(headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]), [headers]);

  const fechasUnicas = useMemo(() => {
    if (!colFecha) return [];
    const set = new Set<number>();
    for (const r of rows) {
      const v = Number(r[colFecha]);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rows, colFecha]);

  const [dateA, setDateA] = useState<number | "">("");
  const [dateB, setDateB] = useState<number | "">("");
  const [selSede, setSelSede] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);

  useEffect(() => {
    if (fechasUnicas.length >= 2 && (dateA === "" || dateB === "")) {
      setDateA(fechasUnicas[fechasUnicas.length - 2]);
      setDateB(fechasUnicas[fechasUnicas.length - 1]);
    }
  }, [fechasUnicas, dateA, dateB]);

  // Llave única profesional: Artículo + Unidad + Sede + Centro de Costos
  const makeKey = (r: Row) => {
    const art = colArticulo ? String(r[colArticulo] ?? "").trim().toUpperCase() : "NA";
    const sub = colSub ? String(r[colSub] ?? "").trim().toUpperCase() : "NA";
    const sede = colSede ? String(r[colSede] ?? "").trim().toUpperCase() : "NA";
    const centro = colCentro ? String(r[colCentro] ?? "").trim().toUpperCase() : "NA";
    return `${art}||${sub}||${sede}||${centro}`;
  };

  const comparativo = useMemo(() => {
    if (dateA === "" || dateB === "" || !colStock) return null;

    const getConsolidatedSnapshot = (targetDate: number) => {
      const map = new Map<string, { 
        stock: number; 
        art: string; 
        unit: string; 
        cost: number; 
        sede: string; 
        centro: string;
      }>();
      
      rows.forEach(r => {
        if (Number(r[colFecha!]) !== targetDate) return;

        // Filtros Multi-opción (Sede y Centro)
        const rowSede = colSede ? String(r[colSede] ?? "").trim() : "N/A";
        const rowCentro = colCentro ? String(r[colCentro] ?? "").trim() : "N/A";

        if (selSede.length && !selSede.includes(rowSede)) return;
        if (selCentro.length && !selCentro.includes(rowCentro)) return;

        const k = makeKey(r);
        const stock = parseFloat(String(r[colStock!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0;
        const cost = colCostoUnit ? parseFloat(String(r[colCostoUnit!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0 : 0;
        
        const prev = map.get(k);
        if (!prev) {
          map.set(k, { 
            stock, 
            art: String(r[colArticulo!] ?? ""), 
            unit: String(r[colSub!] ?? ""), 
            cost, 
            sede: rowSede, 
            centro: rowCentro 
          });
        } else {
          prev.stock += stock;
          // Actualizamos el costo si es mayor a cero
          if (cost > 0) prev.cost = cost;
        }
      });
      return map;
    };

    const mapA = getConsolidatedSnapshot(dateA as number);
    const mapB = getConsolidatedSnapshot(dateB as number);

    const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const items: any[] = [];
    
    let refsSinNovedad = 0;
    let totalImpactoNegativo = 0; // Faltantes
    let totalImpactoPositivo = 0;  // Sobrantes
    let totalCobroNeto = 0;       // Balance

    const sedeStats: Record<string, { total: number, novedades: number }> = {};
    const centroStats: Record<string, { total: number, novedades: number }> = {};

    for (const k of allKeys) {
      const a = mapA.get(k);
      const b = mapB.get(k);

      const stockA = a?.stock ?? 0;
      const stockB = b?.stock ?? 0;
      const diff = stockB - stockA;
      const cost = b?.cost ?? a?.cost ?? 0;
      const impactoReal = diff * cost;
      
      const sede = (b ?? a)?.sede || "N/A";
      const centro = (b ?? a)?.centro || "N/A";

      if (diff === 0) refsSinNovedad++;
      
      if (impactoReal < 0) totalImpactoNegativo += Math.abs(impactoReal);
      if (impactoReal > 0) totalImpactoPositivo += impactoReal;
      totalCobroNeto += impactoReal;

      // Stats para charts
      if (!sedeStats[sede]) sedeStats[sede] = { total: 0, novedades: 0 };
      if (!centroStats[centro]) centroStats[centro] = { total: 0, novedades: 0 };
      
      sedeStats[sede].total++;
      centroStats[centro].total++;
      if (diff !== 0) {
        sedeStats[sede].novedades++;
        centroStats[centro].novedades++;
      }

      // Nivel de Riesgo (Semáforo)
      let riskLevel: 'ALTO' | 'MEDIO' | 'BAJO' = 'BAJO';
      const absImpacto = Math.abs(impactoReal);
      if (absImpacto > 200000 || Math.abs(diff) > 50) riskLevel = 'ALTO';
      else if (absImpacto > 50000 || Math.abs(diff) > 10) riskLevel = 'MEDIO';

      items.push({
        articulo: (b ?? a)?.art ?? "Desconocido",
        unidad: (b ?? a)?.unit ?? "N/A",
        stockA,
        stockB,
        diff,
        novedad: diff === 0 ? "SIN NOVEDAD" : (diff < 0 ? "FALTANTE" : "SOBRANTE"),
        costUnit: cost,
        impacto: impactoReal,
        sede,
        centro,
        riskLevel
      });
    }

    const totalRefs = allKeys.size;
    const reliability = totalRefs > 0 ? (refsSinNovedad / totalRefs) * 100 : 100;

    const sedeChartData = Object.entries(sedeStats).map(([name, data]) => ({
      name,
      reliability: ((data.total - data.novedades) / data.total) * 100
    })).sort((x,y) => x.reliability - y.reliability);

    const centroChartData = Object.entries(centroStats).map(([name, data]) => ({
      name,
      reliability: ((data.total - data.novedades) / data.total) * 100
    })).sort((x,y) => x.reliability - y.reliability);

    // Ordenar por impacto absoluto para el Ranking de Riesgo
    items.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

    return { 
      items, 
      reliability, 
      totalImpactoNegativo, 
      totalImpactoPositivo, 
      totalCobroNeto, 
      totalRefs, 
      refsConNovedad: totalRefs - refsSinNovedad,
      sedeChartData,
      centroChartData,
      topCriticos: items.slice(0, 10).filter(i => i.diff !== 0)
    };
  }, [dateA, dateB, rows, colFecha, colStock, colArticulo, colSub, colCostoUnit, colSede, colCentro, selSede, selCentro]);

  if (!colFecha || !colArticulo || !colSub || !colStock) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl flex items-center gap-4 text-amber-800">
        <AlertCircle className="w-8 h-8 shrink-0" />
        <div>
          <h3 className="font-bold text-lg">Estructura Incompatible</h3>
          <p className="text-sm">Faltan columnas críticas (Fecha, Artículo, Subartículo y Stock) para consolidar inventario.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Consolidado de Auditoría</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Medición de Confiabilidad Real por Sede y Centro de Costo</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Periodo A</span>
              <div className="relative">
                <select 
                  value={dateA} 
                  onChange={(e) => setDateA(Number(e.target.value))}
                  className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none appearance-none min-w-[140px] pr-8"
                >
                  <option value="">Fecha A...</option>
                  {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <ArrowRight className="text-slate-300 w-4 h-4 mt-4" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Periodo B</span>
              <div className="relative">
                <select 
                  value={dateB} 
                  onChange={(e) => setDateB(Number(e.target.value))}
                  className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none appearance-none min-w-[140px] pr-8"
                >
                  <option value="">Fecha B...</option>
                  {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Sede" options={getUniqueOpts(rows, colSede)} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Centro" options={getUniqueOpts(rows, colCentro)} value={selCentro} onChange={setSelCentro} />
            {(selSede.length > 0 || selCentro.length > 0) && (
              <Button variant="ghost" size="sm" onClick={() => { setSelSede([]); setSelCentro([]); }} leftIcon={<X size={14} />} className="text-brand-danger uppercase tracking-tight text-[10px]" children="Reset" />
            )}
          </div>
        </div>
      </header>

      {comparativo ? (
        <>
          {/* KPIs Gerenciales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <Target className="w-16 h-16 text-brand-success" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Confiabilidad Real</p>
              <p className={`text-5xl font-black tabular-nums tracking-tighter ${comparativo.reliability >= 95 ? 'text-brand-success' : comparativo.reliability >= 90 ? 'text-amber-500' : 'text-brand-danger'}`}>
                {comparativo.reliability.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Consolidado sin novedad</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <TrendingDown className="w-16 h-16 text-brand-danger" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Faltantes</p>
              <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(comparativo.totalImpactoNegativo)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Pérdida por diferencias negativas</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <ShieldAlert className="w-16 h-16 text-amber-500" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Económico Total</p>
              <p className="text-3xl font-black text-amber-600 tabular-nums tracking-tight">
                {formatCOP(comparativo.totalImpactoNegativo + comparativo.totalImpactoPositivo)}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Movimiento real de capital auditado</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <Info className="w-16 h-16 text-brand-primary" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Ruido Operativo</p>
              <p className="text-3xl font-black text-brand-primary tabular-nums tracking-tight">
                {((comparativo.refsConNovedad / comparativo.totalRefs) * 100).toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Tasa de referencias con novedad</p>
            </div>
          </div>

          {/* Gráficos de Gestión */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-brand-success" />
                Confiabilidad por Sede (Auditoría)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.sedeChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']}
                    />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={16}>
                      {comparativo.sedeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.reliability >= 95 ? '#2E7D32' : entry.reliability >= 90 ? '#f59e0b' : '#C62828'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <Target className="w-4 h-4 text-brand-primary" />
                Confiabilidad por Centro de Costos
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.centroChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']}
                    />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={16} fill="#0F4C81" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Ranking de Referencias Críticas */}
          <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-xl overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-brand-danger" />
              Ranking de Riesgo Operativo (Top 10 Críticos)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
               {comparativo.topCriticos.map((item, idx) => (
                 <div key={idx} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl group hover:border-brand-danger/30 transition-all">
                    <div className="flex justify-between items-start mb-3">
                       <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                         item.riskLevel === 'ALTO' ? 'bg-red-100 text-brand-danger' : 
                         item.riskLevel === 'MEDIO' ? 'bg-amber-100 text-amber-700' : 
                         'bg-emerald-100 text-brand-success'
                       }`}>Riesgo {item.riskLevel}</span>
                       <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-brand-danger transition-colors" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-900 truncate mb-1" title={item.articulo}>{item.articulo}</p>
                    <p className="text-[9px] text-brand-muted uppercase tracking-widest font-black mb-3">{item.unidad}</p>
                    <div className="flex justify-between items-end">
                       <p className={`text-xs font-black ${item.diff < 0 ? 'text-brand-danger' : 'text-brand-success'}`}>
                         {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}
                       </p>
                       <p className="text-xs font-black text-slate-900">{formatCOP(Math.abs(item.impacto))}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* Tabla de Auditoría Detallada */}
          <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                <Table className="w-4 h-4 text-brand-primary" />
                Auditoría Detallada (Consolidado Profesional)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Riesgo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Unidad</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Stock A</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Stock B</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Variación</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Novedad</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Costo Unit.</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Impacto $</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.items.slice(0, 300).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                      <td className="px-10 py-4">
                        <div className={`w-3 h-3 rounded-full ${
                          r.riskLevel === 'ALTO' ? 'bg-brand-danger shadow-[0_0_8px_rgba(198,40,40,0.4)]' : 
                          r.riskLevel === 'MEDIO' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                          'bg-brand-success/40'
                        }`} />
                      </td>
                      <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo}</td>
                      <td className="px-10 py-4 text-[11px] text-brand-muted uppercase font-bold">{r.unidad}</td>
                      <td className="px-10 py-4 text-xs text-center text-brand-muted tabular-nums">{r.stockA.toLocaleString()}</td>
                      <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold tabular-nums">{r.stockB.toLocaleString()}</td>
                      <td className={`px-10 py-4 text-xs text-center font-black tabular-nums ${r.diff < 0 ? 'text-brand-danger' : r.diff > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
                      </td>
                      <td className="px-10 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          r.novedad === 'FALTANTE' ? 'bg-red-50 text-brand-danger border border-red-100' :
                          r.novedad === 'SOBRANTE' ? 'bg-emerald-50 text-brand-success border border-emerald-100' :
                          'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}>
                          {r.novedad}
                        </span>
                      </td>
                      <td className="px-10 py-4 text-xs text-right text-brand-muted tabular-nums">{formatCOP(r.costUnit)}</td>
                      <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.impacto < 0 ? 'text-brand-danger' : r.impacto > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                        {formatCOP(Math.abs(r.impacto))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-10 py-6 bg-brand-bg border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>Consolidado sobre {comparativo.totalRefs} llaves únicas (Art+Und+Sede+Centro)</span>
                <span className="flex items-center gap-2 font-black text-brand-primary"><DollarSign className="w-3.5 h-3.5" /> Auditoría Profesional LiquorHub</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-brand-bg border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Configure Rango de Auditoría</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Seleccione dos fechas para consolidar el inventario y detectar novedades con impacto económico real.</p>
        </div>
      )}
    </div>
  );
}

function getUniqueOpts(rows: Row[], col: string | null) {
  if (!col) return [];
  const set = new Set<string>();
  rows.forEach(r => {
    const v = String(r[col] ?? "").trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort();
}
