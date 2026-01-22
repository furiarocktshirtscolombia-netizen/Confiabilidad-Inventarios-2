import React, { useMemo, useState, useEffect, useRef } from "react";
import Button from "./Button";
import { 
  ArrowRightLeft, 
  ArrowRight, 
  Table,
  Calendar,
  ChevronDown,
  X,
  Target,
  DollarSign,
  AlertCircle,
  ShieldAlert,
  ArrowUpRight,
  BarChart3,
  Percent,
  Filter
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

// Umbrales de Auditoría Oficiales
const getReliabilityStatus = (val: number) => {
  if (val >= 85) return { color: '#2E7D32', label: 'ACEPTABLE', bg: 'bg-brand-success/10' };
  if (val >= 60) return { color: '#f59e0b', label: 'RIESGO MEDIO', bg: 'bg-amber-100' };
  return { color: '#C62828', label: 'RIESGO ALTO', bg: 'bg-red-100' };
};

function MultiSelect({
  label,
  options,
  value,
  onChange,
  icon
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  icon?: React.ReactNode;
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
        leftIcon={icon}
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
                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
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
  const colStockSistema = useMemo(() => findHeader(headers, ["STOCK A FECHA"]), [headers]);
  const colConteoFisico = useMemo(() => findHeader(headers, ["STOCK INVENTARIO", "STOCK INVENTARIADO", "STOCK_INVENTARIO"]), [headers]);
  const colCostoUnit = useMemo(() => findHeader(headers, ["COSTE LINEA", "COSTE LANEA", "COSTO UNITARIO", "COSTELANEA"]), [headers]);
  const colSede = useMemo(() => findHeader(headers, ["SEDE", "ALMACEN", "ALMACÉN"]), [headers]);
  const colCentro = useMemo(() => findHeader(headers, ["CENTRO DE COSTOS", "CENTRO COSTOS"]), [headers]);

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
  const [selStatus, setSelStatus] = useState<string[]>([]);

  useEffect(() => {
    if (fechasUnicas.length >= 2 && (dateA === "" || dateB === "")) {
      setDateA(fechasUnicas[fechasUnicas.length - 2]);
      setDateB(fechasUnicas[fechasUnicas.length - 1]);
    }
  }, [fechasUnicas, dateA, dateB]);

  const makeKey = (r: Row) => {
    const art = colArticulo ? String(r[colArticulo] ?? "").trim().toUpperCase() : "NA";
    const sub = colSub ? String(r[colSub] ?? "").trim().toUpperCase() : "NA";
    const sede = colSede ? String(r[colSede] ?? "").trim().toUpperCase() : "NA";
    const centro = colCentro ? String(r[colCentro] ?? "").trim().toUpperCase() : "NA";
    return `${art}||${sub}||${sede}||${centro}`;
  };

  const comparativo = useMemo(() => {
    if (dateA === "" || dateB === "" || !colStockSistema || !colConteoFisico) return null;

    const getConsolidatedSnapshot = (targetDate: number) => {
      const map = new Map<string, { 
        sis: number; 
        con: number;
        art: string; 
        unit: string; 
        cost: number; 
        sede: string; 
        centro: string;
      }>();
      
      rows.forEach(r => {
        if (Number(r[colFecha!]) !== targetDate) return;

        const rowSede = colSede ? String(r[colSede] ?? "").trim() : "N/A";
        const rowCentro = colCentro ? String(r[colCentro] ?? "").trim() : "N/A";

        if (selSede.length && !selSede.includes(rowSede)) return;
        if (selCentro.length && !selCentro.includes(rowCentro)) return;

        const k = makeKey(r);
        const sis = parseFloat(String(r[colStockSistema!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0;
        const con = parseFloat(String(r[colConteoFisico!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0;
        const cost = colCostoUnit ? parseFloat(String(r[colCostoUnit!] ?? "0").replace(/[^0-9.-]+/g, "")) || 0 : 0;
        
        const prev = map.get(k);
        if (!prev) {
          map.set(k, { sis, con, art: String(r[colArticulo!] ?? ""), unit: String(r[colSub!] ?? ""), cost, sede: rowSede, centro: rowCentro });
        } else {
          prev.sis += sis;
          prev.con += con;
          if (cost > 0) prev.cost = cost;
        }
      });
      return map;
    };

    const mapBaseA = getConsolidatedSnapshot(dateA as number);
    const mapBaseB = getConsolidatedSnapshot(dateB as number);

    const allKeys = new Set<string>([...mapBaseA.keys(), ...mapBaseB.keys()]);
    const items: any[] = [];
    
    let totalReliabilitySum = 0;
    let itemsForAverage = 0;
    let totalImpactoNegativo = 0; 
    let totalImpactoPositivo = 0; 

    const sedeGroups: Record<string, { sum: number, count: number }> = {};
    const centroGroups: Record<string, { sum: number, count: number }> = {};

    for (const k of allKeys) {
      const a = mapBaseA.get(k);
      const b = mapBaseB.get(k);

      const sisVal = a?.sis ?? 0;
      const conVal = b?.con ?? 0;
      const diff = conVal - sisVal;
      const cost = b?.cost ?? a?.cost ?? 0;
      const impactoReal = diff * cost;
      
      const sede = (b ?? a)?.sede || "N/A";
      const centro = (b ?? a)?.centro || "N/A";

      let itemReliability: number | null = null;
      if (sisVal !== 0) {
        const precision = (conVal / sisVal) * 100;
        itemReliability = precision;
        const cappedPrecision = Math.min(100, precision);

        totalReliabilitySum += cappedPrecision;
        itemsForAverage++;

        if (!sedeGroups[sede]) sedeGroups[sede] = { sum: 0, count: 0 };
        if (!centroGroups[centro]) centroGroups[centro] = { sum: 0, count: 0 };
        
        sedeGroups[sede].sum += cappedPrecision;
        sedeGroups[sede].count++;
        centroGroups[centro].sum += cappedPrecision;
        centroGroups[centro].count++;
      }
      
      if (impactoReal < 0) totalImpactoNegativo += Math.abs(impactoReal);
      if (impactoReal > 0) totalImpactoPositivo += impactoReal;

      const novedad = diff === 0 ? "SIN NOVEDAD" : (diff < 0 ? "FALTANTE" : "SOBRANTE");

      items.push({
        articulo: (b ?? a)?.art ?? "Desconocido",
        unidad: (b ?? a)?.unit ?? "N/A",
        sisVal,
        conVal,
        diff,
        novedad,
        reliability: itemReliability,
        costUnit: cost,
        impacto: impactoReal,
        sede,
        centro
      });
    }

    const reliability = itemsForAverage > 0 ? totalReliabilitySum / itemsForAverage : 100;

    const sedeChartData = Object.entries(sedeGroups).map(([name, data]) => ({
      name,
      reliability: data.sum / data.count
    })).sort((x,y) => x.reliability - y.reliability);

    const centroChartData = Object.entries(centroGroups).map(([name, data]) => ({
      name,
      reliability: data.sum / data.count
    })).sort((x,y) => x.reliability - y.reliability);

    // Filtrado de la lista por estado (view filter)
    const filteredItems = selStatus.length 
      ? items.filter(i => selStatus.includes(i.novedad))
      : items;

    filteredItems.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

    return { 
      items: filteredItems, 
      reliability, 
      totalImpactoNegativo, 
      totalImpactoPositivo, 
      totalRefs: allKeys.size, 
      itemsAuditados: itemsForAverage,
      sedeChartData,
      centroChartData
    };
  }, [dateA, dateB, rows, colFecha, colStockSistema, colConteoFisico, colArticulo, colSub, colCostoUnit, colSede, colCentro, selSede, selCentro, selStatus]);

  if (!colFecha || !colStockSistema || !colConteoFisico) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl flex items-center gap-4 text-amber-800">
        <AlertCircle className="w-8 h-8 shrink-0" />
        <div>
          <h3 className="font-bold text-lg text-amber-900">Configuración de Auditoría</h3>
          <p className="text-sm">Se requieren las columnas <b>STOCK A FECHA</b> (Sistema) y <b>STOCK INVENTARIO</b> (Físico) para procesar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Auditoría de Control Físico</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Promedio de Precisión: PROMEDIO(Conteo / Sistema) × 100</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Stock Sistema</span>
              <div className="relative">
                <select value={dateA} onChange={(e) => setDateA(Number(e.target.value))} className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none appearance-none min-w-[140px] pr-8">
                  <option value="">Base Sistema...</option>
                  {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <ArrowRight className="text-slate-300 w-4 h-4 mt-4" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Conteo Físico</span>
              <div className="relative">
                <select value={dateB} onChange={(e) => setDateB(Number(e.target.value))} className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none appearance-none min-w-[140px] pr-8">
                  <option value="">Carga Físico...</option>
                  {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Sede" options={getUniqueOpts(rows, colSede)} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Centro" options={getUniqueOpts(rows, colCentro)} value={selCentro} onChange={setSelCentro} />
            <MultiSelect label="Estado" options={["SIN NOVEDAD", "FALTANTE", "SOBRANTE"]} value={selStatus} onChange={setSelStatus} icon={<Filter size={14} />} />
          </div>
        </div>
      </header>

      {comparativo ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <Target className="w-16 h-16 text-brand-success" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Confiabilidad del Inventario</p>
              <p className={`text-5xl font-black tabular-nums tracking-tighter ${getReliabilityStatus(comparativo.reliability).color === '#2E7D32' ? 'text-brand-success' : getReliabilityStatus(comparativo.reliability).color === '#f59e0b' ? 'text-amber-500' : 'text-brand-danger'}`}>
                {comparativo.reliability.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Precisión promedio basada en conteo físico</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <ShieldAlert className="w-16 h-16 text-brand-danger" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Faltantes</p>
              <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(comparativo.totalImpactoNegativo)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Costo total de diferencias negativas</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <Percent className="w-16 h-16 text-brand-primary" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Índice de Auditoría</p>
              <p className="text-3xl font-black text-slate-800 tabular-nums tracking-tight">
                {comparativo.itemsAuditados} / {comparativo.totalRefs}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Refs con base sistema &gt; 0 analizadas</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <DollarSign className="w-16 h-16 text-brand-primary" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Capital en Riesgo</p>
              <p className="text-3xl font-black text-brand-primary tabular-nums tracking-tight">
                {formatCOP(comparativo.totalImpactoPositivo + comparativo.totalImpactoNegativo)}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Movimiento total de stock desviado</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-brand-success" />
                Confiabilidad Promedio por Sede (%)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.sedeChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']} />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={16}>
                      {comparativo.sedeChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getReliabilityStatus(entry.reliability).color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-brand-primary" />
                Confiabilidad por Centro de Costos (%)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.centroChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']} />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={16}>
                      {comparativo.centroChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getReliabilityStatus(entry.reliability).color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                <Table className="w-4 h-4 text-brand-primary" />
                Matriz de Auditoría (Precisión por Referencia)
              </h3>
              {selStatus.length > 0 && (
                <span className="text-[10px] font-bold text-brand-primary uppercase bg-brand-primary/10 px-3 py-1 rounded-full">
                  Filtrado por: {selStatus.join(", ")}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Audit</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Unidad</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Sistema</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Físico</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Variación</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Confiabilidad (%)</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Impacto $</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-10 py-20 text-center text-slate-400 italic">No hay registros para los filtros seleccionados.</td>
                    </tr>
                  ) : (
                    comparativo.items.slice(0, 300).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                        <td className="px-10 py-4 text-center">
                          <div className={`w-3 h-3 rounded-full mx-auto ${
                            r.reliability === null ? 'bg-slate-200' :
                            getReliabilityStatus(Math.min(100, r.reliability)).color === '#2E7D32' ? 'bg-brand-success' :
                            getReliabilityStatus(Math.min(100, r.reliability)).color === '#f59e0b' ? 'bg-amber-500' :
                            'bg-brand-danger shadow-[0_0_8px_rgba(198,40,40,0.4)]'
                          }`} />
                        </td>
                        <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo}</td>
                        <td className="px-10 py-4 text-[11px] text-brand-muted uppercase font-bold">{r.unidad}</td>
                        <td className="px-10 py-4 text-xs text-center text-brand-muted tabular-nums">{r.sisVal.toLocaleString()}</td>
                        <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold tabular-nums">{r.conVal.toLocaleString()}</td>
                        <td className={`px-10 py-4 text-xs text-center font-black tabular-nums ${r.diff < 0 ? 'text-brand-danger' : r.diff > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                          {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
                        </td>
                        <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.reliability !== null ? (Math.min(100, r.reliability) >= 85 ? 'text-brand-success' : 'text-slate-900') : 'text-slate-300'}`}>
                          {r.reliability !== null ? `${r.reliability.toFixed(1)}%` : 'Excluido'}
                        </td>
                        <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.impacto < 0 ? 'text-brand-danger' : r.impacto > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                          {formatCOP(Math.abs(r.impacto))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="px-10 py-6 bg-brand-bg border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>Indicadores basados en promedio de precisión física (Capped 100%)</span>
                <span className="flex items-center gap-2 font-black text-brand-primary uppercase tracking-widest">MaestroDB Auditoría LiquorHub</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-brand-bg border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Período de Auditoría Requerido</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Seleccione 'STOCK A FECHA' como base teórica y 'STOCK INVENTARIO' como carga física.</p>
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