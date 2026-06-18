import { Send, Loader2 } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { motion } from 'framer-motion';

export const ChatInput = ({ 
  input, 
  setInput, 
  handleQuery, 
  isThinking, 
  handleKeyDown 
}) => {
  return (
    <footer className="shrink-0 px-4 sm:px-6 pt-2 pb-6 sm:pb-10 z-30 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none" />
      
      <div className="max-w-3xl mx-auto relative z-10">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative group"
        >
          {/* Animated Glow Behind Input */}
          <div className={`absolute -inset-1 bg-gradient-to-r from-accent/20 via-indigo-500/20 to-purple-500/20 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 ${isThinking ? 'hidden' : ''}`} />

          <div className={`relative flex items-end gap-3 glass-panel rounded-[2rem] p-2.5 transition-all duration-300 ${isThinking ? 'border-white/5 bg-white/[0.01]' : 'border-white/10 focus-within:border-accent/40 bg-white/[0.03] focus-within:bg-white/[0.04]'}`}>
            
            <TextareaAutosize 
              minRows={1} maxRows={6}
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={isThinking ? "Processing your request..." : "Message DocMind AI..."}
              className={`w-full bg-transparent resize-none py-3.5 px-4 sm:px-5 focus:outline-none text-slate-100 placeholder:text-slate-500 text-[15px] leading-relaxed ${isThinking ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={isThinking}
            />
            
            <motion.button 
              whileHover={!isThinking && input.trim() ? { scale: 1.05 } : {}}
              whileTap={!isThinking && input.trim() ? { scale: 0.95 } : {}}
              onClick={handleQuery} disabled={isThinking || !input.trim()} 
              className={`shrink-0 mb-1.5 mr-1.5 rounded-[1.25rem] transition-all flex items-center justify-center h-11 w-11 ${
                !input.trim() || isThinking 
                  ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5' 
                  : 'bg-gradient-to-tr from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-white/10'
              }`}
            >
              {isThinking ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Send size={18} className={`ml-0.5 ${!input.trim() ? 'opacity-50' : ''}`} />}
            </motion.button>
          </div>
        </motion.div>

        <div className="text-center mt-4 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-slate-500 font-medium tracking-wide">
            DocMind AI can make mistakes. Consider verifying important information.
          </span>
        </div>
      </div>
    </footer>
  );
};
