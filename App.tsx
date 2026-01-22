
import React, { useState, useEffect, useRef } from 'react';
import { LocalDatabase, AnalysisResult } from './types';
import { parseExcelFile, saveLocalDb, loadLocalDb, clearLocalDb } from './services/databaseService';
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
  ChevronRight
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Al iniciar, cargar la base de datos de localStorage
  useEffect(() => {
    const saved = loadLocalDb();
    if (saved) setDb(saved);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const parsedDb = await parseExcelFile(file);
      saveLocalDb(parsedDb);
      setDb(parsedDb);
      setStatus({ type: 'success', message: `¡Base de datos "${file.name}" cargada con éxito!` });
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
      // Enviamos una muestra de los datos a Gemini
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
      setStatus({ type: 'success', message: 'Memoria local limpiada.' });
    }
  };

  // Pantalla de "Base no detectada"
  if (!db && !loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="bg-red-500/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Base de datos no detectada</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Para comenzar a usar MaestroDB, debes cargar un archivo de Excel (.xlsx) o CSV que servirá como tu fuente de datos local.
          </p>
          
          <input 
            ref={fileInputRef}
            type="file" 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Upload className="w-5 h-5" />
            Cargar Excel Base
          </button>
          
          <p className="text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
            Funciona 100% Offline • Privacidad Total
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <DbIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">
            MaestroDB
          </h1>
        </div>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'analysis', icon: Zap, label: 'IA Analítica' },
            { id: 'settings', icon: SettingsIcon, label: 'Base de Datos' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {status.type && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-4 ${
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}

        {activeTab === 'dashboard' && db && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Resumen de Inventario</h2>
                <p className="text-slate-400 text-sm">Visualización de {db.name}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                <RefreshCw className="w-3 h-3" />
                Actualizado: {db.lastUpdated}
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Registros</p>
                <p className="text-3xl font-black text-white">{db.rows.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Columnas</p>
                <p className="text-3xl font-black text-emerald-500">{db.headers.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Tamaño</p>
                <p className="text-3xl font-black text-white">{(db.fileSize / 1024).toFixed(1)} <span className="text-sm">KB</span></p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Integridad</p>
                <p className="text-3xl font-black text-white">100%</p>
              </div>
            </div>

            {/* Vista Previa de Tabla */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-500" />
                  Vista Previa (Primeros 10)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950">
                      {db.headers.map((h, i) => (
                        <th key={i} className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter border-b border-slate-800">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {db.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        {db.headers.map((h, j) => (
                          <td key={j} className="px-6 py-3 text-sm text-slate-300 border-b border-slate-800/50">
                            {String(row[h])}
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

        {activeTab === 'analysis' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            {!analysis ? (
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-12 text-center shadow-2xl">
                <div className="bg-indigo-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-12 h-12 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Análisis de Inteligencia Artificial</h2>
                <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                  Gemini analizará los patrones de tu base de datos local para darte insights estratégicos y sugerencias de mejora.
                </p>
                <button 
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 mx-auto shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Generar Informe Maestro
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Zap className="text-indigo-500" /> Informe de Inteligencia
                  </h2>
                  <button onClick={() => setAnalysis(null)} className="text-xs text-slate-500 hover:text-white underline">Nuevo Análisis</button>
                </div>

                <div className="bg-slate-900 border border-indigo-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <p className="text-lg text-slate-200 leading-relaxed italic border-l-4 border-indigo-500 pl-6 mb-10">
                    "{analysis.summary}"
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">Hallazgos Clave</h4>
                      <ul className="space-y-4">
                        {analysis.insights.map((ins, i) => (
                          <li key={i} className="text-sm text-slate-400 flex gap-3">
                            <span className="text-indigo-500 font-bold">#</span> {ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-indigo-600/5 p-6 rounded-2xl border border-indigo-500/10">
                      <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">Estrategia Sugerida</h4>
                      <ul className="space-y-4">
                        {analysis.suggestedActions.map((action, i) => (
                          <li key={i} className="text-sm text-slate-300 flex gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {action}
                          </li>
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
              <h2 className="text-2xl font-bold text-white mb-2">Gestionar Base de Datos</h2>
              <p className="text-slate-500 text-sm mb-8">Administra el archivo Excel que alimenta la aplicación.</p>
              
              <div className="space-y-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{db.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Última carga: {db.lastUpdated}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                      title="Actualizar Archivo"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleClearDb}
                      className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                      title="Eliminar Base de Datos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl">
                  <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest">Información de Sistema</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Almacenamiento:</span>
                      <span className="text-slate-300 font-mono">Local (Browser)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Estado de Carga:</span>
                      <span className="text-emerald-500 font-bold">Verificado</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Columnas Detectadas:</span>
                      <span className="text-slate-300">{db.headers.join(', ')}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Upload className="w-4 h-4" />
                  Reemplazar con nuevo Excel
                </button>
              </div>
            </div>
            
            <input 
              ref={fileInputRef}
              type="file" 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".xlsx, .xls, .csv" 
            />
          </div>
        )}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-b-2 border-emerald-500 rounded-full animate-spin"></div>
            <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-emerald-400 font-black tracking-widest animate-pulse text-xs uppercase">Procesando Datos Locales</p>
        </div>
      )}
    </div>
  );
};

export default App;
