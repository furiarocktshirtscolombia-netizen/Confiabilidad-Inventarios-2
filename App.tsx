
import React, { useState, useEffect, useRef } from 'react';
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
  FileCode
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicialización: Cache -> Public -> Manual
  useEffect(() => {
    const initDb = async () => {
      setLoading(true);
      
      // 1. Intentar desde Cache
      const cached = loadDbFromCache();
      if (cached) {
        setDb(cached);
        setLoading(false);
        return;
      }

      // 2. Intentar desde Public (BASE.xlsx)
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
      // Re-intentar carga pública después de borrar
      loadExcelFromPublic().then(res => {
        if (res) setDb(res);
      });
    }
  };

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

  // Pantalla de "Base no detectada"
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
          
          <input 
            ref={fileInputRef}
            type="file" 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-amber-600/20 active:scale-95"
          >
            <Upload className="w-5 h-5" />
            Cargar Excel Manualmente
          </button>
          
          <p className="text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
            LiquorHub Model