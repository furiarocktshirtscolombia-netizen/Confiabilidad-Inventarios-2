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
  AlertCircle
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
  // Detección de columnas
  const colFecha = useMemo(() => findHeader(headers, ["FECHA", "DATE"]), [headers]);
  const colArticulo = useMemo(() => findHeader(headers, ["ARTICULO", "ARTÍCULO"]), [headers]);
  const colSub = useMemo(() => findHeader(headers, ["SUBARTICULO", "SUBARTÍCULO", "UNIDAD", "SUBARTICULO/UNIDAD"]), [headers]);
  const colStock = useMemo(() => findHeader(headers, ["STOCK A FECHA", "STOCK_FECHA", "STOCK", "STOCK INVENTARIO"]), [headers]);
  const colCostoUnit = useMemo(() => findHeader(headers, ["COSTE LINEA", "COSTE LANEA", "COSTO UNITARIO", "COSTO", "COSTELANEA"]), [headers]);
  
  const colSede = useMemo(() => findHeader(headers, ["SEDE", "ALMACEN", "ALMACÉN", "LOCAL", "TIENDA"]), [headers]);
  const colCentro = useMemo(() => findHeader(headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]), [headers]);

  // Listado de fechas únicas disponibles (como seriales)
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

  const makeKey = (r: Row) => {
    const art = colArticulo ? String(r[colArticulo] ?? "").trim().toUpperCase() : "NA";
    const sub = colSub ? String(r[colSub] ?? "").trim().toUpperCase() : "NA";
    return `${art}__${sub}`;
  };

  // --- Lógica del Comparativo ---
  const comparativo = useMemo(() => {
    if (dateA === "" || dateB === "" || !colStock) return null;

    const getSnapshot = (targetDate: number) => {
      // Map: key -> { stock: number, art: string, unit: string, cost: number, sede: string, centro: string }
      const map = new Map<string, { stock: number; art: string; unit: string; cost: number; sede: string; centro: string }>();
      
      rows.forEach(r => {
        if (Number(r[colFecha!]) !== targetDate) return;

        // Filtros Multi-opción
        if (colSede && selSede.length && !selSede.includes(String(r[colSede] ?? "").trim())) return;
        if (colCentro && selCentro.length && !selCentro.includes(String(r[colCentro] ?? "").trim())) return;

        const k = makeKey(r);
        const stock = parseFloat(String(r[colStock!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0;
        const cost = colCostoUnit ? parseFloat(String(r[colCostoUnit!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0 : 0;
        const sede = colSede ? String(r[colSede] ?? "") : "Default";
        const centro = colCentro ? String(r[colCentro] ?? "") : "Default";
        
        const prev = map.get(k);
        if (!prev) {
          map.set(k, { stock, art: String(r[colArticulo!] ?? ""), unit: String(r[colSub!] ?? ""), cost, sede, centro });
        } else {
          prev.stock += stock;
          if (cost > 0) prev.cost = cost; // Tomamos el costo si aparece
        }
      });
      return map;
    };

    const mapA = getSnapshot(dateA as number);
    const mapB = getSnapshot(dateB as number);

    const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const items: any[] = [];
    
    let refsSinNovedad = 0;
    let totalImpactoNegativo = 0;
    let totalImpactoPositivo = 0;
    let totalCobro = 0;

    // Agregación para gráficos
    const sedeStats: Record<string, { total: number, novedades: number }> = {};
    const centroStats: Record<string, { total: number, novedades: number }> = {};

    for (const k of allKeys) {
      const a = mapA.get(k);
      const b = mapB.get(k);

      const stockA = a?.stock ?? 0;
      const stockB = b?.stock ?? 0;
      const diff = stockB - stockA;
      const cost = b?.cost ?? a?.cost ?? 0;
      const cobro = diff * cost;
      const sede = (b ?? a)?.sede || "N/A";
      const centro = (b ?? a)?.centro || "N/A";

      if (diff === 0) refsSinNovedad++;
      
      if (cobro < 0) totalImpactoNegativo += Math.abs(cobro);
      if (cobro > 0) totalImpactoPositivo += cobro;
      totalCobro += cobro;

      // Stats para charts
      if (!sedeStats[sede]) sedeStats[sede] = { total: 0, novedades: 0 };
      if (!centroStats[centro]) centroStats[centro] = { total: 0, novedades: 0 };
      
      sedeStats[sede].total++;
      centroStats[centro].total++;
      if (diff !== 0) {
        sedeStats[sede].novedades++;
        centroStats[centro].novedades++;
      }

      items.push({
        articulo: (b ?? a)?.art ?? "Desconocido",
        unidad: (b ?? a)?.unit ?? "N/A",
        stockA,
        stockB,
        diff,
        novedad: diff === 0 ? "Sin novedad" : (diff < 0 ? "Faltante" : "Sobrante"),
        cobro,
        sede,
        centro
      });
    }

    const totalRefs = allKeys.size;
    const reliability = totalRefs > 0 ? (refsSinNovedad / totalRefs) * 100 : 100;

    // Transformar stats para Recharts
    const sedeChartData = Object.entries(sedeStats).map(([name, data]) => ({
      name,
      reliability: ((data.total - data.novedades) / data.total) * 100
    })).sort((x,y) => x.reliability - y.reliability);

    const centroChartData = Object.entries(centroStats).map(([name, data]) => ({
      name,
      reliability: ((data.total - data.novedades) / data.total) * 100
    })).sort((x,y) => x.reliability - y.reliability);

    items.sort((x, y) => Math.abs(y.cobro) - Math.abs(x.cobro));

    return { 
      items, 
      reliability, 
      totalImpactoNegativo, 
      totalImpactoPositivo, 
      totalCobro, 
      totalRefs, 
      refsConNovedad: totalRefs - refsSinNovedad,
      sedeChartData,
      centroChartData
    };
  }, [dateA, dateB, rows, colFecha, colStock, colArticulo, colSub, colCostoUnit, colSede, colCentro, selSede, selCentro]);

  if (!colFecha || !colArticulo || !colSub || !colStock) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl flex items-center gap-4 text-amber-800">
        <AlertCircle className="w-8 h-8 shrink-0" />
        <div>
          <h3 className="font-bold text-lg">Estructura Incompatible</h3>
          <p className="text-sm">Faltan columnas obligatorias para el reporte de confiabilidad (Fecha, Artículo, Subartículo y Stock).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
      {/* Header y Filtros */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reporte de Confiabilidad</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Auditoría agregada comparando inventarios reales</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Fecha A</span>
              <div className="relative">
                <select 
                  value={dateA} 
                  onChange={(e) => setDateA(Number(e.target.value))}
                  className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 appearance-none min-w-[140px] pr-8"
                >
                  <option value="">Seleccionar...</option>
                  {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <ArrowRight className="text-slate-300 w-4 h-4 mt-4" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Fecha B</span>
              <div className="relative">
                <select 
                  value={dateB} 
                  onChange={(e) => setDateB(Number(e.target.value))}
                  className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 appearance-none min-w-[140px] pr-8"
                >
                  <option value="">Seleccionar...</option>
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
              <Button variant="ghost" size="sm" onClick={() => { setSelSede([]); setSelCentro([]); }} leftIcon={<X size={14} />} className="text-brand-danger uppercase tracking-tight text-[10px]" children="Limpiar" />
            )}
          </div>
        </div>
      </header>

      {comparativo ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <Target className="w-16 h-16 text-brand-success" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Confiabilidad Real</p>
              <p className={`text-5xl font-black tabular-nums tracking-tighter ${comparativo.reliability >= 95 ? 'text-brand-success' : comparativo.reliability >= 90 ? 'text-amber-500' : 'text-brand-danger'}`}>
                {comparativo.reliability.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">({comparativo.totalRefs - comparativo.refsConNovedad} / {comparativo.totalRefs} ítems sin novedad)</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <TrendingDown className="w-16 h-16 text-brand-danger" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Faltantes</p>
              <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(comparativo.totalImpactoNegativo)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Costo total de diferencias negativas</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <DollarSign className="w-16 h-16 text-brand-primary" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Cobro Neto (Suma)</p>
              <p className={`text-3xl font-black tabular-nums tracking-tight ${comparativo.totalCobro < 0 ? 'text-brand-danger' : 'text-brand-success'}`}>
                {formatCOP(comparativo.totalCobro)}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Balance monetario total del periodo</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <Info className="w-16 h-16 text-slate-400" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Tasa de Novedad</p>
              <p className="text-3xl font-black text-slate-800 tabular-nums tracking-tight">
                {((comparativo.refsConNovedad / comparativo.totalRefs) * 100).toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Índice de ruido operativo</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <Target className="w-4 h-4 text-brand-success" />
                Confiabilidad por Sede
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.sedeChartData} layout="vertical" margin={{ left: 30, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']}
                    />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={20}>
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
                  <BarChart data={comparativo.centroChartData} layout="vertical" margin={{ left: 30, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']}
                    />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={20} fill="#0F4C81" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabla Detallada */}
          <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                <Table className="w-4 h-4 text-brand-primary" />
                Ranking de Riesgo Operativo (Audit Detallada)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Unidad</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Stock ({excelSerialToDateString(dateA as number)})</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Stock ({excelSerialToDateString(dateB as number)})</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Variación</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Novedad</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Cobro (Costo Ajuste)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.items.slice(0, 200).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                      <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo}</td>
                      <td className="px-10 py-4 text-[11px] text-brand-muted uppercase font-bold">{r.unidad}</td>
                      <td className="px-10 py-4 text-xs text-center text-brand-muted tabular-nums">{r.stockA.toLocaleString()}</td>
                      <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold tabular-nums">{r.stockB.toLocaleString()}</td>
                      <td className={`px-10 py-4 text-xs text-center font-black tabular-nums ${r.diff < 0 ? 'text-brand-danger' : r.diff > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
                      </td>
                      <td className="px-10 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          r.novedad === 'Faltante' ? 'bg-red-50 text-brand-danger border border-red-100' :
                          r.novedad === 'Sobrante' ? 'bg-emerald-50 text-brand-success border border-emerald-100' :
                          'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}>
                          {r.novedad}
                        </span>
                      </td>
                      <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.cobro < 0 ? 'text-brand-danger' : r.cobro > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                        {formatCOP(r.cobro)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-10 py-6 bg-brand-bg border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>Auditoría procesada sobre {comparativo.totalRefs} ítems únicos</span>
                <span className="flex items-center gap-2"><ArrowRightLeft className="w-3.5 h-3.5 text-brand-primary" /> Gestión de Riesgo LiquorHub</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-brand-bg border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Seleccione Rango de Auditoría</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Elija dos fechas arriba para calcular la confiabilidad y el impacto económico de las novedades.</p>
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
