import React from 'react';
import { Cpu, PlusCircle, MessageSquare, Database, Layers, CheckSquare, Square, Trash2, Loader2, X } from 'lucide-react';
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
  deleteFile
}) => {
  const SidebarContent = () => (
    <>
      <div className="p-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 border border-blue-500/30 p-2 rounded-xl">
            <Cpu size={20} className="text-blue-400" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-slate-100">DocMind</h1>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-100 transition-colors p-1">
          <X size={20} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <button onClick={createNewChat} className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-all text-sm font-medium shadow-sm">
          <PlusCircle size={18} className="text-slate-400" /> New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-8 pb-6">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 px-2 flex items-center gap-2">
            <MessageSquare size={12}/> Recent Chats
          </p>
          <div className="space-y-0.5">
            {sessions.map(s => (
              <div key={s.id} onClick={() => selectSession(s.id)} className={`w-full group cursor-pointer flex justify-between items-center px-3 py-2.5 rounded-lg text-sm transition-all ${currentSessionId === s.id ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-white/5 text-slate-400'}`}>
                <span className="truncate pr-2">{s.title}</span>
                <button onClick={(e) => deleteSession(s.id, e)} className="text-slate-500 opacity-0 group-hover:opacity-100 hover:!text-red-400 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 px-2 flex items-center gap-2">
            <Database size={12}/> Knowledge Base
          </p>
          <div className="space-y-0.5">
            <button onClick={() => setSelectedFiles([])} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${selectedFiles.length === 0 ? 'bg-white/10 text-slate-100 font-medium' : 'hover:bg-white/5 text-slate-400'}`}>
              <Layers size={16}/> Query All Documents
            </button>
            
            {files.map(f => {
              const isSelected = selectedFiles.includes(f);
              const proc = processingFiles[f];
              return (
                <div key={f} className="group rounded-lg hover:bg-white/5 transition-all cursor-pointer" onClick={() => toggleFile(f)}>
                  <div className="flex justify-between items-center px-3 py-2.5">
                    <div className={`flex items-center gap-3 text-sm truncate ${isSelected ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                      {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="opacity-40" />}
                      <span className="truncate">{f}</span>
                    </div>
                    {proc && proc.stage !== 'error' && proc.stage !== 'complete' ? (
                      <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
                    ) : (
                      <button onClick={(e) => deleteFile(f, e)} className="text-slate-500 opacity-0 group-hover:opacity-100 hover:!text-red-400 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {proc && (
                    <div className="px-3 pb-2.5 space-y-1.5">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            proc.stage === 'complete' ? 'bg-green-500' : proc.stage === 'error' ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${proc.progress}%` }}
                        />
                      </div>
                      <p className={`text-[10px] truncate ${
                        proc.stage === 'complete' ? 'text-green-400' : proc.stage === 'error' ? 'text-red-400' : 'text-slate-500'
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
    </>
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
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 left-0 h-full w-[280px] bg-[#0f172a] border-r border-white/5 flex flex-col z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex w-72 bg-[#0f172a]/80 backdrop-blur-xl border-r border-white/5 flex-col shrink-0 z-40">
        <SidebarContent />
      </aside>
    </>
  );
};
