import { Menu, FileUp, Loader2, Sparkles, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

export const Header = ({ 
  setSidebarOpen, 
  selectedFiles, 
  isUploading, 
  fileInputRef, 
  handleFileUpload 
}) => {
  return (
    <header className="shrink-0 w-full px-4 py-4 flex justify-between items-center z-30 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-transparent pointer-events-none" />
      
      <div className="flex items-center gap-3 min-w-0 relative z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden shrink-0 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors shadow-sm"
        >
          <Menu size={18} />
        </motion.button>

        <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/10 px-4 py-2.5 rounded-xl backdrop-blur-xl shadow-sm min-w-0">
          <div className="relative flex items-center justify-center shrink-0">
            {selectedFiles.length > 0 ? (
              <>
                <div className="absolute inset-0 bg-accent rounded-full animate-ping opacity-40" />
                <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(59,130,246,0.8)] relative z-10" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] relative z-10" />
              </>
            )}
          </div>
          <span className="text-[12px] font-semibold tracking-wide text-slate-200 truncate flex items-center gap-1.5">
            {selectedFiles.length > 0 ? (
              <>
                <Filter size={13} className="text-accent" />
                Filtering by {selectedFiles.length} file(s)
              </>
            ) : (
              <>
                <Sparkles size={13} className="text-emerald-400" />
                Global Search Active
              </>
            )}
          </span>
        </div>
      </div>
      
      <motion.button 
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => fileInputRef.current?.click()} 
        className="relative z-10 shrink-0 flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]"
      >
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16}/>} 
        <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload PDF'}</span>
      </motion.button>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept=".pdf" />
    </header>
  );
};
