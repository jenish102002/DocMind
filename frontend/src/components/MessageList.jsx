import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Bot, User } from 'lucide-react';

export const MessageList = ({ messages, isThinking, chatEndRef, setInput }) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-10 custom-scrollbar scroll-smooth">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {messages.length === 0 && (
          <motion.div 
            initial={{opacity:0, scale:0.95, y:20}} 
            animate={{opacity:1, scale:1, y:0}} 
            transition={{duration: 0.5, ease: "easeOut"}}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
          >
            <div className="w-20 h-20 bg-gradient-to-tr from-accent to-indigo-500 flex items-center justify-center rounded-3xl mb-8 shadow-[0_0_50px_rgba(59,130,246,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-white/20 blur-xl" />
              <Sparkles className="text-white relative z-10" size={36} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white tracking-tight">How can I help you today?</h2>
            <p className="text-slate-400 mb-12 max-w-lg text-sm sm:text-base leading-relaxed">
              Query your documents, extract key insights, or summarize complex information instantly using AI.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
              {[
                "Summarize the main concepts discussed in the documents", 
                "Extract the key action items and conclusions", 
                "What are the primary arguments presented in these files?", 
                "Compare the different perspectives across the documents"
              ].map((suggestion, idx) => (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={idx} 
                  onClick={() => setInput(suggestion)} 
                  className="p-5 rounded-2xl glass-panel hover:bg-white/[0.04] hover:border-white/10 text-left transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <p className="text-sm text-slate-300 group-hover:text-white leading-relaxed relative z-10">{suggestion}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((m, i) => (
            <motion.div 
              key={i} 
              initial={{opacity:0, y:20, scale: 0.98}} 
              animate={{opacity:1, y:0, scale: 1}} 
              className={`flex gap-4 sm:gap-5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-indigo-500 flex items-center justify-center shrink-0 mt-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  <Bot size={18} className="text-white"/>
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] shadow-sm ${
                m.role === 'user' 
                  ? 'bg-white/10 text-white px-5 py-4 rounded-[2rem] rounded-tr-sm border border-white/5 backdrop-blur-md' 
                  : 'bg-transparent text-slate-200 py-1'
              }`}>
                <div className={`prose prose-invert max-w-none ${m.role === 'user' ? 'prose-p:m-0 text-[15px]' : ''}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                
                {m.role === 'assistant' && m.content === "" && isThinking && (
                  <div className="flex items-center gap-2 text-accent mt-4 bg-accent/10 w-fit px-4 py-2.5 rounded-full border border-accent/20">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></span>
                    <span className="text-xs font-medium ml-2 text-accent tracking-wide">Thinking...</span>
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
