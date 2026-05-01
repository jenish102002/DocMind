import React from 'react';
import { Send, Loader2 } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

export const ChatInput = ({ 
  input, 
  setInput, 
  handleQuery, 
  isThinking, 
  handleKeyDown 
}) => {
  return (
    <footer className="shrink-0 px-3 sm:px-6 pt-2 pb-5 sm:pb-8 z-30 bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent">
      <div className="max-w-3xl mx-auto relative">
        <div className={`relative flex items-end gap-2 bg-[#18181b] border ${isThinking ? 'border-white/5' : 'border-white/10'} rounded-3xl p-2 shadow-2xl transition-all focus-within:border-blue-500/50 focus-within:bg-[#1f1f23]`}>
          
          <TextareaAutosize 
            minRows={1} maxRows={6}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isThinking ? "Processing..." : "Message DocMind..."}
            className={`w-full bg-transparent resize-none py-3 px-3 sm:px-4 focus:outline-none text-slate-100 placeholder:text-slate-500 text-sm sm:text-base ${isThinking ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={isThinking}
          />
          
          <button 
            onClick={handleQuery} disabled={isThinking || !input.trim()} 
            className={`shrink-0 p-2.5 mb-1 mr-1 rounded-full transition-all flex items-center justify-center h-10 w-10 ${!input.trim() || isThinking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-slate-100 hover:bg-white text-slate-900 shadow-md hover:scale-105 active:scale-95'}`}
          >
            {isThinking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
          </button>
        </div>
        <div className="text-center mt-2 sm:mt-3">
          <span className="text-[10px] text-slate-500 font-medium tracking-wide">DocMind can make mistakes. Check important info.</span>
        </div>
      </div>
    </footer>
  );
};
