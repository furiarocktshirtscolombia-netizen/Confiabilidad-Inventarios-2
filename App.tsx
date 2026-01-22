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
import ComparativoInventarios from './components/ComparativoInventarios';
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
  TrendingDown,
  TrendingUp,
  Percent,
  Filter as FilterIcon,
  Calendar,
  ChevronDown,
  X,
  ArrowRightLeft
} from 'lucide-react';

// --- Helpers de Normalización ---
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
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

const dateToExcelSerial = (d: Date) => {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utc / 86400000) + 25569;
};

// Columnas que se ocultan de la vista de tabla
const HIDDEN = new Set([
  "SERIE",
  "CENTRO DE COSTOS",
  "CENTRO COSTOS",
  "SEDE",
  "ALMACEN",
  "ESTABLECIMIENTO",
  "TIENDA",
  "FECHA",
  "COSTE LINEA",
  "COSTELANEA",
  "COSTO LINEA",
  "COSTO TOTAL",
  "COSTO AJUSTE",
  "COSTO UNITARIO",
  "COSTO_UNITARIO",
  "FAMILIA",
  "GRUPO",
  "MARCA",
  "SUB-FAMILIA"
]);

const getVisibleHeaders = (headers: string[]) =>
  headers.filter((h) => !HIDDEN.has(norm(h)));

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const getSourceIcon = (source: LocalDatabase['source']) => {
  switch (source) {
    case 'public': return <Cloud className="w-4 h-4 text-brand-success" />;
    case 'upload': return <Upload className="w-4 h-4 text-amber-600" />;
    case 'cache': return <HardDrive className="w-4 h-4 text-sky-600" />;
    default: return <DbIcon className="w-4 h-4 text-slate-400" />;
  }
};

const getSourceLabel = (source: LocalDatabase['source']) => {
  switch (source) {
    case 'public': return 'Nube Pública';
    case 'upload': return 'Archivo Local';
    case 'cache': return 'Caché Persistente';
    default: return 'Origen Desconocido';
  }
};

// --- MultiSelect Component ---
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
            ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20' 
            : 'bg-white border-slate-200 text-brand-muted hover:border-slate-400'
        }`}
      >
        {label}{value.length ? ` (${value.length})` : ""}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[60] mt-2 w-64 max-h-72 overflow-auto rounded-2xl bg-white border border-slate-200 p-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">{label}</span>
            <button onClick={() => onChange([])} className="text-[10px] text-brand-primary font-bold hover:underline">Limpiar</button>
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
                    className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20"
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
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  
  // Filter States
  const [selAlmacen, setSelAlmacen] = useState<string[]>([]);
  const [selFamilia, setSelFamilia] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);
  const [showFecha, setShowFecha] = useState(false);
  const [desde, setDesde] = useState<string>(""); 
  const [hasta, setHasta] = useState<string>(""); 

  const globalFileInputRef = useRef<HTMLInputElement>(null);

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
      if (globalFileInputRef.current) globalFileInputRef.current.value = '';
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error al procesar el Excel.' });
    } finally {
      setLoading(false);
    }
  };

  const triggerUpload = () => {
    globalFileInputRef.current?.click();
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

  // --- Column Identification ---
  const cols = useMemo(() => {
    if (!db) return {};
    return {
      almacen: findHeader(db.headers, ["ALMACEN", "ALMACÉN", "SEDE", "LOCAL", "TIENDA"]),
      familia: findHeader(db.headers, ["FAMILIA"]),
      articulo: findHeader(db.headers, ["ARTICULO", "ARTÍCULO"]),
      subarticulo: findHeader(db.headers, ["SUBARTICULO", "SUBARTÍCULO"]),
      centro: findHeader(db.headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]),
      fecha: findHeader(db.headers, ["FECHA", "DATE"]),
      costAdj: findHeader(db.headers, ["COSTO AJUSTE"]),
      stock: findHeader(db.headers, ["STOCK A FECHA"]),
      costLine: findHeader(db.headers, ["COSTELANEA", "COSTELÁNEA", "COSTO LINEA", "COSTO TOTAL"]) || findHeader(db.headers, ["COSTO AJUSTE"])
    };
  }, [db]);

  // --- Filter Options ---
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

  // --- Combined Filtering Logic ---
  const filteredRows = useMemo(() => {
    if (!db) return [];
    const d1 = desde ? dateToExcelSerial(new Date(desde + "T00:00:00")) : null;
    const d2 = hasta ? dateToExcelSerial(new Date(hasta + "T23:59:59")) : null;
    const term = norm(searchTerm);
    return db.rows.filter(r => {
      if (term && !Object.values(r).some(val => norm(String(val)).includes(term))) return false;
      if (cols.almacen && selAlmacen.length && !selAlmacen.includes(String(r[cols.almacen]).trim())) return false;
      if (cols.familia && selFamilia.length && !selFamilia.includes(String(r[cols.familia]).trim())) return false;
      if (cols.centro && selCentro.length && !selCentro.includes(String(r[cols.centro]).trim())) return false;
      if (cols.fecha && (d1 !== null || d2 !== null)) {
        const rawDate = Number(r[cols.fecha]);
        if (!Number.isFinite(rawDate)) return false;
        if (d1 !== null && rawDate < d1) return false;
        if (d2 !== null && rawDate > d2) return false;
      }
      return true;
    });
  }, [db, cols, selAlmacen, selFamilia, selCentro, desde, hasta, searchTerm]);

  // --- Dashboard Metrics ---
  const metrics = useMemo(() => {
    if (!db || filteredRows.length === 0) return { reliability: 0, negativeAdj: 0, totalAdj: 0 };
    let negSum = 0; let totalSum = 0; let novedades = 0;
    
    filteredRows.forEach(row => {
      const adjVal = parseFloat(String(row[cols.costAdj || ""]).replace(/[^0-9.-]+/g, "")) || 0;
      totalSum += adjVal;
      if (adjVal !== 0) novedades++;
      
      if (cols.stock) {
        const stockVal = parseFloat(String(row[cols.stock]).replace(/[^0-9.-]+/g, "")) || 0;
        if (stockVal < 0) {
          const costVal = cols.costLine ? parseFloat(String(row[cols.costLine]).replace(/[^0-9.-]+/g, "")) || 0 : 0;
          negSum += costVal;
        }
      }
    });

    // Lógica de confiabilidad (Razón directa Contadas / Novedad, max 100)
    const totalContadas = filteredRows.length;
    const totalNovedades = novedades;
    
    const reliabilityRaw = totalNovedades > 0 
      ? (totalContadas / totalNovedades) * 100 
      : 100;
      
    return { 
      reliability: Math.min(reliabilityRaw, 100), 
      negativeAdj: negSum, 
      totalAdj: totalSum 
    };
  }, [filteredRows, cols]);

  const visibleHeaders = getVisibleHeaders(db ? db.headers : []);

  // Determinar color de confiabilidad basado en el valor
  const getReliabilityColor = (val: number) => {
    if (val >= 90) return 'text-brand-success';
    if (val >= 70) return 'text-amber-500';
    return 'text-brand-danger';
  };

  // --- Renderizado Condicional ---
  
  if (loading && !db) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
         <div className="relative mb-6">
            <div className="w-20 h-20 border-b-2 border-brand-primary rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-brand-primary" />
          </div>
          <p className="text-brand-primary font-black tracking-widest animate-pulse text-[10px] uppercase">Sincronizando MaestroDB...</p>
      </div>
    );
  }

  // --- Contenido Principal ---
  const mainContent = !db ? (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white border border-slate-200 p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="bg-amber-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Sin base de datos</h1>
        <p className="text-brand-muted text-sm mb-8 leading-relaxed">
          No se detectó el archivo automático <span className="text-amber-600 font-mono">/{DB_FILE_NAME}</span>.
          Sube un Excel para iniciar el análisis maestro.
        </p>
        <button onClick={triggerUpload} className="w-full bg-brand-primary hover:bg-[#0a355c] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-primary/20 active:scale-95">
          <Upload className="w-5 h-5" />
          Subir Archivo Manual
        </button>
        <p className="text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold">LiquorHub Data Engine</p>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-brand-bg text-slate-900 selection:bg-brand-primary/5 selection:text-brand-primary">
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-brand-primary/20">
            <DbIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-brand-primary to-brand-primary bg-clip-text text-transparent">MaestroDB</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Resumen' },
            { id: 'comparative', icon: ArrowRightLeft, label: 'Comparativo' },
            { id: 'analysis', icon: Zap, label: 'IA Analítica' },
            { id: 'settings', icon: SettingsIcon, label: 'Gestión' }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === tab.id 
                  ? 'bg-brand-primary text-white shadow-sm' 
                  : 'text-brand-muted hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {status.type && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-brand-success' : 'bg-red-50 border-red-100 text-brand-danger'}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
            <button onClick={() => setStatus({type:null, message:''})} className="ml-auto opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Panel de Operaciones</h2>
                <p className="text-brand-muted text-[10px] font-bold uppercase tracking-[0.2em]">
                   Mostrando {filteredRows.length.toLocaleString()} referencias | {db.name}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                {getSourceIcon(db.source)}
                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">{getSourceLabel(db.source)}</span>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-brand-success/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                   <Percent className={`w-24 h-24 ${getReliabilityColor(metrics.reliability)}`} />
                </div>
                <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Confiabilidad Local</p>
                <p className={`text-5xl font-black tabular-nums tracking-tighter ${getReliabilityColor(metrics.reliability)}`}>
                  {metrics.reliability.toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Razón directa Contadas vs Novedades</p>
              </div>

              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-brand-danger/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                   <TrendingDown className="w-24 h-24 text-brand-danger" />
                </div>
                <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Faltantes</p>
                <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(metrics.negativeAdj)}</p>
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Costo total de stock negativo</p>
              </div>

              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-brand-primary/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                   <TrendingUp className="w-24 h-24 text-brand-primary" />
                </div>
                <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Ajuste General</p>
                <p className="text-3xl font-black text-brand-primary tabular-nums tracking-tight">{formatCOP(metrics.totalAdj)}</p>
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Balance total entre sobrantes y faltantes</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="px-10 py-10 border-b border-slate-50 bg-slate-50/30">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
                  <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-[0.25em] text-[10px]">
                    <Table className="w-5 h-5 text-brand-primary" />
                    Explorador Maestro
                  </h3>
                  <div className="relative w-full max-w-md group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Buscar en columnas visibles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-8 text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <MultiSelect label="Almacén" options={optAlmacen} value={selAlmacen} onChange={setSelAlmacen} />
                  <MultiSelect label="Familia" options={optFamilia} value={selFamilia} onChange={setSelFamilia} />
                  <MultiSelect label="Centro de costo" options={optCentro} value={selCentro} onChange={setSelCentro} />
                  
                  <button
                    onClick={() => setShowFecha(!showFecha)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-[11px] font-black uppercase tracking-tight transition-all ${
                      desde || hasta 
                        ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                        : 'bg-white border-slate-200 text-brand-muted hover:text-slate-900 hover:border-slate-400'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Fecha {(desde || hasta) ? '(Filtrado)' : ''}
                  </button>

                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-brand-danger hover:border-brand-danger/20 transition-all text-[11px] font-black uppercase tracking-tight ml-auto"
                  >
                    <X className="w-4 h-4" />
                    Limpiar Filtros
                  </button>
                </div>

                {showFecha && (
                  <div className="mt-8 p-8 bg-slate-50 rounded-[2rem] flex flex-wrap gap-10 animate-in slide-in-from-top-6 duration-400 border border-slate-100">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block ml-1">Rango Desde</label>
                      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block ml-1">Rango Hasta</label>
                      <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all" />
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      {visibleHeaders.map((h) => (
                        <th key={h} className="px-10 py-6 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors group">
                        {visibleHeaders.map((h) => (
                          <td key={h} className="px-10 py-5 text-[13px] text-brand-muted border-b border-slate-50 whitespace-nowrap group-hover:text-slate-900">
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={visibleHeaders.length} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center gap-6">
                            <FilterIcon className="w-16 h-16 text-slate-100" />
                            <p className="text-slate-400 italic text-sm font-medium">Búsqueda sin coincidencias en los criterios maestros.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>Visualizando {Math.min(filteredRows.length, 50)} de {filteredRows.length.toLocaleString()} resultados</span>
                <span className="flex items-center gap-2"><FilterIcon className="w-3.5 h-3.5 text-brand-primary" /> Auditoría Optimizada</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comparative' && (
          <ComparativoInventarios headers={db.headers} rows={db.rows} />
        )}

        {activeTab === 'analysis' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            {!analysis ? (
              <div className="bg-white border border-slate-100 rounded-[2.8rem] p-24 text-center shadow-2xl relative overflow-hidden">
                <div className="bg-indigo-50 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-10">
                  <Zap className="w-14 h-14 text-brand-primary" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">IA Predictiva Maestro</h2>
                <p className="text-brand-muted mb-12 max-w-sm mx-auto leading-relaxed font-medium">Gemini Pro analizará {db.rows.length.toLocaleString()} referencias para detectar fugas críticas y patrones de stock.</p>
                <button onClick={handleAnalyze} disabled={loading} className="bg-brand-primary hover:bg-[#0a355c] text-white font-black py-6 px-16 rounded-[2.5rem] flex items-center gap-4 mx-auto shadow-2xl shadow-brand-primary/20 active:scale-95 transition-all uppercase text-[11px] tracking-[0.2em]">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Generar Auditoría IA
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 uppercase tracking-widest text-[11px]"><Zap className="text-brand-primary w-6 h-6" /> Informe de Inteligencia</h2>
                  <button onClick={() => setAnalysis(null)} className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2 transition-colors">Nuevo Análisis</button>
                </div>
                <div className="bg-white border border-brand-primary/10 rounded-[3rem] p-16 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.05] pointer-events-none">
                     <Zap className="w-64 h-64 text-brand-primary" />
                  </div>
                  <p className="text-2xl text-slate-700 leading-relaxed italic border-l-8 border-brand-primary pl-14 mb-16 font-medium font-serif">"{analysis.summary}"</p>
                  <div className="grid lg:grid-cols-2 gap-16">
                    <div className="bg-slate-50 p-12 rounded-[2.5rem] border border-slate-100">
                      <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-10 flex items-center gap-3"><Search className="w-4 h-4"/> Hallazgos del Sistema</h4>
                      <ul className="space-y-8">
                        {analysis.insights.map((ins, i) => (
                          <li key={i} className="text-[15px] text-brand-muted flex gap-6 leading-relaxed"><span className="text-brand-primary font-black bg-white w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">{i+1}</span> {ins}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-brand-success/5 p-12 rounded-[2.5rem] border border-brand-success/10">
                      <h4 className="text-[10px] font-black text-brand-success uppercase tracking-widest mb-10 flex items-center gap-3"><CheckCircle2 className="w-4 h-4"/> Plan de Acción</h4>
                      <ul className="space-y-8">
                        {analysis.suggestedActions.map((action, i) => (
                          <li key={i} className="text-[15px] text-slate-700 flex gap-6 leading-relaxed"><CheckCircle2 className="w-7 h-7 text-brand-success shrink-0 mt-0.5" /> {action}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-6 duration-500">
            <div className="bg-white border border-slate-100 rounded-[3rem] p-16 shadow-2xl relative overflow-hidden">
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Motor de Gestión</h2>
              <p className="text-brand-muted text-sm mb-14 font-medium leading-relaxed">Administración del entorno LiquorHub y sincronización de nodos de datos locales.</p>
              <div className="space-y-10">
                <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-12 flex items-center justify-between shadow-inner group">
                  <div className="flex items-center gap-8">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 group-hover:scale-110 transition-transform shadow-sm">
                      <FileSpreadsheet className="w-11 h-11 text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 mb-2">{db.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Último Dump: {db.lastUpdated}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={triggerUpload} className="p-5 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-brand-muted hover:text-brand-primary transition-all shadow-sm" title="Cargar Nuevo"><RefreshCw className="w-6 h-6" /></button>
                    <button onClick={handleClearDb} className="p-5 bg-brand-danger/5 border border-brand-danger/10 hover:bg-brand-danger/20 rounded-2xl text-brand-danger transition-all shadow-sm" title="Eliminar"><Trash2 className="w-6 h-6" /></button>
                  </div>
                </div>
                
                <div className="p-12 bg-white border border-slate-100 rounded-[2.5rem] text-[10px] space-y-8 shadow-sm">
                   <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                      <span className="text-brand-muted uppercase font-black tracking-widest">Origen de Transmisión</span>
                      <span className="text-slate-600 font-mono bg-slate-50 px-5 py-2 rounded-xl border border-slate-100">{getSourceLabel(db.source)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                      <span className="text-brand-muted uppercase font-black tracking-widest">Ofuscación de Columnas</span>
                      <span className="text-amber-600 font-black bg-amber-50 px-5 py-2 rounded-xl border border-amber-100">{db.headers.length - visibleHeaders.length} Campos Protegidos</span>
                    </div>
                    <div>
                      <span className="text-brand-muted uppercase font-black tracking-widest block mb-6">Políticas de Ocultación Activas:</span>
                      <div className="flex flex-wrap gap-3">
                        {Array.from(HIDDEN).map(tag => (
                          <span key={tag} className="bg-slate-50 text-slate-400 px-5 py-2.5 rounded-xl text-[9px] font-black border border-slate-100 uppercase tracking-[0.1em]">{tag}</span>
                        ))}
                      </div>
                    </div>
                </div>
                <button onClick={triggerUpload} className="w-full bg-brand-primary hover:bg-[#0a355c] text-white font-black py-7 rounded-[2.5rem] flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-2xl shadow-brand-primary/20 uppercase tracking-[0.3em] text-[11px]">
                  <Upload className="w-6 h-6" />
                  Actualizar Maestro Local
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  return (
    <>
      {mainContent}
      
      {/* Global hidden file input for consistent uploads */}
      <input 
        ref={globalFileInputRef} 
        type="file" 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".xlsx, .xls, .csv" 
      />

      {loading && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-2xl z-[100] flex flex-col items-center justify-center">
          <div className="relative mb-12">
            <div className="w-32 h-32 border-b-4 border-brand-primary rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-brand-primary animate-pulse" />
          </div>
          <p className="text-brand-primary font-black tracking-[0.5em] animate-pulse text-[12px] uppercase">Procesando Inteligencia de Datos</p>
        </div>
      )}
    </>
  );
};

export default App;