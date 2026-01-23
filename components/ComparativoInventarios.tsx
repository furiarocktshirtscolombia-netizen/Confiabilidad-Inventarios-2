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

// Auxiliares para conversión entre ISO e Excel Serial
const serialToIso = (serial: number | ""): string => {
  if (serial === "") return "";
  const d = new Date(Math.floor(serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
};

const isoToSerial = (iso: string): number => {
  if (!iso) return 0;
  const d = new Date(iso + "T00:00:00");
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) + 25569;
};

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
    const handleClick = (e: any) => { 
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); 
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
            <button 
              onClick={(e) => { e.stopPropagation(); onChange([]); }} 
              className="text-[10px] text-brand-primary font-bold hover:underline"
            >
              Limpiar
            </button>
          </div>
          <div className="space-y-1">
            {options.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic py-2">Sin opciones</p>
            ) : (
              options.map((opt: string) => (
                <label key={opt} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors">
                  <input 
                    type="checkbox" 
                    checked={value.includes(opt)} 
                    onChange={() => {
                      if (value.includes(opt)) onChange(value.filter((x:any) => x !== opt));
                      else onChange([...value, opt]);
                    }} 
                    className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20" 
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-900 truncate">{opt}</span>
                </label>
              ))
            )}
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
    costoUnit: ["COSTE LINEA", "COSTO LINEA", "COSTE LANEA", "COSTELANEA", "COSTO UNITARIO", "COSTE UNITARIO", "COSTO UNIT", "COSTE UNIT", "VALOR UNITARIO", "PRECIO UNITARIO"],
    sede: ["SEDE", "ALMACEN", "ALMACÉN"],
    centro: ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS", "CENTRO COSTO"]
  };

  const fechasUnicas = useMemo(() => {
    const set = new Set<number>();
    rows.forEach(r => { 
      const v = Number(getByAliases(r, aliases.fecha)); 
      if (Number.isFinite(v)) set.add(Math.floor(v)); 
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const [dateA, setDateA] = useState<number | "">("");
  const [dateB, setDateB] = useState<number | "">("");
  const [selSede, setSelSede] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);
  const [selStatus, setSelStatus] = useState<string[]>([]);

  // Inicialización inteligente: Si no hay selección previa, elige los dos últimos
  useEffect(() => {
    if (fechasUnicas.length > 0 && (dateA === "" || dateB === "")) {
      if (fechasUnicas.length >= 2) {
        setDateA(fechasUnicas[fechasUnicas.length - 2]);
        setDateB(fechasUnicas[fechasUnicas.length - 1]);
      } else {
        setDateA(fechasUnicas[0]);
        setDateB(fechasUnicas[0]);
      }
    }
  }, [fechasUnicas]);

  const comparativoData = useMemo(() => {
    if (dateA === "" || dateB === "") return null;
    
    const mapA = new Map();
    const mapB = new Map();

    rows.forEach(r => {
      const fullVal = Number(getByAliases(r, aliases.fecha));
      if (!Number.isFinite(fullVal)) return;
      
      const f = Math.floor(fullVal);
      if (f !== dateA && f !== dateB) return;

      const sede = String(getByAliases(r, aliases.sede) || "").trim();
      const centro = String(getByAliases(r, aliases.centro) || "").trim();
      const art = String(getByAliases(r, aliases.articulo) || "").trim().toUpperCase();
      const sub = String(getByAliases(r, aliases.sub) || "").trim().toUpperCase();
      const k = `${art}||${sub}||${sede}||${centro}`;
      
      const sis = toNumber(getByAliases(r, aliases.stockSistema));
      const con = toNumber(getByAliases(r, aliases.stockConteo));
      const unitCost = toNumber(getByAliases(r, aliases.costoUnit));
      
      const data = { sis, con, unitCost, art, sub, sede, centro };
      
      if (f === dateA) mapA.set(k, data);
      if (f === dateB) mapB.set(k, data);
    });

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    let items = Array.from(allKeys).map(k => {
      const a = mapA.get(k);
      const b = mapB.get(k);
      
      const sis = a?.sis ?? 0;
      const con = b?.con ?? 0;
      const unitCost = b?.unitCost ?? a?.unitCost ?? 0;
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
    if (selCentro.length) items = items.filter(i => selCentro.includes(i.centro));
    
    const filtered = selStatus.length ? items.filter(i => selStatus.includes(i.novedad)) : items;
    filtered.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

    const metrics = buildAuditoriaMetrics(items);
    return { items: filtered, metrics };
  }, [dateA, dateB, rows, selSede, selCentro, selStatus]);

  const sedesList = useMemo(() => 
    Array.from(new Set(rows.map(r => String(getByAliases(r, aliases.sede) || "").trim())))
      .filter(Boolean).sort(), [rows]);

  const centrosList = useMemo(() => 
    Array.from(new Set(rows.map(r => String(getByAliases(r, aliases.centro) || "").trim())))
      .filter(Boolean).sort(), [rows]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Auditoría de Control Físico</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Cálculo: (Refs. Correctas / Total Auditadas) × 100</p>
        </div>
        
        {/* FILTRO DE FECHA UNIFICADO CON DISEÑO SOLICITADO (ESTILO EXPLORADOR) */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 bg-slate-100/50 rounded-xl px-4 py-1.5 border border-slate-200">
            <Calendar size={14} className="text-brand-primary" />
            <input 
              type="date" 
              value={serialToIso(dateA)} 
              onChange={e => setDateA(isoToSerial(e.target.value))} 
              className="bg-transparent text-[10px] font-bold outline-none uppercase text-slate-600 focus:text-brand-primary transition-colors cursor-pointer"
            />
            <span className="text-slate-300 mx-1 font-bold">→</span>
            <input 
              type="date" 
              value={serialToIso(dateB)} 
              onChange={e => setDateB(isoToSerial(e.target.value))} 
              className="bg-transparent text-[10px] font-bold outline-none uppercase text-slate-600 focus:text-brand-primary transition-colors cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
            <MultiSelect label="Sede" options={sedesList} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Centro" options={centrosList} value={selCentro} onChange={setSelCentro} />
            <MultiSelect label="Estado" options={["SIN NOVEDAD", "FALTANTE", "SOBRANTE"]} value={selStatus} onChange={setSelStatus} icon={<Filter size={14} />} />
            <Button variant="ghost" size="sm" onClick={() => { setSelSede([]); setSelCentro([]); setSelStatus([]); }} leftIcon={<X size={14} />} className="uppercase tracking-tight text-[10px]">Limpiar</Button>
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
          <p className="text-sm text-slate-300 max-sm mx-auto">Seleccione las fechas para procesar el ranking de riesgo financiero.</p>
        </div>
      )}
    </div>
  );
}