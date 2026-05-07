import { useState } from 'react';
import { Mail, Lock, Loader2, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const Login = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans relative overflow-hidden selection:bg-blue-500/30">
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[140px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-[140px]" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-blue-500/25 mb-5">
            <Sparkles className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DocMind AI</h1>
          <p className="text-slate-500 text-sm mt-1">Your intelligent PDF workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          {/* Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-7">
            {['login', 'signup'].map(tab => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-500/8 border border-red-500/15 rounded-xl text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-0.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-white/5 border border-white/8 focus:border-blue-500/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-0.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={activeTab === 'signup' ? 'At least 6 characters' : '••••••••'}
                  required
                  className="w-full bg-white/5 border border-white/8 focus:border-blue-500/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-all"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] group"
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : <>
                    {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
              }
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-5">
            {activeTab === 'login'
              ? <>No account? <button onClick={() => switchTab('signup')} className="text-blue-400 hover:text-blue-300 transition-colors">Sign up free</button></>
              : <>Already have an account? <button onClick={() => switchTab('login')} className="text-blue-400 hover:text-blue-300 transition-colors">Log in</button></>
            }
          </p>
        </div>
      </div>
    </div>
  );
};
