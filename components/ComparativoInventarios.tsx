
import React, { useMemo, useState, useEffect, useRef } from "react";
import Button from "./Button";
import AuditSummaryGauges from "./AuditSummaryGauges";
import { buildAuditoriaMetrics } from "../services/auditoriaMetrics";
import { 
  ArrowRightLeft, 
  ArrowRight, 
  Table,
  Calendar,
  ChevronDown,
  X,
  Target,
  BarChart3,
  Filter
} from "lucide-react";

type Row = Record<string, any>;

const normKey = (s: string) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

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
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

function excelSerialToDateString(serial: number) {
  if (!serial || isNaN(serial)) return "N/A";
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const getRiskInfo = (impacto: number) => {
  const x = Math.abs(impacto);
  if (x >= 500000) return { label: "ALTO", color: "#C62828", bg: "bg-red-50 text-red-600 border-red-100" };
  if (x >= 100000) return { label: "MEDIO", color: "#f59e0b", bg: "bg-amber-50 text-amber-600 border-amber-100" };
  if (x > 0) return { label: "BAJO", color: "#0F4C81", bg: "bg-sky-50 text-sky-600 border-sky-100" };
  return { label: "OK", color: "#94a3b8", bg: "bg-slate-50 text-slate-400 border-slate-100" };
};

function MultiSelect({ label, options, value, onChange, icon }: any) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: any) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  return (
    <div className="relative" ref={containerRef}>
      <Button variant={value.length > 0 ? "primary" : "secondary"} size="sm" onClick={() => setOpen(!open)} leftIcon={icon} rightIcon={<ChevronDown size={14} />} className="uppercase tracking-tight text-[10px]">
        {label}{value.length ? ` (${value.length})` : ""}
      </Button>
      {open && (
        <div className="absolute z-[60] mt-2 w-64 max-h-72 overflow-auto rounded-2xl bg-white border border-slate-200 p-4 shadow-2xl animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black text-brand-muted uppercase">{label}</span>
            <button onClick={() => onChange([])} className="text-[10px] text-brand-primary font-bold">Limpiar</button>
          </div>
          <div className="space-y-1">
            {options.map((opt: string) => (
              <label key={opt} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={value.includes(opt)} onChange={() => {
                  if (value.includes(opt)) onChange(value.filter((x:any) => x !== opt));
                  else onChange([...value, opt]);
                }} className="w-4 h-4 rounded border-slate-300 text-brand-primary" />
                <span className="text-xs text-slate-600 truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparativoInventarios({ headers, rows }: { headers: string[]; rows: Row[]; }) {
  const aliases = {
    fecha: ["FECHA", "DATE"],
    articulo: ["ARTICULO", "ARTÍCULO"],
    sub: ["SUBARTICULO", "SUBARTÍCULO", "UNIDAD"],
    stockSistema: ["STOCK A FECHA", "STOCK_A_FECHA"],
    stockConteo: ["STOCK INVENTARIO", "STOCK INVENTARIADO", "STOCK_INVENTARIO"],
    costoUnit: ["COSTE LINEA", "COSTE LANEA", "COSTO UNITARIO", "COSTELANEA", "COSTE LÃNEA"],
    sede: ["SEDE", "ALMACEN", "ALMACÉN"],
    centro: ["CENTRO DE COSTOS", "CENTRO COSTOS"]
  };

  const fechasUnicas = useMemo(() => {
    const set = new Set<number>();
    rows.forEach(r => { const v = Number(getByAliases(r, aliases.fecha)); if (Number.isFinite(v)) set.add(v); });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const [dateA, setDateA] = useState<number | "">("");
  const [dateB, setDateB] = useState<number | "">("");
  const [selSede, setSelSede] = useState<string[]>([]);
  const [selStatus, setSelStatus] = useState<string[]>([]);

  useEffect(() => {
    if (fechasUnicas.length >= 2 && (dateA === "" || dateB === "")) {
      setDateA(fechasUnicas[fechasUnicas.length - 2]);
      setDateB(fechasUnicas[fechasUnicas.length - 1]);
    }
  }, [fechasUnicas]);

  const comparativoData = useMemo(() => {
    if (dateA === "" || dateB === "") return null;
    const mapA = new Map();
    const mapB = new Map();
    rows.forEach(r => {
      const f = Number(getByAliases(r, aliases.fecha));
      if (f !== dateA && f !== dateB) return;
      const sede = String(getByAliases(r, aliases.sede) || "").trim();
      const centro = String(getByAliases(r, aliases.centro) || "").trim();
      const art = String(getByAliases(r, aliases.articulo) || "").trim().toUpperCase();
      const sub = String(getByAliases(r, aliases.sub) || "").trim().toUpperCase();
      const k = `${art}||${sub}||${sede}||${centro}`;
      const sis = toNumber(getByAliases(r, aliases.stockSistema));
      const con = toNumber(getByAliases(r, aliases.stockConteo));
      const costLine = toNumber(getByAliases(r, aliases.costoUnit));
      const data = { sis, con, costLine, art, sub, sede, centro };
      if (f === dateA) mapA.set(k, data);
      if (f === dateB) mapB.set(k, data);
    });

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    let items = Array.from(allKeys).map(k => {
      const a = mapA.get(k);
      const b = mapB.get(k);
      const sis = a?.sis ?? 0;
      const con = b?.con ?? 0;
      const costLine = b?.costLine ?? a?.costLine ?? 0;
      const unitCost = sis > 0 ? (costLine / sis) : costLine;
      const diff = con - sis;
      const impacto = diff * unitCost;
      const sede = (b ?? a).sede;
      const centro = (b ?? a).centro;
      return {
        articulo: (b ?? a).art,
        unidad: (b ?? a).sub,
        sis, con, diff, impacto, sede, centro, unitCost,
        novedad: diff === 0 ? "SIN NOVEDAD" : (diff < 0 ? "FALTANTE" : "SOBRANTE")
      };
    });

    if (selSede.length) items = items.filter(i => selSede.includes(i.sede));
    
    const filtered = selStatus.length ? items.filter(i => selStatus.includes(i.novedad)) : items;
    filtered.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

    const metrics = buildAuditoriaMetrics(items);

    return { items: filtered, metrics };
  }, [dateA, dateB, rows, selSede, selStatus]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Auditoría de Control Físico</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Cálculo: (Refs. Correctas / Total Auditadas) × 100</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <select value={dateA} onChange={e => setDateA(Number(e.target.value))} className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary">
              <option value="">Base Sistema...</option>
              {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
            </select>
            <ArrowRight className="text-slate-300 w-4 h-4" />
            <select value={dateB} onChange={e => setDateB(Number(e.target.value))} className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary">
              <option value="">Carga Físico...</option>
              {fechasUnicas.map(f => <option key={f} value={f}>{excelSerialToDateString(f)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <MultiSelect label="Sede" options={Array.from(new Set(rows.map(r => String(getByAliases(r, aliases.sede) || "")))).filter(Boolean).sort()} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Estado" options={["SIN NOVEDAD", "FALTANTE", "SOBRANTE"]} value={selStatus} onChange={setSelStatus} icon={<Filter size={14} />} />
          </div>
        </div>
      </header>

      {comparativoData ? (
        <>
          <AuditSummaryGauges metrics={comparativoData.metrics} />

          <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3"><Table className="w-4 h-4 text-brand-primary" /> Matriz de Auditoría Detallada (Ranking de Riesgo)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Riesgo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Sistema</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Físico</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Variación</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-right">Impacto $</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativoData.items.slice(0, 300).map((r, i) => {
                    const risk = getRiskInfo(r.impacto);
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                        <td className="px-10 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border tracking-widest ${risk.bg}`}>
                            {risk.label}
                          </span>
                        </td>
                        <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo} <span className="block text-[10px] text-slate-400 font-normal">{r.unidad}</span></td>
                        <td className="px-10 py-4 text-xs text-center text-brand-muted tabular-nums">{r.sis.toLocaleString()}</td>
                        <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold tabular-nums">{r.con.toLocaleString()}</td>
                        <td className={`px-10 py-4 text-xs text-center font-black tabular-nums ${r.diff < 0 ? 'text-brand-danger' : r.diff > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                          {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
                        </td>
                        <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.impacto < 0 ? 'text-brand-danger' : r.impacto > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                          {formatCOP(Math.abs(r.impacto))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-brand-bg border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2 uppercase">Configuración de Período</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Seleccione las fechas para procesar el ranking de riesgo.</p>
        </div>
      )}
    </div>
  );
}
