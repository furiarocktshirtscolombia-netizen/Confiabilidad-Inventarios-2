
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LocalDatabase, AnalysisResult } from './types';
import { 
  parseUploadedFile, 
  loadDbFromCache, 
  clearLocalDb
} from './services/databaseService';
import { analyzeData } from './services/geminiService';
import ComparativoInventarios from './components/ComparativoInventarios';
import Button from './components/Button';
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
const HIDDEN_KEYWORDS = [
  "COSTE LINEA",
  "COSTE LANEA",
  "COSTELANEA",
  "COSTO LINEA",
  "COSTO TOTAL",
  "COSTO AJUSTE",
  "COSTO UNITARIO",
  "COSTO_UNITARIO",
  "SERIE",
  "CENTRO DE COSTOS",
  "CENTRO COSTOS",
  "SEDE",
  "ALMACEN",
  "ESTABLECIMIENTO",
  "TIENDA",
  "FECHA",
  "FAMILIA",
  "GRUPO",
  "MARCA",
  "SUB-FAMILIA"
];

const getVisibleHeaders = (headers: string[]) => {
  const visible = headers.filter((h) => {
    const normalizedHeader = norm(h);
    const shouldHide = HIDDEN_KEYWORDS.some(keyword => normalizedHeader.includes(keyword));
    return !shouldHide;
  });

  const priority = ["ARTICULO", "ARTÍCULO", "SUBARTICULO", "SUBARTÍCULO"];
  return visible.sort((a, b) => {
    const normA = norm(a);
    const normB = norm(b);
    const idxA = priority.indexOf(normA);
    const idxB = priority.indexOf(normB);
    
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });
};

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const getSourceIcon = (source: LocalDatabase['source']) => {
  switch (source) {
    case 'public': return <Cloud size={16} className="text-brand-success" />;
    case 'upload': return <Upload size={16} className="text-amber-600" />;
    case 'cache': return <HardDrive size={16} className="text-sky-600" />;
    default: return <DbIcon size={16} className="text-slate-400" />;
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
  
  const [selAlmacen, setSelAlmacen] = useState<string[]>([]);
  const [selFamilia, setSelFamilia] = useState<string[]>([]);
  const [selCentro, setSelCentro] = useState<string[]>([]);
  const [showFecha, setShowFecha] = useState(false);
  const [desde, setDesde] = useState<string>(""); 
  const [hasta, setHasta] = useState<string>(""); 

  const globalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initDb = () => {
      setLoading(true);
      const cached = loadDbFromCache();
      if (cached) {
        setDb(cached);
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
      setStatus({ type: 'success', message: `¡Archivo "${file.name}" cargado con éxito!` });
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
    if (confirm("¿Deseas eliminar los datos cargados y volver a la pantalla de inicio?")) {
      clearLocalDb();
      setDb(null);
      setAnalysis(null);
      handleResetFilters();
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

  const cols = useMemo(() => {
    if (!db) return {};
    return {
      almacen: findHeader(db.headers, ["ALMACEN", "ALMACÉN", "SEDE", "LOCAL", "TIENDA"]),
      familia: findHeader(db.headers, ["FAMILIA"]),
      articulo: findHeader(db.headers, ["ARTICULO", "ARTÍCULO"]),
      subarticulo: findHeader(db.headers, ["SUBARTICULO", "SUBARTÍCULO", "UNIDAD"]),
      centro: findHeader(db.headers, ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"]),
      fecha: findHeader(db.headers, ["FECHA", "DATE"]),
      costAdj: findHeader(db.headers, ["COSTO AJUSTE", "DIFERENCIA COSTO", "VARIACION STOCK"]),
      stock: findHeader(db.headers, ["STOCK A FECHA", "STOCK", "STOCK INVENTARIO"]),
      costLine: findHeader(db.headers, ["COSTE LINEA", "COSTE LANEA", "COSTELANEA", "COSTO LINEA", "COSTO TOTAL"])
    };
  }, [db]);

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

  const metrics = useMemo(() => {
    if (!db || filteredRows.length === 0) return { reliability: 0, negativeAdj: 0, totalAdj: 0 };
    
    const uniqueItemsSet = new Set<string>();
    const noveltyItemsSet = new Set<string>();
    let negSum = 0; 
    let totalSum = 0;
    
    filteredRows.forEach(row => {
      const art = String(row[cols.articulo || ""] ?? "").trim().toUpperCase();
      const sub = String(row[cols.subarticulo || ""] ?? "").trim().toUpperCase();
      const key = `${art}__${sub}`;
      uniqueItemsSet.add(key);

      const adjVal = parseFloat(String(row[cols.costAdj || ""]).replace(/[^0-9.-]+/g, "")) || 0;
      totalSum += adjVal;
      
      if (adjVal !== 0) {
        noveltyItemsSet.add(key);
      }
      
      if (cols.stock) {
        const stockVal = parseFloat(String(row[cols.stock]).replace(/[^0-9.-]+/g, "")) || 0;
        if (stockVal < 0) {
          const costVal = cols.costLine ? parseFloat(String(row[cols.costLine]).replace(/[^0-9.-]+/g, "")) || 0 : 0;
          negSum += costVal;
        }
      }
    });

    const totalContadas = uniqueItemsSet.size;
    const totalNovedades = noveltyItemsSet.size;
    
    let reliabilityRaw = 0;
    if (totalContadas > 0) {
      reliabilityRaw = (1 - (totalNovedades / totalContadas)) * 100;
    } else {
      reliabilityRaw = 100; 
    }
      
    return { 
      reliability: Math.max(0, Math.min(100, reliabilityRaw)), 
      negativeAdj: negSum, 
      totalAdj: totalSum 
    };
  }, [filteredRows, cols]);

  const visibleHeaders = useMemo(() => getVisibleHeaders(db ? db.headers : []), [db]);

  const getReliabilityColor = (val: number) => {
    if (val >= 95) return 'text-brand-success';
    if (val >= 90) return 'text-amber-500';
    return 'text-brand-danger';
  };

  const mainAppUI = db ? (
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
                   Mostrando {filteredRows.length.toLocaleString()} registros | {db.name}
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
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Precisión real (Items sin novedad / Total)</p>
              </div>

              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-brand-danger/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                   <TrendingDown className="w-24 h-24 text-brand-danger" />
                </div>
                <p className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">Impacto Faltantes</p>
                <p className="text-3xl font-black text-brand-danger tabular-nums tracking-tight">{formatCOP(metrics.negativeAdj)}</p>
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">Costo total de stock negativo detectado</p>
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
                      placeholder="Buscar por artículo o unidad..."
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
                  <Button variant={desde || hasta ? "primary" : "secondary"} size="sm" onClick={() => setShowFecha(!showFecha)} leftIcon={<Calendar size={14} />} className="uppercase tracking-tight text-[10px]">Fecha</Button>
                  <Button variant="ghost" size="sm" onClick={handleResetFilters} leftIcon={<X size={14} />} className="ml-auto uppercase tracking-tight text-[10px]">Limpiar</Button>
                </div>

                {showFecha && (
                  <div className="mt-8 p-8 bg-slate-50 rounded-[2rem] flex flex-wrap gap-10 animate-in slide-in-from-top-6 duration-400 border border-slate-100">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block ml-1">Desde</label>
                      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block ml-1">Hasta</label>
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
                    {filteredRows.slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors group">
                        {visibleHeaders.map((h) => (
                          <td key={h} className="px-10 py-5 text-[13px] text-brand-muted border-b border-slate-50 whitespace-nowrap group-hover:text-slate-900">
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <Zap className="w-20 h-20 text-brand-primary mx-auto mb-10" />
                <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">IA Analítica Maestro</h2>
                <p className="text-brand-muted mb-12 max-w-sm mx-auto">Gemini Pro analizará {db.rows.length.toLocaleString()} referencias para detectar anomalías críticas.</p>
                <Button variant="primary" size="lg" className="mx-auto" leftIcon={loading ? <RefreshCw className="animate-spin" /> : <Zap />} onClick={handleAnalyze} disabled={loading}>Generar Reporte IA</Button>
              </div>
            ) : (
              <div className="bg-white border border-brand-primary/10 rounded-[3rem] p-16 shadow-2xl">
                 <h2 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-4"><Zap className="text-brand-primary" /> Resumen Estratégico</h2>
                 <p className="text-xl text-slate-700 leading-relaxed italic border-l-8 border-brand-primary pl-8 mb-12 font-serif">"{analysis.summary}"</p>
                 <div className="grid lg:grid-cols-2 gap-12">
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Hallazgos Clave</h4>
                      {analysis.insights.map((ins, i) => (
                        <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm font-medium text-slate-600 flex gap-4">
                          <span className="text-brand-primary font-black">0{i+1}</span> {ins}
                        </div>
                      ))}
                   </div>
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-brand-muted uppercase tracking-widest">Plan de Acción</h4>
                      {analysis.suggestedActions.map((action, i) => (
                        <div key={i} className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-sm font-medium text-emerald-800 flex gap-4">
                          <CheckCircle2 className="w-5 h-5 shrink-0" /> {action}
                        </div>
                      ))}
                   </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-6 duration-500">
            <div className="bg-white border border-slate-100 rounded-[3rem] p-16 shadow-2xl text-center">
              <HardDrive className="w-16 h-16 text-slate-300 mx-auto mb-8" />
              <h2 className="text-2xl font-black text-slate-900 mb-4">{db.name}</h2>
              <p className="text-brand-muted mb-12 uppercase tracking-widest text-[10px] font-black">Actualizado: {db.lastUpdated}</p>
              <div className="flex gap-4 justify-center">
                <Button variant="secondary" onClick={triggerUpload} leftIcon={<RefreshCw size={18} />}>Cambiar Archivo</Button>
                <Button variant="danger" onClick={handleClearDb} leftIcon={<Trash2 size={18} />}>Borrar Caché</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  ) : (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white border border-slate-200 p-12 rounded-[3rem] max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="bg-brand-primary/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Upload className="w-10 h-10 text-brand-primary" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Bienvenido a MaestroDB</h1>
        <p className="text-brand-muted text-sm mb-10 leading-relaxed font-medium">
          Carga tu inventario para iniciar la auditoría de confiabilidad y análisis con IA.
          No requerimos un archivo fijo; cualquier Excel con Artículo y Stock es compatible.
        </p>
        <Button 
          variant="primary" 
          size="lg" 
          className="w-full h-16 text-lg shadow-xl shadow-brand-primary/20" 
          leftIcon={<Upload size={22} />}
          onClick={triggerUpload}
        >
          Seleccionar Excel o CSV
        </Button>
        <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center gap-6">
           <div className="flex items-center gap-2 opacity-40">
              <CheckCircle2 size={14} className="text-brand-success" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Seguro</span>
           </div>
           <div className="flex items-center gap-2 opacity-40">
              <CheckCircle2 size={14} className="text-brand-success" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Local</span>
           </div>
           <div className="flex items-center gap-2 opacity-40">
              <CheckCircle2 size={14} className="text-brand-success" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Preciso</span>
           </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-10 uppercase tracking-widest font-black flex items-center gap-2">
        <DbIcon size={12} /> LiquorHub Data Engine
      </p>
    </div>
  );

  return (
    <>
      {mainAppUI}
      <input ref={globalFileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-brand-primary font-black uppercase tracking-[0.3em] text-[10px]">Cargando Datos Maestro...</p>
        </div>
      )}
    </>
  );
};

export default App;
