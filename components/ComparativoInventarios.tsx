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
  X
} from "lucide-react";

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

function excelSerialToDate(serial: number) {
  // Excel base: 1899-12-30
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400; 
  return new Date(utcValue * 1000);
}

function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function weekKeyFromSerial(serial: number) {
  if (!serial || isNaN(serial)) return "N/A";
  const d = excelSerialToDate(serial);
  const { year, week } = getISOWeek(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
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
  const colStock = useMemo(() => findHeader(headers, ["STOCK A FECHA", "STOCK_FECHA", "STOCK"]), [headers]);
  const colCostoUnit = useMemo(() => findHeader(headers, ["COSTELANEA", "COSTELÁNEA", "COSTO UNITARIO", "COSTO"]), [headers]);
  
  const colSede = useMemo(() => findHeader(headers, ["SEDE", "ALMACEN", "ALMACÉN", "LOCAL", "TIENDA"]), [headers]);
  const colCentro = useMemo(() => findHeader(headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]), [headers]);
  const colEstado = useMemo(() => findHeader(headers, ["ESTADO", "TIPO", "CLASIFICACION", "CLASIFICACIÓN"]), [headers]);

  // Agrupar por semanas disponibles
  const semanasUnicas = useMemo(() => {
    if (!colFecha) return [];
    const set = new Set<string>();
    for (const r of rows) {
      const v = Number(r[colFecha]);
      if (Number.isFinite(v)) {
        set.add(weekKeyFromSerial(v));
      }
    }
    return Array.from(set).sort();
  }, [rows, colFecha]);

  const [weekA, setWeekA] = useState<string>("");
  const [weekB, setWeekB] = useState<string>("");
  
  const [selSede, setSelSede] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);
  const [selEstado, setSelEstado] = useState<string[]>([]);

  const getUniqueOpts = (col: string | null) => {
    if (!col) return [];
    const set = new Set<string>();
    rows.forEach(r => {
      const v = String(r[col] ?? "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  };

  const optSede = useMemo(() => getUniqueOpts(colSede), [colSede, rows]);
  const optCentro = useMemo(() => getUniqueOpts(colCentro), [colCentro, rows]);
  const optEstado = useMemo(() => getUniqueOpts(colEstado), [colEstado, rows]);

  useEffect(() => {
    if (semanasUnicas.length >= 2 && (weekA === "" || weekB === "")) {
      setWeekA(semanasUnicas[semanasUnicas.length - 2]);
      setWeekB(semanasUnicas[semanasUnicas.length - 1]);
    }
  }, [semanasUnicas, weekA, weekB]);

  const keyOf = (r: Row) => {
    const art = colArticulo ? norm(String(r[colArticulo] ?? "")) : "";
    const sub = colSub ? norm(String(r[colSub] ?? "")) : "";
    return `${art}__${sub}`;
  };

  const comparativo = useMemo(() => {
    if (!weekA || !weekB || !colStock) return null;

    const getSnapshotByWeek = (targetWeek: string) => {
      const map = new Map<string, { stock: number; articulo: string; unidad: string; costoUnit: number }>();
      
      rows.forEach(r => {
        const serial = Number(r[colFecha!]);
        if (!Number.isFinite(serial)) return;
        if (weekKeyFromSerial(serial) !== targetWeek) return;

        // Filtros Multi-opción
        if (colSede && selSede.length && !selSede.includes(String(r[colSede] ?? "").trim())) return;
        if (colCentro && selCentro.length && !selCentro.includes(String(r[colCentro] ?? "").trim())) return;
        if (colEstado && selEstado.length && !selEstado.includes(String(r[colEstado] ?? "").trim())) return;

        const k = keyOf(r);
        const stock = Number(r[colStock!] ?? 0);
        const costoUnit = colCostoUnit ? Number(r[colCostoUnit!] ?? 0) : 0;
        
        const prev = map.get(k);
        if (!prev) {
          map.set(k, {
            stock: Number.isFinite(stock) ? stock : 0,
            articulo: String(r[colArticulo!] ?? "").trim(),
            unidad: String(r[colSub!] ?? "").trim(),
            costoUnit: Number.isFinite(costoUnit) ? costoUnit : 0
          });
        } else {
          prev.stock += Number.isFinite(stock) ? stock : 0;
          if (!prev.costoUnit && Number.isFinite(costoUnit) && costoUnit > 0) {
            prev.costoUnit = costoUnit;
          }
        }
      });
      return map;
    };

    const mapA = getSnapshotByWeek(weekA);
    const mapB = getSnapshotByWeek(weekB);

    const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const items: any[] = [];
    let totalImpacto = 0;
    let totalFaltantes = 0;

    for (const k of allKeys) {
      const a = mapA.get(k);
      const b = mapB.get(k);

      const stockA = a?.stock ?? 0;
      const stockB = b?.stock ?? 0;
      const diff = stockB - stockA;

      if (diff === 0) continue;

      const costoUnit = b?.costoUnit ?? a?.costoUnit ?? 0;
      const impacto = diff * costoUnit;

      totalImpacto += impacto;
      if (diff < 0) totalFaltantes += Math.abs(impacto);

      items.push({
        articulo: (b ?? a)?.articulo ?? "N/A",
        sub: (b ?? a)?.unidad ?? "N/A",
        stockA,
        stockB,
        diff,
        novedad: diff < 0 ? "Faltante" : "Sobrante",
        impacto
      });
    }

    items.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

    return { items, totalImpacto, totalFaltantes };
  }, [weekA, weekB, rows, colFecha, colStock, colArticulo, colSub, colCostoUnit, colSede, colCentro, colEstado, selSede, selCentro, selEstado]);

  if (!colFecha || !colArticulo || !colSub || !colStock) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl flex items-center gap-4 text-amber-800">
        <Info className="w-8 h-8 shrink-0" />
        <div>
          <h3 className="font-bold text-lg">Estructura incompleta</h3>
          <p className="text-sm">Para generar el comparativo, el Excel debe incluir: FECHA, ARTÍCULO, SUBARTÍCULO y STOCK A FECHA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Comparativo Semanal</h2>
          <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">Auditoría agregada por semana (Suma de Stock)</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Semana Origen</span>
              <div className="relative">
                <select 
                  value={weekA} 
                  onChange={(e) => setWeekA(e.target.value)}
                  className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 appearance-none min-w-[140px] pr-8"
                >
                  <option value="">Seleccionar...</option>
                  {semanasUnicas.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <ArrowRight className="text-slate-300 w-4 h-4 mt-4" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-brand-muted uppercase ml-2 tracking-widest">Semana Destino</span>
              <div className="relative">
                <select 
                  value={weekB} 
                  onChange={(e) => setWeekB(e.target.value)}
                  className="bg-brand-bg border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-brand-primary outline-none focus:ring-4 focus:ring-brand-primary/5 appearance-none min-w-[140px] pr-8"
                >
                  <option value="">Seleccionar...</option>
                  {semanasUnicas.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Sede" options={optSede} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Centro" options={optCentro} value={selCentro} onChange={setSelCentro} />
            <MultiSelect label="Estado" options={optEstado} value={selEstado} onChange={setSelEstado} />
            
            {(selSede.length > 0 || selCentro.length > 0 || selEstado.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelSede([]); setSelCentro([]); setSelEstado([]); }}
                leftIcon={<X size={14} />}
                className="text-brand-danger hover:bg-brand-danger/10 uppercase tracking-tight text-[10px]"
                children="Limpiar"
              />
            )}
          </div>
        </div>
      </header>

      {comparativo ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <ArrowRightLeft className="w-20 h-20 text-brand-primary" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Items con Variación</p>
              <p className="text-5xl font-black text-brand-primary tabular-nums tracking-tighter">{comparativo.items.length}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Balance semana vs semana</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <TrendingDown className="w-20 h-20 text-brand-danger" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Faltantes</p>
              <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(comparativo.totalFaltantes)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Número de disminuciones de inventario</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <TrendingUp className="w-20 h-20 text-brand-success" />
              </div>
              <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Diferencia Neta</p>
              <p className={`text-3xl font-black tabular-nums tracking-tight ${comparativo.totalImpacto < 0 ? 'text-brand-danger' : 'text-brand-success'}`}>
                {comparativo.totalImpacto > 0 ? '+' : ''}{comparativo.totalImpacto.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Balance total de unidades</p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                <Table className="w-4 h-4 text-brand-primary" />
                Informe Detallado de Novedades Semanales
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Subartículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Stock a Fecha</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Stock Inventariado</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Variación</th>
                    <th className="px-10 py-5 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.items.slice(0, 300).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                      <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo}</td>
                      <td className="px-10 py-4 text-[11px] text-brand-muted uppercase font-bold">{r.sub}</td>
                      <td className="px-10 py-4 text-xs text-center text-brand-muted tabular-nums">{r.stockA.toLocaleString()}</td>
                      <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold tabular-nums">{r.stockB.toLocaleString()}</td>
                      <td className={`px-10 py-4 text-xs text-center font-black tabular-nums ${r.diff < 0 ? 'text-brand-danger' : 'text-brand-success'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
                      </td>
                      <td className="px-10 py-4 text-center">
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${
                          r.novedad === 'Faltante' ? 'bg-brand-danger/10 border-brand-danger/20 text-brand-danger' : 'bg-brand-success/10 border-brand-success/20 text-brand-success'
                        }`}>
                          {r.novedad}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-10 py-6 bg-brand-bg border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>Consolidando {rows.length.toLocaleString()} registros históricos</span>
                <span className="flex items-center gap-2"><ArrowRightLeft className="w-3.5 h-3.5 text-brand-primary" /> Agregación Semanal Activa</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-brand-bg border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Sin semanas para comparar</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Seleccione las semanas arriba para calcular variaciones agregadas de inventario.</p>
        </div>
      )}
    </div>
  );
}
