import { Cpu, PlusCircle, MessageSquare, Database, Layers, CheckSquare, Square, Trash2, Loader2, X, LogOut, User, FolderArchive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Sidebar = ({
  sessions,
  currentSessionId,
  files,
  selectedFiles,
  processingFiles,
  sidebarOpen,
  setSidebarOpen,
  createNewChat,
  selectSession,
  deleteSession,
  toggleFile,
  setSelectedFiles,
  deleteFile,
  handleLogout,
  userEmail
}) => {
  const sidebarContentJSX = (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-3xl border-r border-white/5 relative shadow-2xl">
      <div className="p-6 flex justify-between items-center z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-accent to-indigo-600 p-2.5 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Cpu size={22} className="text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">DocMind</h1>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div className="px-5 pb-5 z-10 relative">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={createNewChat} 
          className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent-hover p-3 rounded-xl transition-all text-sm font-semibold shadow-sm"
        >
          <PlusCircle size={18} /> New Session
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 custom-scrollbar space-y-8 pb-6 z-10 relative">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3 px-1 flex items-center gap-2">
            <MessageSquare size={13}/> Recent Chats
          </p>
          <div className="space-y-1">
            {sessions.map(s => (
              <div key={s.id} onClick={() => selectSession(s.id)} className={`w-full group cursor-pointer flex justify-between items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${currentSessionId === s.id ? 'bg-accent text-white shadow-md shadow-accent/20' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}>
                <span className="truncate pr-2 font-medium">{s.title}</span>
                <button onClick={(e) => deleteSession(s.id, e)} className={`text-slate-500 opacity-0 group-hover:opacity-100 hover:!text-red-400 transition-all ${currentSessionId === s.id ? 'text-white/60 hover:!text-white' : ''}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3 px-1 flex items-center gap-2">
            <Database size={13}/> Knowledge Base
          </p>
          <div className="space-y-1.5">
            <button onClick={() => setSelectedFiles([])} className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all flex items-center gap-3 border ${selectedFiles.length === 0 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 font-semibold shadow-sm' : 'border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}>
              <Layers size={18} className={selectedFiles.length === 0 ? 'text-indigo-400' : ''}/> 
              <span>Global Context</span>
            </button>
            
            <div className="mt-3 space-y-1">
              {files.map(f => {
                const isSelected = selectedFiles.includes(f);
                const proc = processingFiles[f];
                return (
                  <div key={f} className={`group rounded-xl transition-all cursor-pointer border ${isSelected ? 'bg-accent/5 border-accent/20' : 'border-transparent hover:bg-white/5'}`} onClick={() => toggleFile(f)}>
                    <div className="flex justify-between items-center px-3 py-2.5">
                      <div className={`flex items-center gap-3 text-sm min-w-0 ${isSelected ? 'text-accent-hover font-medium' : 'text-slate-400'}`}>
                        {isSelected ? <CheckSquare size={16} className="text-accent shrink-0" /> : <Square size={16} className="opacity-40 shrink-0" />}
                        <span className="truncate">{f}</span>
                      </div>
                      {proc && proc.stage !== 'error' && proc.stage !== 'complete' ? (
                        <Loader2 size={15} className="text-accent animate-spin shrink-0" />
                      ) : (
                        <button onClick={(e) => deleteFile(f, e)} className="text-slate-500 opacity-0 group-hover:opacity-100 hover:!text-red-400 transition-all">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    {proc && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              proc.stage === 'complete' ? 'bg-green-500' : proc.stage === 'error' ? 'bg-red-500' : 'bg-accent'
                            }`}
                            style={{ width: `${proc.progress}%` }}
                          />
                        </div>
                        <p className={`text-[10px] font-medium truncate ${
                          proc.stage === 'complete' ? 'text-green-400' : proc.stage === 'error' ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          {proc.message}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-5 border-t border-white/5 bg-white/[0.01] z-10 relative">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-slate-500 flex items-center justify-center shrink-0 shadow-sm">
            <User size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Account</p>
            <p className="text-xs text-slate-200 font-medium truncate">{userEmail}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold border border-transparent hover:border-white/10">
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed top-0 left-0 h-full w-[290px] z-50 lg:hidden"
            >
              {sidebarContentJSX}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden lg:block w-[290px] h-full shrink-0 z-40">
        {sidebarContentJSX}
      </aside>
    </>
  );
};
