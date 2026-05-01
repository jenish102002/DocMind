import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    if (!currentSessionId) return;
    const fetchHistory = async () => {
      const res = await fetch(`${API_URL}/api/history/${currentSessionId}`);
      if (res.ok) setMessages(await res.json());
    };
    fetchHistory();
  }, [currentSessionId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectSession = (id) => {
    setCurrentSessionId(id);
    setSidebarOpen(false);
  };

  const createNewChat = async () => {
    const res = await fetch(`${API_URL}/api/sessions`, { method: 'POST' });
    const newSession = await res.json();
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setSidebarOpen(false);
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
    await fetch(`${API_URL}/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
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
        const res = await fetch(`${API_URL}/api/upload/status/${encodeURIComponent(filename)}`);
        const data = await res.json();
        setProcessingFiles(prev => ({ ...prev, [filename]: data }));
        if (data.stage === 'complete' || data.stage === 'error') {
          clearInterval(interval);
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
    if (!input.trim() || isThinking || !currentSessionId) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setIsThinking(true);

    try {
      const res = await fetch(`${API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg.content, session_id: currentSessionId, selected_files: selectedFiles })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
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
    <div className="h-screen h-[100dvh] bg-[#09090b] flex overflow-hidden text-slate-200 selection:bg-blue-500/30 font-sans">
      
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        files={files}
        selectedFiles={selectedFiles}
        processingFiles={processingFiles}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        createNewChat={createNewChat}
        selectSession={selectSession}
        deleteSession={deleteSession}
        toggleFile={toggleFile}
        setSelectedFiles={setSelectedFiles}
        deleteFile={deleteFile}
      />

      <main className="flex-1 flex flex-col relative h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#09090b] to-[#09090b] min-w-0">
        
        <Header 
          setSidebarOpen={setSidebarOpen}
          selectedFiles={selectedFiles}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
        />

        <MessageList 
          messages={messages}
          isThinking={isThinking}
          chatEndRef={chatEndRef}
          setInput={setInput}
        />

        <ChatInput 
          input={input}
          setInput={setInput}
          handleQuery={handleQuery}
          isThinking={isThinking}
          handleKeyDown={handleKeyDown}
        />

      </main>
    </div>
  );
}

export default App;