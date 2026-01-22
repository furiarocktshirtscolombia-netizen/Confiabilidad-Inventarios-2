
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
  Filter
} from 'lucide-react';

// --- Lógica de Normalización y Ocultación (Recomendada) ---
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .replace(/\s+/g, " ")           // Normaliza espacios múltiples
    .trim()
    .toUpperCase();

const HIDDEN = new Set([
  "SERIE",
  "CENTRO DE COSTOS",
  "CENTRO COSTOS",
  "SEDE",
  "ALMACEN",
  "ESTABLECIMIENTO",
  "TIENDA"
]);

const getVisibleHeaders = (headers: string[]) =>
  headers.filter((h) => !HIDDEN.has(norm(h)));
// ---------------------------------------------------------

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
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
      setStatus({ type: 'success', message: `¡Base de datos "${file.name}" cargada y guardada localmente!` });
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
      // Tomamos una muestra representativa para el análisis
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
    if (confirm("¿Estás seguro de eliminar la base de datos local? La app volverá a buscar el archivo base.")) {
      clearLocalDb();
      setDb(null);
      setAnalysis(null);
      setSearchTerm('');
      loadExcelFromPublic().then(res => {
        if (res) setDb(res);
      });
    }
  };

  // Filtrado de datos para el explorador
  const filteredRows = useMemo(() => {
    if (!db) return [];
    if (!searchTerm) return db.rows;
    const term = norm(searchTerm);
    return db.rows.filter(row => 
      Object.values(row).some(val => norm(String(val)).includes(term))
    );
  }, [db, searchTerm]);

  const getSourceIcon = (source: LocalDatabase['source']) => {
    switch (source) {
      case 'public': return <Cloud className="w-4 h-4 text-sky-400" />;
      case 'cache': return <HardDrive className="w-4 h-4 text-amber-400" />;
      case 'upload': return <FileCode className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getSourceLabel = (source: LocalDatabase['source']) => {
    switch (source) {
      case 'public': return 'Nube (Public)';
      case 'cache': return 'Caché Local';
      case 'upload': return 'Subida Manual';
    }
  };

  if (loading && !db) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
         <div className="relative mb-6">
            <div className="w-20 h-20 border-b-2 border-emerald-500 rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-emerald-400 font-black tracking-widest animate-pulse text-xs uppercase">Buscando Base de Datos...</p>
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
          <h1 className="text-2xl font-bold text-white mb-2">Base no detectada</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            No se encontró el archivo automático <span className="text-amber-500 font-mono">/{DB_FILE_NAME}</span>.
            Carga un archivo Excel manualmente para continuar.
          </p>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-600/20 active:scale-95">
            <Upload className="w-5 h-5" />
            Cargar Excel Manualmente
          </button>
          <p className="text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">LiquorHub Model</p>
        </div>
      </div>
    );
  }

  // Obtenemos los headers visibles justo antes del renderizado
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
          </div>
        )}

        {activeTab === 'dashboard' && db && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Dashboard Maestro</h2>
                <p className="text-slate-400 text-sm">Resumen de {db.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 uppercase tracking-widest">
                  {getSourceIcon(db.source)}
                  {getSourceLabel(db.source)}
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Registros</p>
                <p className="text-3xl font-black text-white">{db.rows.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Columnas Visibles</p>
                <p className="text-3xl font-black text-emerald-500">{visibleHeaders.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Memoria</p>
                <p className="text-3xl font-black text-white">{(db.fileSize / 1024).toFixed(1)} <span className="text-sm uppercase font-bold text-slate-600">KB</span></p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Estado</p>
                <p className="text-3xl font-black text-white">OK</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50">
                <h3 className="font-bold text-white flex items-center gap-2 shrink-0">
                  <Table className="w-4 h-4 text-emerald-500" />
                  Explorador de Datos
                </h3>
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Filtrar datos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950">
                      {visibleHeaders.map((h) => (
                        <th key={h} className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter border-b border-slate-800 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                        {visibleHeaders.map((h) => (
                          <td key={h} className="px-6 py-3 text-sm text-slate-300 border-b border-slate-800/50 whitespace-nowrap">
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={visibleHeaders.length} className="px-6 py-10 text-center text-slate-500 italic">
                          No se encontraron resultados para "{searchTerm}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 bg-slate-950/50 border-t border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                <span>Mostrando {Math.min(filteredRows.length, 20)} de {filteredRows.length} registros</span>
                {filteredRows.length > 20 && <span>Desliza para ver más</span>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            {!analysis ? (
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-12 text-center shadow-2xl">
                <div className="bg-indigo-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-12 h-12 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Análisis Estratégico IA</h2>
                <p className="text-slate-400 mb-8 max-w-sm mx-auto">Gemini analizará los patrones de tu base local para ofrecerte perspectivas de negocio en segundos.</p>
                <button onClick={handleAnalyze} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 mx-auto shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Generar Informe Maestro
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Zap className="text-indigo-500" /> Inteligencia MaestroDB</h2>
                  <button onClick={() => setAnalysis(null)} className="text-xs text-slate-500 hover:text-white underline">Nuevo Análisis</button>
                </div>
                <div className="bg-slate-900 border border-indigo-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                  <p className="text-lg text-slate-200 leading-relaxed italic border-l-4 border-indigo-500 pl-6 mb-10">"{analysis.summary}"</p>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">Hallazgos Clave</h4>
                      <ul className="space-y-4">
                        {analysis.insights.map((ins, i) => (
                          <li key={i} className="text-sm text-slate-400 flex gap-3"><span className="text-indigo-500 font-bold">#</span> {ins}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-indigo-600/5 p-6 rounded-2xl border border-indigo-500/10">
                      <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">Recomendaciones</h4>
                      <ul className="space-y-4">
                        {analysis.suggestedActions.map((action, i) => (
                          <li key={i} className="text-sm text-slate-300 flex gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {action}</li>
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
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-2">Gestión de Datos</h2>
              <p className="text-slate-500 text-sm mb-8">Administra el origen y la visibilidad de tu base de datos.</p>
              <div className="space-y-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{db.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Sincronizado: {db.lastUpdated}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all" title="Cargar Nuevo"><RefreshCw className="w-4 h-4" /></button>
                    <button onClick={handleClearDb} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-3">
                   <div className="flex justify-between">
                      <span className="text-slate-500 uppercase font-bold tracking-widest">Origen:</span>
                      <span className="text-slate-300 font-mono">{getSourceLabel(db.source)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 uppercase font-bold tracking-widest">Columnas Ocultas:</span>
                      <span className="text-amber-500 font-bold">{db.headers.length - visibleHeaders.length} detectadas</span>
                    </div>
                    <div className="pt-2">
                      <span className="text-slate-500 uppercase font-bold tracking-widest block mb-2">Filtros Activos (Hiding):</span>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(HIDDEN).map(tag => (
                          <span key={tag} className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-[10px]">{tag}</span>
                        ))}
                      </div>
                    </div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                  <Upload className="w-4 h-4" />
                  Actualizar con Nuevo Excel
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-b-2 border-emerald-500 rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-emerald-400 font-black tracking-widest animate-pulse text-xs uppercase tracking-tighter">Procesando Base de Datos</p>
        </div>
      )}
    </div>
  );
};

export default App;
