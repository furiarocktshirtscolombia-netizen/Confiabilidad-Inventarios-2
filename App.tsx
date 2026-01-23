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
  Upload, 
  Settings as SettingsIcon,
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Zap,
  Trash2,
  HardDrive,
  ArrowRightLeft,
  X,
  Target
} from 'lucide-react';

const App: React.FC = () => {
  // Establecemos 'comparative' como la pestaña activa inicial
  const [activeTab, setActiveTab] = useState('comparative');
  const [db, setDb] = useState<LocalDatabase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  
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

  const handleAnalyze = async () => {
    if (!db || db.rows.length === 0) return;
    setLoading(true);
    try {
      // Tomamos una muestra representativa para el análisis de IA
      const sampleRows = db.rows.slice(0, 50);
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