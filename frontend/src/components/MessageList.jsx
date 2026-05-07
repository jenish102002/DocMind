import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Sparkles } from 'lucide-react';

export const MessageList = ({ messages, isThinking, chatEndRef, setInput }) => {
  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 pb-10 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {messages.length === 0 && (
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="flex flex-col items-center justify-center min-h-[60vh] text-center px-2">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 flex items-center justify-center rounded-2xl mb-6 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
              <Sparkles className="text-blue-400" size={32} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-3 text-slate-100 tracking-tight">How can I help you today?</h2>
            <p className="text-slate-400 mb-10 max-w-md text-sm sm:text-base">Query your documents, extract key insights, or summarize complex information.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {[
                "Summarize the main concepts discussed in the documents", 
                "Extract the key action items and conclusions", 
                "What are the primary arguments presented in these files?", 
                "Compare the different perspectives across the documents"
              ].map((suggestion, idx) => (
                <button key={idx} onClick={() => setInput(suggestion)} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 text-left transition-all group">
                  <p className="text-sm text-slate-300 group-hover:text-slate-100">{suggestion}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className={`flex gap-3 sm:gap-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles size={16} className="text-blue-400"/>
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] ${m.role === 'user' ? 'bg-[#25252d] text-slate-100 px-4 py-3 sm:px-5 sm:py-3.5 rounded-3xl rounded-tr-sm' : 'text-slate-300 py-1'}`}>
                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#1e1e24] prose-pre:border prose-pre:border-white/10 text-sm sm:text-base">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                
                {m.role === 'assistant' && m.content === "" && isThinking && (
                  <div className="flex items-center gap-3 text-slate-400 mt-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={chatEndRef} className="h-4" />
      </div>
    </div>
  );
};
