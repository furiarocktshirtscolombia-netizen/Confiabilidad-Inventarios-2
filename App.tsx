
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LocalDatabase, AnalysisResult } from './types';
import { 
  parseUploadedFile, 
  loadExcelFromPublic, 
  loadDbFromCache, 
  clearLocalDb,
  DB_FILE_NAME 
} from './services/databaseService';
import { analyzeData } from './services/geminiService';
import { 
  Database as DbIcon, 
  LayoutDashboard, 
  Upload, 
  Settings as SettingsIcon,
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Zap,
  FileSpreadsheet,
  Table,
  Trash2,
  Search,
  HardDrive,
  Cloud,
  FileCode,
  TrendingDown,
  TrendingUp,
  Percent,
  Filter as FilterIcon,
  Calendar,
  ChevronDown,
  X
} from 'lucide-react';

// --- Helpers de Normalización y Fechas ---
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .replace(/\s+/g, " ")           // Normaliza espacios múltiples
    .trim()
    .toUpperCase();

const findHeader = (headers: string[], candidates: string[]) => {
  const normalizedMap = new Map(headers.map(h => [norm(h), h]));
  for (const c of candidates) {
    const real = normalizedMap.get(norm(c));
    if (real) return real;
  }
  return null;
};

/**
 * Conversión de serial Excel (ej: 46037) a objeto Date
 */
const excelSerialToDate = (serial: number) => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400; 
  return new Date(utcValue * 1000);
};

/**
 * Conversión de Date a serial Excel aproximado (solo día)
 * Usado para comparar inputs del usuario con los datos de la DB
 */
const dateToExcelSerial = (d: Date) => {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utc / 86400000) + 25569;
};

const HIDDEN = new Set([
  "SERIE",
  "CENTRO DE COSTOS",
  "CENTRO COSTOS",
  "SEDE",
  "ALMACEN",
  "ESTABLECIMIENTO",
  "TIENDA",
  "FECHA"
]);

const getVisibleHeaders = (headers: string[]) =>
  headers.filter((h) => !HIDDEN.has(norm(h)));

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

// --- Componente MultiSelect (Checkboxes Estilizados) ---
const MultiSelect: React.FC<{
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ label, options, value, onChange }) => {
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
    if (value.includes(opt)) onChange(value.filter(x => x !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-tight transition-all ${
          value.length > 0 
            ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' 
            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
        }`}
      >
        {label}{value.length ? ` (${value.length})` : ""}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[60] mt-2 w-64 max-h-72 overflow-auto rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/50">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <button onClick={() => onChange([])} className="text-[10px] text-emerald-500 font-bold hover:underline">Limpiar</button>
          </div>
          <div className="space-y-1">
            {options.length === 0 ? (
              <p className="text-[10px] text-slate-600 italic py-2">Sin opciones</p>
            ) : (
              options.map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={value.includes(opt)} 
                    onChange={() => toggle(opt)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-100 transition-colors truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- App Principal ---
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  
  // Estados de Filtros
  const [selAlmacen, setSelAlmacen] = useState<string[]>([]);
  const [selFamilia, setSelFamilia] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);
  const [showFecha, setShowFecha] = useState(false);
  const [desde, setDesde] = useState<string>(""); // yyyy-mm-dd
  const [hasta, setHasta] = useState<string>(""); // yyyy-mm-dd

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initDb = async () => {
      setLoading(true);
      const cached = loadDbFromCache();
      if (cached) {
        setDb(cached);
        setLoading(false);
        return;
      }
      const fromPublic = await loadExcelFromPublic();
      if (fromPublic) {
        setDb(fromPublic);
        setStatus({ type: 'success', message: '¡Base de datos pública detectada automáticamente!' });
      }
      setLoading(false);
    };
    initDb();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus({ type: null, message: '' });
    try {
      const parsedDb = await parseUploadedFile(file);
      setDb(parsedDb);
      setStatus({ type: 'success', message: `¡Base de datos "${file.name}" cargada!` });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error al procesar el Excel.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!db || db.rows.length === 0) return;
    setLoading(true);
    try {
      const sample = db.rows.slice(0, 50).map(row => Object.values(row).join(',')).join('\n');
      const result = await analyzeData(sample);
      setAnalysis(result);
      setStatus({ type: 'success', message: 'Análisis de IA completado.' });
    } catch (e) {
      setStatus({ type: 'error', message: 'Fallo el análisis de IA.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearDb = () => {
    if (confirm("¿Estás seguro de eliminar la base de datos local?")) {
      clearLocalDb();
      setDb(null);
      setAnalysis(null);
      handleResetFilters();
      loadExcelFromPublic().then(res => {
        if (res) setDb(res);
      });
    }
  };

  const handleResetFilters = () => {
    setSelAlmacen([]);
    setSelFamilia([]);
    setSelCentro([]);
    setDesde("");
    setHasta("");
    setSearchTerm("");
  };

  // --- Identificación de Columnas (Blind Finding) ---
  const cols = useMemo(() => {
    if (!db) return {};
    return {
      almacen: findHeader(db.headers, ["ALMACEN", "ALMACÉN", "SEDE", "LOCAL", "TIENDA"]),
      familia: findHeader(db.headers, ["FAMILIA"]),
      centro: findHeader(db.headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]),
      fecha: findHeader(db.headers, ["FECHA", "DATE"]),
      costAdj: findHeader(db.headers, ["COSTO AJUSTE"]),
      stock: findHeader(db.headers, ["STOCK A FECHA"]),
      costLine: findHeader(db.headers, ["COSTELANEA", "COSTO LINEA", "COSTO TOTAL"]) || findHeader(db.headers, ["COSTO AJUSTE"])
    };
  }, [db]);

  // --- Opciones para Filtros (Unique Values) ---
  const getOptions = (col: string | null | undefined) => {
    if (!db || !col) return [];
    const set = new Set<string>();
    db.rows.forEach(r => {
      const v = String(r[col] ?? "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  };

  const optAlmacen = useMemo(() => getOptions(cols.almacen), [db, cols.almacen]);
  const optFamilia = useMemo(() => getOptions(cols.familia), [db, cols.familia]);
  const optCentro = useMemo(() => getOptions(cols.centro), [db, cols.centro]);

  // --- Lógica de Filtrado Combinado (Multi + Rango Fecha + Search) ---
  const filteredRows = useMemo(() => {
    if (!db) return [];
    
    // Preparar límites de fecha si existen
    const d1 = desde ? dateToExcelSerial(new Date(desde + "T00:00:00")) : null;
    const d2 = hasta ? dateToExcelSerial(new Date(hasta + "T23:59:59")) : null;
    const term = norm(searchTerm);

    return db.rows.filter(r => {
      // 1. Búsqueda de texto global
      if (term && !Object.values(r).some(val => norm(String(val)).includes(term))) return false;

      // 2. Filtros Multi-select (Almacén, Familia, Centro)
      if (cols.almacen && selAlmacen.length && !selAlmacen.includes(String(r[cols.almacen]).trim())) return false;
      if (cols.familia && selFamilia.length && !selFamilia.includes(String(r[cols.familia]).trim())) return false;
      if (cols.centro && selCentro.length && !selCentro.includes(String(r[cols.centro]).trim())) return false;

      // 3. Filtro de Rango de Fecha (Comparando contra serial Excel)
      if (cols.fecha && (d1 !== null || d2 !== null)) {
        const rawDate = Number(r[cols.fecha]);
        if (!Number.isFinite(rawDate)) return false;
        if (d1 !== null && rawDate < d1) return false;
        if (d2 !== null && rawDate > d2) return false;
      }

      return true;
    });
  }, [db, cols, selAlmacen, selFamilia, selCentro, desde, hasta, searchTerm]);

  // --- Cálculos de Métricas sobre Datos Filtrados ---
  const metrics = useMemo(() => {
    if (!db || filteredRows.length === 0) return { reliability: 0, negativeAdj: 0, totalAdj: 0 };

    let negSum = 0;
    let totalSum = 0;
    let novedades = 0;
    const totalRefs = filteredRows.length;

    filteredRows.forEach(row => {
      const adjVal = parseFloat(String(row[cols.costAdj || ""]).replace(/[^0-9.-]+/g, "")) || 0;
      totalSum += adjVal;
      if (adjVal !== 0) novedades++;

      // NUEVA DEFINICIÓN: "TOTAL AJUSTE NEGATIVO"
      // Suma del costo de ítems donde STOCK A FECHA < 0
      if (cols.stock) {
        const stockVal = parseFloat(String(row[cols.stock]).replace(/[^0-9.-]+/g, "")) || 0;
        if (stockVal < 0) {
          const costVal = cols.costLine ? parseFloat(String(row[cols.costLine]).replace(/[^0-9.-]+/g, "")) || 0 : 0;
          negSum += costVal;
        }
      }
    });

    const reliability = totalRefs > 0 ? ((totalRefs - novedades) / totalRefs) * 100 : 0;

    return { reliability, negativeAdj: negSum, totalAdj: totalSum };
  }, [filteredRows, cols]);

  const getSourceIcon = (source: LocalDatabase['source']) => {
    switch (source) {
      case 'public': return <Cloud className="w-4 h-4 text-sky-400" />;
      case 'cache': return <HardDrive className="w-4 h-4 text-amber-400" />;
      case 'upload': return <FileCode className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getSourceLabel = (source: LocalDatabase['source']) => {
    switch (source) {
      case 'public': return 'Nube (BASE.xlsx)';
      case 'cache': return 'Caché Navegador';
      case 'upload': return 'Archivo Subido';
    }
  };

  if (loading && !db) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
         <div className="relative mb-6">
            <div className="w-20 h-20 border-b-2 border-emerald-500 rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-emerald-400 font-black tracking-widest animate-pulse text-xs uppercase">Sincronizando MaestroDB...</p>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="bg-amber-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <AlertCircle className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Sin base de datos</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            No se detectó el archivo automático <span className="text-amber-500 font-mono">/{DB_FILE_NAME}</span>.
            Sube un Excel para iniciar el análisis.
          </p>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-600/20 active:scale-95">
            <Upload className="w-5 h-5" />
            Subir Archivo Manual
          </button>
          <p className="text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">Arquitectura de Datos LiquorHub</p>
        </div>
      </div>
    );
  }

  const visibleHeaders = getVisibleHeaders(db.headers);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <DbIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">MaestroDB</h1>
        </div>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'analysis', icon: Zap, label: 'IA Analítica' },
            { id: 'settings', icon: SettingsIcon, label: 'Gestión' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'}`}>
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {status.type && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
            <button onClick={() => setStatus({type:null, message:''})} className="ml-auto opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
          </div>
        )}

        {activeTab === 'dashboard' && db && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Panel Operativo</h2>
                <p className="text-slate-400 text-xs font-medium">
                   Mostrando {filteredRows.length.toLocaleString()} de {db.rows.length.toLocaleString()} referencias | {db.name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 uppercase tracking-widest shadow-inner">
                  {getSourceIcon(db.source)}
                  {getSourceLabel(db.source)}
                </div>
              </div>
            </header>

            {/* --- Tarjetas de Métricas --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.2rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                   <Percent className="w-20 h-20 text-emerald-500" />
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Confiabilidad de inventarios</p>
                <p className="text-4xl font-black text-emerald-400 tabular-nums">{metrics.reliability.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase">Basado en selección actual</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.2rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                   <TrendingDown className="w-20 h-20 text-red-500" />
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total ajuste negativo</p>
                <p className="text-3xl font-black text-red-400 tabular-nums">{formatCOP(metrics.negativeAdj)}</p>
                <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase">Impacto real de los faltantes (Stock &lt; 0)</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.2rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                   <TrendingUp className="w-20 h-20 text-sky-500" />
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total ajuste general</p>
                <p className="text-3xl font-black text-white tabular-nums">{formatCOP(metrics.totalAdj)}</p>
                <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase">Balance total filtrado</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="px-8 py-8 border-b border-slate-800 bg-slate-900/40">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                  <h3 className="font-bold text-white flex items-center gap-2 shrink-0 uppercase tracking-widest text-xs">
                    <Table className="w-4 h-4 text-emerald-500" />
                    Explorador de Datos
                  </h3>
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar por artículo, código o marca..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* --- Panel de Filtros Multiselección --- */}
                <div className="flex flex-wrap items-center gap-3">
                  <MultiSelect label="Almacén" options={optAlmacen} value={selAlmacen} onChange={setSelAlmacen} />
                  <MultiSelect label="Familia" options={optFamilia} value={selFamilia} onChange={setSelFamilia} />
                  <MultiSelect label="Centro de costo" options={optCentro} value={selCentro} onChange={setSelCentro} />
                  
                  <button
                    onClick={() => setShowFecha(!showFecha)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-tight transition-all ${
                      desde || hasta 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Fecha {(desde || hasta) ? '(Rango Activo)' : ''}
                  </button>

                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-all text-[11px] font-black uppercase tracking-tight ml-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpiar Todo
                  </button>
                </div>

                {/* --- Rango de Fecha Desplegable --- */}
                {showFecha && (
                  <div className="mt-6 p-6 bg-slate-950 border border-slate-800 rounded-3xl flex flex-wrap gap-8 animate-in slide-in-from-top-4 duration-400">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em] block ml-1">Fecha Desde</label>
                      <input 
                        type="date" 
                        value={desde} 
                        onChange={(e) => setDesde(e.target.value)} 
                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all color-scheme-dark"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em] block ml-1">Fecha Hasta</label>
                      <input 
                        type="date" 
                        value={hasta} 
                        onChange={(e) => setHasta(e.target.value)} 
                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all color-scheme-dark"
                      />
                    </div>
                    <div className="flex items-end pb-1 text-[10px] text-slate-600 font-bold uppercase tracking-tight italic">
                      * El sistema utiliza la columna oculta "FECHA" de su Excel para el filtrado.
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950">
                      {visibleHeaders.map((h) => (
                        <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/20 transition-colors group">
                        {visibleHeaders.map((h) => (
                          <td key={h} className="px-8 py-4.5 text-[13px] text-slate-400 border-b border-slate-800/40 whitespace-nowrap group-hover:text-slate-200">
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={visibleHeaders.length} className="px-8 py-24 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <FilterIcon className="w-12 h-12 text-slate-800" />
                            <p className="text-slate-500 italic text-sm font-medium">No se encontraron resultados para los filtros seleccionados.</p>
                            <button onClick={handleResetFilters} className="text-xs text-emerald-500 font-bold uppercase hover:underline">Restablecer filtros</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-8 py-5 bg-slate-950/40 border-t border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                <span>Página 1 de {Math.ceil(filteredRows.length / 50)} | Mostrando 50 registros por página</span>
                <span className="flex items-center gap-2"><FilterIcon className="w-3 h-3 text-emerald-500" /> Filtrado por reglas de negocio LiquorHub</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            {!analysis ? (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-20 text-center shadow-2xl">
                <div className="bg-indigo-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border border-indigo-500/20">
                  <Zap className="w-12 h-12 text-indigo-500" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Análisis Estratégico IA</h2>
                <p className="text-slate-400 mb-10 max-w-sm mx-auto leading-relaxed font-medium">Gemini Pro procesará {filteredRows.length.toLocaleString()} referencias para detectar anomalías críticas.</p>
                <button onClick={handleAnalyze} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 px-12 rounded-[2.5rem] flex items-center gap-3 mx-auto shadow-xl shadow-indigo-600/30 active:scale-95 transition-all uppercase text-xs tracking-widest">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Generar Informe Maestro
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3 uppercase tracking-widest text-sm"><Zap className="text-indigo-500 w-5 h-5" /> Inteligencia Predictiva</h2>
                  <button onClick={() => setAnalysis(null)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest border-b border-slate-800 pb-1 transition-colors">Nuevo Escaneo</button>
                </div>
                <div className="bg-slate-900 border border-indigo-500/20 rounded-[2.8rem] p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                     <Zap className="w-48 h-48 text-indigo-500" />
                  </div>
                  <p className="text-xl text-slate-100 leading-relaxed italic border-l-4 border-indigo-500 pl-10 mb-14 font-medium font-serif">"{analysis.summary}"</p>
                  <div className="grid lg:grid-cols-2 gap-12">
                    <div className="bg-slate-950/40 p-10 rounded-[2.2rem] border border-slate-800/60">
                      <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-8 flex items-center gap-2"><Search className="w-3 h-3"/> Hallazgos Clave</h4>
                      <ul className="space-y-6">
                        {analysis.insights.map((ins, i) => (
                          <li key={i} className="text-sm text-slate-400 flex gap-5 leading-relaxed"><span className="text-indigo-500 font-black bg-indigo-500/10 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-indigo-500/20">{i+1}</span> {ins}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-emerald-600/5 p-10 rounded-[2.2rem] border border-emerald-500/10">
                      <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-8 flex items-center gap-2"><CheckCircle2 className="w-3 h-3"/> Acciones Sugeridas</h4>
                      <ul className="space-y-6">
                        {analysis.suggestedActions.map((action, i) => (
                          <li key={i} className="text-sm text-slate-300 flex gap-5 leading-relaxed"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> {action}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && db && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.8rem] p-12 shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Gestión MaestroDB</h2>
              <p className="text-slate-500 text-sm mb-12 font-medium leading-relaxed">Configura el origen de datos y las reglas de visibilidad del sistema operativo.</p>
              <div className="space-y-8">
                <div className="bg-slate-950 border border-slate-800 rounded-[2.2rem] p-10 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-6">
                    <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20">
                      <FileSpreadsheet className="w-9 h-9 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-base font-black text-white mb-1">{db.name}</p>
                      <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">Sincronizado: {db.lastUpdated}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-all shadow-lg" title="Cargar Nuevo"><RefreshCw className="w-5.5 h-5.5" /></button>
                    <button onClick={handleClearDb} className="p-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all shadow-lg" title="Eliminar"><Trash2 className="w-5.5 h-5.5" /></button>
                  </div>
                </div>
                
                <div className="p-10 bg-slate-950/50 border border-slate-800 rounded-[2.2rem] text-xs space-y-6">
                   <div className="flex justify-between items-center border-b border-slate-800/50 pb-4">
                      <span className="text-slate-500 uppercase font-black tracking-widest">Origen de Sincronización</span>
                      <span className="text-slate-300 font-mono bg-slate-800 px-4 py-1.5 rounded-xl text-[10px]">{getSourceLabel(db.source)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-800/50 pb-4">
                      <span className="text-slate-500 uppercase font-black tracking-widest">Columnas Encriptadas</span>
                      <span className="text-amber-500 font-black bg-amber-500/10 px-4 py-1.5 rounded-xl text-[10px]">{db.headers.length - visibleHeaders.length} Campos ocultos</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-black tracking-widest block mb-4">Etiquetas de Ocultación Activas:</span>
                      <div className="flex flex-wrap gap-2.5">
                        {Array.from(HIDDEN).map(tag => (
                          <span key={tag} className="bg-slate-900 text-slate-500 px-4 py-2 rounded-xl text-[9px] font-black border border-slate-800 uppercase tracking-tight">{tag}</span>
                        ))}
                      </div>
                    </div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-[2.2rem] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-emerald-600/30 uppercase tracking-[0.2em] text-xs">
                  <Upload className="w-5.5 h-5.5" />
                  Actualizar Maestro Local
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center">
          <div className="relative mb-10">
            <div className="w-28 h-28 border-b-2 border-emerald-500 rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-emerald-500" />
          </div>
          <p className="text-emerald-400 font-black tracking-[0.3em] animate-pulse text-[11px] uppercase">Recalculando Métricas Operativas</p>
        </div>
      )}
    </div>
  );
};

export default App;
