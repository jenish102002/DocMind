import { useState, useEffect, useRef } from 'react';
import { 
  Bot, User, Upload, Send, FileText, Database, 
  Trash2, Sparkles, Loader2, Cpu, Layers, PlusCircle, MessageSquare, CheckSquare, Square, FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [processingFiles, setProcessingFiles] = useState({});
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Initial Load from Backend
  useEffect(() => {
    const fetchInitData = async () => {
      const sessRes = await fetch(`${API_URL}/api/sessions`);
      const sessData = await sessRes.json();
      
      if (sessData.length === 0) createNewChat();
      else {
        setSessions(sessData);
        setCurrentSessionId(sessData[0].id);
      }

      const filesRes = await fetch(`${API_URL}/api/files`);
      if (filesRes.ok) {
        const fileData = await filesRes.json();
        setFiles(fileData.files);
      }
    };
    fetchInitData();
  }, []);

  // 2. Load History when Session changes
  useEffect(() => {
    if (!currentSessionId) return;
    const fetchHistory = async () => {
      const res = await fetch(`${API_URL}/api/history/${currentSessionId}`);
      if (res.ok) setMessages(await res.json());
    };
    fetchHistory();
  }, [currentSessionId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // --- CRUD ACTIONS ---
  const createNewChat = async () => {
    const res = await fetch(`${API_URL}/api/sessions`, { method: 'POST' });
    const newSession = await res.json();
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    await fetch(`${API_URL}/api/sessions/${id}`, { method: 'DELETE' });
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id && updated.length > 0) setCurrentSessionId(updated[0].id);
    else if (updated.length === 0) createNewChat();
  };

  const deleteFile = async (filename, e) => {
    e.stopPropagation();
    await fetch(`${API_URL}/api/files/${filename}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f !== filename));
    setSelectedFiles(prev => prev.filter(f => f !== filename));
    setProcessingFiles(prev => {
      const updated = { ...prev };
      delete updated[filename];
      return updated;
    });
  };

  const toggleFile = (filename) => {
    if (selectedFiles.includes(filename)) setSelectedFiles(prev => prev.filter(f => f !== filename));
    else setSelectedFiles(prev => [...prev, filename]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await fetch(`${API_URL}/api/upload`, { method: "POST", body: formData });
      setFiles(prev => Array.from(new Set([...prev, file.name])));
      // Start polling for ingestion progress
      setProcessingFiles(prev => ({ ...prev, [file.name]: { stage: 'pending', progress: 5, message: 'Uploading...' } }));
      pollProgress(file.name);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const pollProgress = (filename) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/upload/status/${filename}`);
        const data = await res.json();
        setProcessingFiles(prev => ({ ...prev, [filename]: data }));
        if (data.stage === 'complete' || data.stage === 'error') {
          clearInterval(interval);
          // Remove from processing after a brief delay to show 100%
          if (data.stage === 'complete') {
            setTimeout(() => setProcessingFiles(prev => {
              const updated = { ...prev };
              delete updated[filename];
              return updated;
            }), 2000);
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 1000);
  };

  const handleQuery = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg = input;
    
    setMessages(prev => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setInput("");
    setIsThinking(true);

    try {
      const response = await fetch(`${API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg, session_id: currentSessionId, selected_files: selectedFiles }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulatedText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = accumulatedText;
          return updated;
        });
      }

      const sessRes = await fetch(`${API_URL}/api/sessions`);
      setSessions(await sessRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="h-screen bg-[#09090b] flex overflow-hidden text-slate-200 selection:bg-blue-500/30 font-sans">
      
      {/* PREMIUM SIDEBAR (Glassmorphism inspired) */}
      <aside className="w-72 bg-[#0f172a]/80 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0 z-40 transition-all">
        <div className="p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 border border-blue-500/30 p-2 rounded-xl">
              <Cpu size={20} className="text-blue-400" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">DocMind</h1>
          </div>
        </div>

        <div className="px-4 pb-4">
          <button onClick={createNewChat} className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-all text-sm font-medium shadow-sm">
            <PlusCircle size={18} className="text-slate-400" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-8 pb-6">
          
          {/* HISTORY SECTION */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 px-2 flex items-center gap-2">
              <MessageSquare size={12}/> Recent Chats
            </p>
            <div className="space-y-0.5">
              {sessions.map(s => (
                <div key={s.id} onClick={() => setCurrentSessionId(s.id)} className={`w-full group cursor-pointer flex justify-between items-center px-3 py-2.5 rounded-lg text-sm transition-all ${currentSessionId === s.id ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-white/5 text-slate-400'}`}>
                  <span className="truncate pr-2">{s.title}</span>
                  <button onClick={(e) => deleteSession(s.id, e)} className="text-slate-500 opacity-0 group-hover:opacity-100 hover:!text-red-400 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* TARGET FILES SECTION */}
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
                    {/* Progress Bar */}
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
      </aside>

      {/* MAIN CHAT INTERFACE */}
      <main className="flex-1 flex flex-col relative h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#09090b] to-[#09090b]">
        
        {/* Floating Header */}
        <header className="absolute top-0 w-full p-4 flex justify-between items-center z-30 bg-gradient-to-b from-[#09090b] to-transparent">
          <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-2 rounded-full backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full animate-pulse ${selectedFiles.length > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`} />
            <span className="text-[11px] font-semibold tracking-wide text-slate-300">
              {selectedFiles.length > 0 ? `Targeting ${selectedFiles.length} File(s)` : 'Global Search Active'}
            </span>
          </div>
          
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full text-sm font-medium transition-all backdrop-blur-md text-slate-200">
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16}/>} 
            <span>Upload PDF</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept=".pdf" />
        </header>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-24 pb-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Intelligent Empty State */}
            {messages.length === 0 && (
              <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 flex items-center justify-center rounded-2xl mb-6 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                  <Sparkles className="text-blue-400" size={32} />
                </div>
                <h2 className="text-3xl font-semibold mb-3 text-slate-100 tracking-tight">How can I help you today?</h2>
                <p className="text-slate-400 mb-10 max-w-md">Query your documents, extract key insights, or summarize complex information.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
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

            {/* Chat Flow (Claude/ChatGPT Style) */}
            <AnimatePresence mode="popLayout">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className={`flex gap-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  
                  {/* AI Avatar */}
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles size={16} className="text-blue-400"/>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] sm:max-w-[75%] ${m.role === 'user' ? 'bg-[#25252d] text-slate-100 px-5 py-3.5 rounded-3xl rounded-tr-sm' : 'text-slate-300 py-1'}`}>
                    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#1e1e24] prose-pre:border prose-pre:border-white/10">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    
                    {/* Thinking Indicator */}
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

        {/* Premium Input Area */}
        <footer className="shrink-0 p-4 sm:p-6 pb-8 z-30 bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent">
          <div className="max-w-3xl mx-auto relative">
            <div className={`relative flex items-end gap-2 bg-[#18181b] border ${isThinking ? 'border-white/5' : 'border-white/10'} rounded-3xl p-2 shadow-2xl transition-all focus-within:border-blue-500/50 focus-within:bg-[#1f1f23]`}>
              
              <TextareaAutosize 
                minRows={1} maxRows={6}
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={isThinking ? "Processing..." : "Message DocMind..."}
                className={`w-full bg-transparent resize-none py-3 px-4 focus:outline-none text-slate-100 placeholder:text-slate-500 ${isThinking ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={isThinking}
              />
              
              <button 
                onClick={handleQuery} disabled={isThinking || !input.trim()} 
                className={`shrink-0 p-3 mb-1 mr-1 rounded-full transition-all flex items-center justify-center h-10 w-10 ${!input.trim() || isThinking ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-slate-100 hover:bg-white text-slate-900 shadow-md hover:scale-105 active:scale-95'}`}
              >
                {isThinking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">DocMind can make mistakes. Check important info.</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;