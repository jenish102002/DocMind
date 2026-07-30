import { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, Sparkles, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const Login = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 100);
    } else {
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');

    const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      onLogin(data.token, data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-indigo-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />

      {/* Full Screen Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/60"
          >
            <div className="flex flex-col items-center gap-4 glass-panel p-8 rounded-3xl shadow-2xl w-[300px]">
              <Loader2 size={40} className="text-accent animate-spin" />
              <p className="text-lg font-semibold tracking-wide text-white">
                {activeTab === 'login' ? 'Authenticating...' : 'Creating Account...'}
              </p>
              
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 mt-2">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[400px] relative z-10"
      >
        {/* Logo Header */}
        <div className="text-center mb-8">
          <motion.div 
            whileHover={{ rotate: 180, scale: 1.1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="w-16 h-16 bg-gradient-to-tr from-accent to-indigo-500 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-accent/20 mb-5 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
            <Sparkles className="text-white w-8 h-8 relative z-10" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">DocMind AI</h1>
          <p className="text-slate-400 text-sm font-medium">Your intelligent PDF workspace</p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-indigo-500 to-purple-500 opacity-50" />
          
          {/* Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-8 relative">
            {['login', 'signup'].map(tab => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all duration-300 relative z-10 ${
                  activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white/10 rounded-lg shadow-sm border border-white/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0, mb: 0 }}
                animate={{ opacity: 1, height: 'auto', mb: 20 }}
                exit={{ opacity: 0, height: 0, mb: 0 }}
                className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-accent/20 rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center bg-white/[0.03] border border-white/10 group-focus-within:border-accent/50 rounded-xl transition-all duration-300">
                  <Mail size={18} className="absolute left-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Password</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-accent/20 rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center bg-white/[0.03] border border-white/10 group-focus-within:border-accent/50 rounded-xl transition-all duration-300">
                  <Lock size={18} className="absolute left-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={activeTab === 'signup' ? 'At least 6 characters' : '••••••••'}
                    required
                    className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 bg-gradient-to-r from-accent to-indigo-500 hover:from-accent-hover hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] group"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {activeTab === 'login' ? 'Secure Sign In' : 'Create Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck size={14} className="text-green-500/70" />
            <span>Secure 256-bit encryption</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

