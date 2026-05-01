import React from 'react';
import { Menu, FileUp, Loader2 } from 'lucide-react';

export const Header = ({ 
  setSidebarOpen, 
  selectedFiles, 
  isUploading, 
  fileInputRef, 
  handleFileUpload 
}) => {
  return (
    <header className="shrink-0 w-full px-3 sm:px-4 py-3 flex justify-between items-center z-30 bg-gradient-to-b from-[#09090b] to-transparent gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 transition-all"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-2 rounded-full backdrop-blur-md min-w-0">
          <div className={`w-2 h-2 shrink-0 rounded-full animate-pulse ${selectedFiles.length > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`} />
          <span className="text-[11px] font-semibold tracking-wide text-slate-300 truncate">
            {selectedFiles.length > 0 ? `Targeting ${selectedFiles.length} File(s)` : 'Global Search Active'}
          </span>
        </div>
      </div>
      
      <button onClick={() => fileInputRef.current?.click()} className="shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-full text-sm font-medium transition-all backdrop-blur-md text-slate-200">
        {isUploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15}/>} 
        <span className="hidden sm:inline">Upload PDF</span>
      </button>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept=".pdf" />
    </header>
  );
};
