import React, { useMemo, useState, useEffect, useRef } from "react";
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
  Filter as FilterIcon
} from "lucide-react";

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

const excelSerialToDate = (serial: number) => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400; 
  return new Date(utcValue * 1000);
};

const formatDateFromSerial = (serial: number) => {
  if (!serial || isNaN(serial)) return "N/A";
  const d = excelSerialToDate(serial);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// --- Sub-componente MultiSelect Estilizado (Tema Claro) ---
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
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-tight transition-all ${
          value.length > 0 
            ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' 
            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
        }`}
      >
        {label}{value.length ? ` (${value.length})` : ""}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[60] mt-2 w-64 max-h-72 overflow-auto rounded-2xl bg-white border border-slate-200 p-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <button onClick={() => onChange([])} className="text-[10px] text-emerald-600 font-bold hover:underline">Limpiar</button>
          </div>
          <div className="space-y-1">
            {options.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic py-2">Sin opciones</p>
            ) : (
              options.map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={value.includes(opt)} 
                    onChange={() => toggle(opt)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-50"
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
  
  // Nuevas columnas para filtros
  const colSede = useMemo(() => findHeader(headers, ["SEDE", "ALMACEN", "ALMACÉN", "LOCAL", "TIENDA"]), [headers]);
  const colCentro = useMemo(() => findHeader(headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]), [headers]);
  const colEstado = useMemo(() => findHeader(headers, ["ESTADO", "TIPO", "CLASIFICACION", "CLASIFICACIÓN"]), [headers]);

  const fechasUnicas = useMemo(() => {
    if (!colFecha) return [];
    const set = new Set<number>();
    for (const r of rows) {
      const v = Number(r[colFecha]);
      if (Number.isFinite(v)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rows, colFecha]);

  const [fechaA, setFechaA] = useState<number | "">("");
  const [fechaB, setFechaB] = useState<number | "">("");
  
  // Estados para filtros multi-opción
  const [selSede, setSelSede] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);
  const [selEstado, setSelEstado] = useState<string[]>([]);

  // Opciones únicas para los selectores
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

  // Fechas por defecto
  useEffect(() => {
    if (fechasUnicas.length >= 2 && (fechaA === "" || fechaB === "")) {
      setFechaA(fechasUnicas[fechasUnicas.length - 2]);
      setFechaB(fechasUnicas[fechasUnicas.length - 1]);
    }
  }, [fechasUnicas, fechaA, fechaB]);

  const keyOf = (r: Row) => {
    const art = colArticulo ? String(r[colArticulo] ?? "").trim() : "";
    const sub = colSub ? String(r[colSub] ?? "").trim() : "";
    return `${art}__${sub}`;
  };

  const comparativo = useMemo(() => {
    if (fechaA === "" || fechaB === "" || !colStock) return null;

    const snapshot = (targetFecha: number) => {
      const map = new Map<string, Row>();
      rows.forEach(r => {
        if (Number(r[colFecha!]) !== targetFecha) return;

        // Filtro SEDE
        if (colSede && selSede.length) {
          if (!selSede.includes(String(r[colSede] ?? "").trim())) return;
        }
        // Filtro CENTRO
        if (colCentro && selCentro.length) {
          if (!selCentro.includes(String(r[colCentro] ?? "").trim())) return;
        }
        // Filtro ESTADO (si existe en columna)
        if (colEstado && selEstado.length) {
          if (!selEstado.includes(String(r[colEstado] ?? "").trim())) return;
        }

        map.set(keyOf(r), r);
      });
      return map;
    };

    const mapA = snapshot(fechaA);
    const mapB = snapshot(fechaB);

    const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const items: any[] = [];
    let totalImpacto = 0;
    let totalFaltantes = 0;
    let totalSobrantes = 0;

    for (const k of allKeys) {
      const a = mapA.get(k);
      const b = mapB.get(k);

      const stockA = Number(a?.[colStock] ?? 0);
      const stockB = Number(b?.[colStock] ?? 0);
      const diff = stockB - stockA;

      if (diff === 0) continue;

      const costoUnit = colCostoUnit ? Number((b ?? a)?.[colCostoUnit] ?? 0) : 0;
      const impacto = diff * costoUnit;

      totalImpacto += impacto;
      if (diff < 0) totalFaltantes += Math.abs(impacto);
      if (diff > 0) totalSobrantes += impacto;

      items.push({
        articulo: (b ?? a)?.[colArticulo!] ?? "N/A",
        sub: (b ?? a)?.[colSub!] ?? "N/A",
        stockA,
        stockB,
        diff,
        novedad: diff < 0 ? "FALTANTE" : "SOBRANTE",
        impacto
      });
    }

    // Ordenar por mayor impacto absoluto
    items.sort((x, y) => Math.abs(y.impacto) - Math.abs(x.impacto));

    return { items, totalImpacto, totalFaltantes, totalSobrantes };
  }, [fechaA, fechaB, rows, colFecha, colStock, colArticulo, colSub, colCostoUnit, colSede, colCentro, colEstado, selSede, selCentro, selEstado]);

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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Comparativo Estratégico</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Auditoría por llave única (Artículo + Unidad)</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          {/* Selectores de Fecha */}
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">A</span>
              <div className="relative">
                <select 
                  value={fechaA} 
                  onChange={(e) => setFechaA(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-50 appearance-none min-w-[120px] pr-8"
                >
                  {fechasUnicas.map(f => <option key={f} value={f}>{formatDateFromSerial(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <ArrowRight className="text-slate-300 w-4 h-4 mt-4" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">B</span>
              <div className="relative">
                <select 
                  value={fechaB} 
                  onChange={(e) => setFechaB(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-50 appearance-none min-w-[120px] pr-8"
                >
                  {fechasUnicas.map(f => <option key={f} value={f}>{formatDateFromSerial(f)}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Filtros Multi-opción */}
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="Sede" options={optSede} value={selSede} onChange={setSelSede} />
            <MultiSelect label="Centro" options={optCentro} value={selCentro} onChange={setSelCentro} />
            <MultiSelect label="Estado" options={optEstado} value={selEstado} onChange={setSelEstado} />
            
            {(selSede.length > 0 || selCentro.length > 0 || selEstado.length > 0) && (
              <button
                onClick={() => { setSelSede([]); setSelCentro([]); setSelEstado([]); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Limpiar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {comparativo ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <ArrowRightLeft className="w-20 h-20 text-slate-900" />
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Items con Novedad</p>
              <p className="text-5xl font-black text-slate-900 tabular-nums tracking-tighter">{comparativo.items.length}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Variaciones físicas detectadas</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <TrendingDown className="w-20 h-20 text-red-600" />
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Costo Faltantes</p>
              <p className="text-3xl font-black text-red-600 tabular-nums tracking-tight">{formatCOP(comparativo.totalFaltantes)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Impacto económico negativo</p>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                 <TrendingUp className="w-20 h-20 text-emerald-600" />
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Costo Neto</p>
              <p className={`text-3xl font-black tabular-nums tracking-tight ${comparativo.totalImpacto < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCOP(comparativo.totalImpacto)}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Balance total (B - A)</p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/20">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                <Table className="w-4 h-4 text-emerald-600" />
                Auditoría de Variaciones
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Artículo</th>
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">Unidad</th>
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Stock A</th>
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Stock B</th>
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Diferencia</th>
                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Impacto ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.items.slice(0, 200).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-10 py-4 text-xs font-bold text-slate-700">{r.articulo}</td>
                      <td className="px-10 py-4 text-[11px] text-slate-400 uppercase font-bold">{r.sub}</td>
                      <td className="px-10 py-4 text-xs text-center text-slate-500">{r.stockA}</td>
                      <td className="px-10 py-4 text-xs text-center text-slate-800 font-bold">{r.stockB}</td>
                      <td className={`px-10 py-4 text-xs text-center font-black ${r.diff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff}
                      </td>
                      <td className={`px-10 py-4 text-xs text-right font-black tabular-nums ${r.impacto < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCOP(r.impacto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>Mostrando {Math.min(comparativo.items.length, 200)} novedades auditadas</span>
                <span className="flex items-center gap-2"><ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" /> Auditoría por Referencia Única</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem] p-32 text-center">
          <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">Sin fechas de comparación</h3>
          <p className="text-sm text-slate-300 max-w-sm mx-auto">Seleccione dos fechas arriba para calcular automáticamente las variaciones de inventario y su impacto contable.</p>
        </div>
      )}
    </div>
  );
}
