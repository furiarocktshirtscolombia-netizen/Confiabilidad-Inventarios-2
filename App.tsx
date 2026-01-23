import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LocalDatabase, AnalysisResult } from './types';
import { 
  parseUploadedFile, 
  loadDbFromCache, 
  clearLocalDb
} from './services/databaseService';
import { analyzeData } from './services/geminiService';
import { buildAuditoriaMetrics } from './services/auditoriaMetrics';
import ComparativoInventarios from './components/ComparativoInventarios';
import AuditSummaryGauges from './components/AuditSummaryGauges';
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
  Table,
  Trash2,
  Search,
  HardDrive,
  Calendar,
  ChevronDown,
  X,
  ArrowRightLeft,
  Filter,
  Target
} from 'lucide-react';

// --- UTILIDADES ROBUSTAS DE AUDITORÍA ---

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

const getRiskLevel = (impacto: number) => {
  const x = Math.abs(impacto);
  if (x >= 500000) return { label: "ALTO", color: "text-brand-danger bg-red-50 border-red-100" };
  if (x >= 100000) return { label: "MEDIO", color: "text-amber-600 bg-amber-50 border-amber-100" };
  if (x > 0) return { label: "BAJO", color: "text-sky-600 bg-sky-50 border-sky-100" };
  return { label: "OK", color: "text-slate-400 bg-slate-50 border-slate-100" };
};

const HIDDEN_KEYWORDS = [
  "COSTE", "COSTO", "COSTELANEA", "SERIE", "CENTRO DE COSTOS", "CENTRO COSTOS",
  "SEDE", "ALMACEN", "ESTABLECIMIENTO", "TIENDA", "FECHA", "FAMILIA", "GRUPO",
  "MARCA", "SUB-FAMILIA", "COBRO", "ESTADO", "AJUSTE"
];

const getVisibleHeaders = (headers: string[]) => {
  const visible = headers.filter((h) => {
    const normalizedHeader = normKey(h);
    const shouldHide = HIDDEN_KEYWORDS.some(keyword => normalizedHeader.includes(normKey(keyword)));
    return !shouldHide;
  });

  const priority = ["ARTICULO", "SUBARTICULO"];
  const sorted = visible.sort((a, b) => {
    const idxA = priority.findIndex(p => normKey(a).includes(normKey(p)));
    const idxB = priority.findIndex(p => normKey(b).includes(normKey(p)));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  return ["RIESGO", ...sorted, "IMPACTO ($)"];
};

const formatCOP = (val: number) => 
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const dateToExcelSerial = (d: Date) => {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utc / 86400000) + 25569;
};

const MultiSelect: React.FC<{
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  icon?: React.ReactNode;
}> = ({ label, options, value, onChange, icon }) => {
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
  const [selStatus, setSelStatus] = useState<string[]>([]);
  const [desde, setDesde] = useState<string>(""); 
  const [hasta, setHasta] = useState<string>(""); 

  const globalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initDb = () => {
      setLoading(true);
      const cached = loadDbFromCache();
      if (cached) setDb(cached);
      setLoading(false);
    };
    initDb();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
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

  const triggerUpload = () => globalFileInputRef.current?.click();

  const aliases = {
    almacen: ["ALMACEN", "ALMACÉN", "SEDE", "LOCAL", "TIENDA"],
    familia: ["FAMILIA"],
    articulo: ["ARTICULO", "ARTÍCULO"],
    centro: ["CENTRO DE COSTOS", "CENTRO COSTOS", "CENTRO_DE_COSTOS"],
    fecha: ["FECHA", "DATE"],
    // Alias para el costo unitario (Costo de Línea según usuario)
    costLine: ["COSTE LINEA", "COSTO LINEA", "COSTE LANEA", "COSTELANEA", "COSTO UNITARIO", "COSTE UNITARIO", "COSTO UNIT", "COSTE UNIT", "VALOR UNITARIO", "PRECIO UNITARIO"],
    stockSistema: ["STOCK A FECHA", "STOCK_A_FECHA"],
    stockConteo: ["STOCK INVENTARIO", "STOCK INVENTARIADO", "STOCK_INVENTARIO"]
  };

  const processedRows = useMemo(() => {
    if (!db) return [];
    return db.rows.map(row => {
      const sis = toNumber(getByAliases(row, aliases.stockSistema));
      const con = toNumber(getByAliases(row, aliases.stockConteo));
      const unitCost = toNumber(getByAliases(row, aliases.costLine));
      const diff = con - sis;
      
      // Impacto = Variación (diff) * Costo de línea (unitCost)
      const impacto = diff * unitCost;

      const sede = String(getByAliases(row, aliases.almacen) || "").trim();
      const centro = String(getByAliases(row, aliases.centro) || "").trim();
      const familia = String(getByAliases(row, aliases.familia) || "").trim();
      const rawDate = Number(getByAliases(row, aliases.fecha));

      return {
        ...row,
        sis, con, diff, impacto, sede, centro, familia, rawDate, unitCost
      };
    });
  }, [db]);

  const filteredRows = useMemo(() => {
    const d1 = desde ? dateToExcelSerial(new Date(desde + "T00:00:00")) : null;
    const d2 = hasta ? dateToExcelSerial(new Date(hasta + "T23:59:59")) : null;
    const term = normKey(searchTerm);
    
    return processedRows.filter(r => {
      if (term && !Object.values(r).some(val => normKey(String(val)).includes(term))) return false;
      if (selAlmacen.length && !selAlmacen.includes(r.sede)) return false;
      if (selFamilia.length && !selFamilia.includes(r.familia)) return false;
      if (selCentro.length && !selCentro.includes(r.centro)) return false;
      
      const novedad = r.diff === 0 ? "SIN NOVEDAD" : (r.diff < 0 ? "FALTANTE" : "SOBRANTE");
      if (selStatus.length && !selStatus.includes(novedad)) return false;

      if (Number.isFinite(r.rawDate)) {
        if (d1 !== null && r.rawDate < d1) return false;
        if (d2 !== null && r.rawDate > d2) return false;
      }
      return true;
    }).sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto));
  }, [processedRows, selAlmacen, selFamilia, selCentro, selStatus, desde, hasta, searchTerm]);

  const auditoriaMetrics = useMemo(() => buildAuditoriaMetrics(filteredRows), [filteredRows]);

  const visibleHeaders = useMemo(() => getVisibleHeaders(db ? db.headers : []), [db]);

  const handleAnalyze = async () => {
    if (!db || db.rows.length === 0) return;
    setLoading(true);
    try {
      const sampleRows = filteredRows.slice(0, 50);
      const csvHeader = db.headers.join('|');
      const csvBody = sampleRows.map(row => db.headers.map(h => String(row[h] ?? "")).join('|')).join('\n');
      const dataContent = `Headers: ${csvHeader}\nSample Data:\n${csvBody}`;
      const result = await analyzeData(dataContent);
      setAnalysis(result);
      setStatus({ type: 'success', message: 'Análisis de IA generado correctamente.' });
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setStatus({ type: 'error', message: 'Hubo un problema al generar el reporte de IA.' });
    } finally {
      setLoading(false);
    }
  };

  const mainAppUI = db ? (
    <div className="min-h-screen bg-brand-bg text-slate-900 selection:bg-brand-primary/5">
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-brand-primary/20">
            <DbIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-brand-primary to-brand-primary bg-clip-text text-transparent uppercase">MaestroDB</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Resumen' },
            { id: 'comparative', icon: ArrowRightLeft, label: 'Comparativo' },
            { id: 'analysis', icon: Zap, label: 'IA Analítica' },
            { id: 'settings', icon: SettingsIcon, label: 'Gestión' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-muted hover:text-slate-900 hover:bg-slate-200'}`}>
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            {/* KPI Section with Tacometers */}
            <AuditSummaryGauges metrics={auditoriaMetrics} />

            <div className="bg-white border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="px-10 py-10 border-b border-slate-50 bg-slate-50/30">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
                  <h3 className="font-black text-slate-900 flex items-center gap-3 uppercase tracking-[0.25em] text-[10px]">
                    <Table className="w-5 h-5 text-brand-primary" /> Explorador de Auditoría (Filtro Activo)
                  </h3>
                  <div className="relative w-full max-w-md group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                    <input type="text" placeholder="Buscar por artículo o unidad..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-8 text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Filtro de Fecha */}
                  <div className="flex items-center gap-2 bg-slate-100/50 rounded-xl px-4 py-1.5 border border-slate-200">
                    <Calendar size={14} className="text-brand-primary" />
                    <input 
                      type="date" 
                      value={desde} 
                      onChange={e => setDesde(e.target.value)} 
                      className="bg-transparent text-[10px] font-bold outline-none uppercase text-slate-600 focus:text-brand-primary transition-colors"
                    />
                    <span className="text-slate-300 mx-1 font-bold">→</span>
                    <input 
                      type="date" 
                      value={hasta} 
                      onChange={e => setHasta(e.target.value)} 
                      className="bg-transparent text-[10px] font-bold outline-none uppercase text-slate-600 focus:text-brand-primary transition-colors"
                    />
                  </div>

                  <MultiSelect label="Almacén" options={Array.from(new Set(processedRows.map(r => r.sede))).filter(Boolean).sort()} value={selAlmacen} onChange={setSelAlmacen} />
                  <MultiSelect label="Centro" options={Array.from(new Set(processedRows.map(r => r.centro))).filter(Boolean).sort()} value={selCentro} onChange={setSelCentro} />
                  <MultiSelect label="Familia" options={Array.from(new Set(processedRows.map(r => r.familia))).filter(Boolean).sort()} value={selFamilia} onChange={setSelFamilia} />
                  <MultiSelect label="Estado" options={["SIN NOVEDAD", "FALTANTE", "SOBRANTE"]} value={selStatus} onChange={setSelStatus} icon={<Filter size={14} />} />
                  <Button variant="ghost" size="sm" onClick={() => { setSelAlmacen([]); setSelCentro([]); setSelFamilia([]); setSelStatus([]); setSearchTerm(""); setDesde(""); setHasta(""); }} leftIcon={<X size={14} />} className="ml-auto uppercase tracking-tight text-[10px]">Limpiar</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      {visibleHeaders.map((h) => <th key={h} className="px-10 py-6 text-[10px] font-black text-brand-muted uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 100).map((row, i) => {
                      const risk = getRiskLevel(row.impacto);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                          {visibleHeaders.map((h) => {
                            if (h === "RIESGO") {
                              return (
                                <td key={h} className="px-10 py-5 border-b border-slate-50">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border tracking-widest ${risk.color}`}>
                                    {risk.label}
                                  </span>
                                </td>
                              );
                            }
                            if (h === "IMPACTO ($)") {
                                return (
                                  <td key={h} className={`px-10 py-5 text-[13px] font-bold border-b border-slate-50 whitespace-nowrap ${row.impacto < 0 ? 'text-brand-danger' : row.impacto > 0 ? 'text-brand-success' : 'text-slate-400'}`}>
                                    {formatCOP(row.impacto)}
                                  </td>
                                );
                            }
                            return (
                              <td key={h} className="px-10 py-5 text-[13px] text-brand-muted border-b border-slate-50 whitespace-nowrap group-hover:text-slate-900">
                                {String(row[h] ?? "")}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'comparative' && <ComparativoInventarios headers={db.headers} rows={db.rows} />}
        {activeTab === 'analysis' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {!analysis ? (
              <div className="bg-white border border-slate-100 rounded-[2.8rem] p-24 text-center shadow-2xl relative overflow-hidden">
                <Zap className="w-20 h-20 text-brand-primary mx-auto mb-10" />
                <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">IA Analítica Maestro</h2>
                <Button variant="primary" size="lg" className="mx-auto" leftIcon={loading ? <RefreshCw className="animate-spin" /> : <Zap />} onClick={handleAnalyze} disabled={loading}>Generar Reporte IA</Button>
              </div>
            ) : (
              <div className="bg-white border border-brand-primary/10 rounded-[3rem] p-16 shadow-2xl">
                 <h2 className="text-2xl font-black text-slate-900 mb-10 flex items-center gap-4"><Zap className="text-brand-primary" /> Resumen Estratégico</h2>
                 <p className="text-xl text-slate-700 leading-relaxed italic border-l-8 border-brand-primary pl-8 font-serif">"{analysis.summary}"</p>
                 <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Principales Hallazgos</h4>
                      <ul className="space-y-3">
                        {analysis.insights.map((insight, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <CheckCircle2 size={16} className="text-brand-primary shrink-0 mt-0.5" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Acciones Sugeridas</h4>
                      <ul className="space-y-3">
                        {analysis.suggestedActions.map((action, idx) => (
                          <li key={idx} className="flex gap-3 text-sm text-slate-600 bg-brand-primary/5 p-4 rounded-2xl border border-brand-primary/10">
                            <Target size={16} className="text-brand-primary shrink-0 mt-0.5" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                 </div>
                 <div className="mt-12 flex justify-center">
                    <Button variant="secondary" size="sm" onClick={() => setAnalysis(null)} leftIcon={<RefreshCw size={14} />}>Recalcular con IA</Button>
                 </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white border border-slate-100 rounded-[3rem] p-16 shadow-2xl text-center">
              <HardDrive className="w-16 h-16 text-slate-300 mx-auto mb-8" />
              <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase">{db.name}</h2>
              <div className="flex gap-4 justify-center">
                <Button variant="secondary" onClick={triggerUpload} leftIcon={<RefreshCw size={18} />}>Cambiar Archivo</Button>
                <Button variant="danger" onClick={() => { if(confirm("¿Borrar?")) { clearLocalDb(); setDb(null); } }} leftIcon={<Trash2 size={18} />}>Borrar Caché</Button>
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
        <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter uppercase">MaestroDB</h1>
        <p className="text-brand-muted text-sm mb-10 leading-relaxed font-medium">Carga tu inventario para iniciar el control de confiabilidad física y financiera.</p>
        <Button variant="primary" size="lg" className="w-full h-16 text-lg shadow-xl shadow-brand-primary/20 uppercase" leftIcon={<Upload size={22} />} onClick={triggerUpload}>Seleccionar Archivo</Button>
      </div>
    </div>
  );

  return (
    <>
      {mainAppUI}
      <input ref={globalFileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-brand-primary font-black uppercase tracking-[0.3em] text-[10px]">Procesando Auditoría...</p>
        </div>
      )}
      {status.type && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[110] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${status.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
           {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
           <span className="text-xs font-bold">{status.message}</span>
           <button onClick={() => setStatus({ type: null, message: '' })} className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X size={14} />
           </button>
        </div>
      )}
    </>
  );
};

export default App;