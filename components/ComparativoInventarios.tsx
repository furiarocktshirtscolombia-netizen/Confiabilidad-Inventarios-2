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

// --- UTILIDADES ROBUSTAS DE AUDITORÍA ---

const normKey = (s: string) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // quita espacios/guiones/caracteres raros

const getByAliases = (row: Record<string, any>, aliases: string[]) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    if (alias in row) return row[alias];
    const target = normKey(alias);
    for (const k of keys) {
      if (normKey(k) === target) return row[k];
    }
  }
  return undefined;
};

const toNumber = (val: any): number => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined) return 0;

  let s = String(val).trim();
  if (!s || s === "-") return 0;

  // Manejo de separadores decimales/miles (español vs inglés)
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// Calidad del Proceso: 1 si es perfecto, 0 si hay error
const calculateItemReliability = (stockFecha: number, stockInv: number) => {
  return stockFecha === stockInv ? 1.0 : 0.0;
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

const getReliabilityStatus = (val: number) => {
  if (val >= 85) return { color: '#2E7D32', label: 'ACEPTABLE' };
  if (val >= 60) return { color: '#f59e0b', label: 'RIESGO MEDIO' };
  return { color: '#C62828', label: 'RIESGO ALTO' };
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
  const aliases = {
    fecha: ["FECHA", "DATE"],
    articulo: ["ARTICULO", "ARTÍCULO"],
    sub: ["SUBARTICULO", "SUBARTÍCULO", "UNIDAD", "SUBARTICULO/UNIDAD"],
    stockSistema: ["STOCK A FECHA", "STOCK_A_FECHA"],
    stockConteo: ["STOCK INVENTARIO", "STOCK INVENTARIADO", "STOCK_INVENTARIO"],
    costoUnit: ["COSTE LINEA", "COSTE LANEA", "COSTO UNITARIO", "COSTELANEA", "COSTE LÃNEA"],
    sede: ["SEDE", "ALMACEN", "ALMACÉN"],
    centro: ["CENTRO DE COSTOS", "CENTRO COSTOS"]
  };

  const fechasUnicas = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) {
      const v = Number(getByAliases(r, aliases.fecha));
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

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

  const comparativo = useMemo(() => {
    if (dateA === "" || dateB === "") return null;

    const getSnapshot = (targetDate: number) => {
      const map = new Map<string, any>();
      rows.forEach(r => {
        if (Number(getByAliases(r, aliases.fecha)) !== targetDate) return;

        const sede = String(getByAliases(r, aliases.sede) || "").trim();
        const centro = String(getByAliases(r, aliases.centro) || "").trim();

        if (selSede.length && !selSede.includes(sede)) return;
        if (selCentro.length && !selCentro.includes(centro)) return;

        const art = String(getByAliases(r, aliases.articulo) || "").trim().toUpperCase();
        const subArt = String(getByAliases(r, aliases.sub) || "").trim().toUpperCase();
        const k = `${art}||${subArt}||${sede}||${centro}`;

        const sis = toNumber(getByAliases(r, aliases.stockSistema));
        const con = toNumber(getByAliases(r, aliases.stockConteo));
        const cost = toNumber(getByAliases(r, aliases.costoUnit));

        const prev = map.get(k);
        if (!prev) {
          map.set(k, { sis, con, art, subArt, cost, sede, centro });
        } else {
          prev.sis += sis;
          prev.con += con;
          if (cost > 0) prev.cost = cost;
        }
      });
      return map;
    };

    const mapA = getSnapshot(dateA as number);
    const mapB = getSnapshot(dateB as number);

    const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const items: any[] = [];
    
    let correctRefsCount = 0;
    let itemsForAverage = 0;
    let totalImpactoNegativo = 0; 
    let totalImpactoPositivo = 0; 

    const sedeGroups: Record<string, { sum: number, count: number }> = {};
    const centroGroups: Record<string, { sum: number, count: number }> = {};

    for (const k of allKeys) {
      const a = mapA.get(k);
      const b = mapB.get(k);

      const sisVal = a?.sis ?? 0;
      const conVal = b?.con ?? 0;
      const diff = conVal - sisVal;
      const cost = b?.cost ?? a?.cost ?? 0;
      const impacto = diff * cost;
      
      const sede = (b ?? a)?.sede || "N/A";
      const centro = (b ?? a)?.centro || "N/A";

      // Calidad del Proceso: 1 si es perfecto, 0 si hay error
      const isPerfect = sisVal === conVal;
      const score = isPerfect ? 1.0 : 0.0;
      
      if (isPerfect) correctRefsCount++;
      itemsForAverage++;

      if (!sedeGroups[sede]) sedeGroups[sede] = { sum: 0, count: 0 };
      if (!centroGroups[centro]) centroGroups[centro] = { sum: 0, count: 0 };
      sedeGroups[sede].sum += score;
      sedeGroups[sede].count++;
      centroGroups[centro].sum += score;
      centroGroups[centro].count++;
      
      if (impacto < 0) totalImpactoNegativo += Math.abs(impacto);
      if (impacto > 0) totalImpactoPositivo += impacto;

      const novedad = diff === 0 ? "SIN NOVEDAD" : (diff < 0 ? "FALTANTE" : "SOBRANTE");

      items.push({
        articulo: (b ?? a)?.art ?? "Desconocido",
        unidad: (b ?? a)?.subArt ?? "N/A",
        sisVal,
        conVal,
        diff,
        novedad,
        reliability: score * 100,
        costUnit: cost,
        impacto,
        sede,
        centro
      });
    }

    const reliability = itemsForAverage > 0 ? (correctRefsCount / itemsForAverage) * 100 : 100;

    const sedeChartData = Object.entries(sedeGroups).map(([name, data]) => ({
      name,
      reliability: (data.sum / data.count) * 100
    })).sort((x,y) => x.reliability - y.reliability);

    const centroChartData = Object.entries(centroGroups).map(([name, data]) => ({
      name,
      reliability: (data.sum / data.count) * 100
    })).sort((x,y) => x.reliability - y.reliability);

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
      correctRefs: correctRefsCount,
      sedeChartData,
      centroChartData
    };
  }, [dateA, dateB, rows, selSede, selCentro, selStatus]);

  const getUniqueOpts = (colKey: keyof typeof aliases) => {
    const set = new Set<string>();
    rows.forEach(r => {
      const v = String(getByAliases(r, aliases[colKey]) || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Auditoría de Control Físico</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Confiabilidad del Inventario: (Refs. Correctas / Total Auditadas) × 100</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2">Sistema</span>
              <select value={dateA} onChange={(e) => setDateA(Number(e.target.value))} className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary min-w-[140px]">
                <option value="">Base Sistema...</option>
                {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
              </select>
            </div>
            <ArrowRight className="text-slate-300 w-4 h-4 mt-4" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2">Físico</span>
              <select value={dateB} onChange={(e) => setDateB(Number(e.target.value))} className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary min-w-[140px]">
                <option value="">Carga Físico...</option>
                {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Sede" options={getUniqueOpts("sede")} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Centro" options={getUniqueOpts("centro")} value={selCentro} onChange={setSelCentro} />
            <MultiSelect label="Estado" options={["SIN NOVEDAD", "FALTANTE", "SOBRANTE"]} value={selStatus} onChange={setSelStatus} icon={<Filter size={14} />} />
          </div>
        </div>
      </header>

      {comparativo ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                 <Target className="w-16 h-16 text-brand-success" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Calidad del Conteo</p>
              <p className={`text-5xl font-black tabular-nums tracking-tighter ${comparativo.reliability >= 85 ? 'text-brand-success' : comparativo.reliability >= 60 ? 'text-amber-500' : 'text-brand-danger'}`}>
                {comparativo.reliability.toFixed(1)}%
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">{comparativo.correctRefs} de {comparativo.itemsAuditados} refs correctas</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto de Faltantes</p>
              <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(comparativo.totalImpactoNegativo)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Costo total por faltantes</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto de Sobrantes</p>
              <p className="text-3xl font-black text-brand-success tabular-nums tracking-tight">{formatCOP(comparativo.totalImpactoPositivo)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Costo total por excedentes</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Referencias Auditadas</p>
              <p className="text-3xl font-black text-slate-800 tabular-nums tracking-tight">
                {comparativo.itemsAuditados} / {comparativo.totalRefs}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Total ítems analizados</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-brand-success" /> Calidad de Conteo por Sede (%)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.sedeChartData} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '1rem', border: 'none' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']} />
                    <Bar dataKey="reliability" radius={[0, 4, 4, 0]} barSize={16}>
                      {comparativo.sedeChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={getReliabilityStatus(entry.reliability).color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-xl">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-brand-primary" /> Calidad de Conteo por Centro (%)
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativo.centroChartData} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '1rem', border: 'none' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Confiabilidad']} />
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
                <Table className="w-4 h-4 text-brand-primary" /> Matriz de Auditoría (Resultados Exactos)
              </h3>
              {selStatus.length > 0 && (
                <span className="text-[10px] font-bold text-brand-primary uppercase bg-brand-primary/10 px-3 py-1 rounded-full">
                  Filtro: {selStatus.join(", ")}
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Sistema</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Físico</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Variación</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Impacto $</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.items.slice(0, 300).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                      <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo} <span className="block text-[10px] text-slate-400 font-normal">{r.unidad}</span></td>
                      <td className="px-10 py-4 text-xs text-center text-brand-muted tabular-nums">{r.sisVal.toLocaleString()}</td>
                      <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold tabular-nums">{r.conVal.toLocaleString()}</td>
                      <td className={`px-10 py-4 text-xs text-center font-black tabular-nums ${r.diff < 0 ? 'text-brand-danger' : r.diff > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
                      </td>
                      <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.impacto < 0 ? 'text-brand-danger' : r.impacto > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                        {formatCOP(Math.abs(r.impacto))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-10 py-6 bg-brand-bg border-t border-slate-100 text-[10px] font-black text-brand-primary uppercase tracking-widest text-center">
                MaestroDB Auditoría Profesional
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-brand-bg border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2 uppercase">Configuración de Período</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Seleccione las fechas de base y conteo para procesar el comparativo.</p>
        </div>
      )}
    </div>
  );
}