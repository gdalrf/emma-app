import { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter your credentials.');
      return;
    }
    setLoading(true);
    setError('');
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #040b14 0%, #0a1628 60%, #081220 100%)' }}>

      {/* Background texture dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
          <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#1d6fa4" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #1d6fa4, #00c2a8)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.5.8 4.3 1.62 6"/>
              <path d="M12 6V2"/><path d="M8 2h8"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">EMMA</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            Emissions Monitoring & Maritime Analytics
          </p>
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-xs"
            style={{ background: 'rgba(29,111,164,0.15)', color: '#60a5fa', border: '1px solid rgba(29,111,164,0.3)' }}>
            Plymouth Port Authority
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{ background: '#0a1628', border: '1px solid rgba(29,111,164,0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>

          <h2 className="text-lg font-semibold text-white mb-1">Sign In</h2>
          <p className="text-xs mb-6" style={{ color: '#64748b' }}>
            Authorised personnel only — Class A/B Harbour Masters
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Username / Employee ID
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. HM_PLYMOUTH_01"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition"
                style={{
                  background: '#060e19',
                  border: '1px solid rgba(29,111,164,0.4)',
                  color: '#e2e8f0',
                }}
                onFocus={e => e.target.style.borderColor = '#1d6fa4'}
                onBlur={e => e.target.style.borderColor = 'rgba(29,111,164,0.4)'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition"
                style={{
                  background: '#060e19',
                  border: '1px solid rgba(29,111,164,0.4)',
                  color: '#e2e8f0',
                }}
                onFocus={e => e.target.style.borderColor = '#1d6fa4'}
                onBlur={e => e.target.style.borderColor = 'rgba(29,111,164,0.4)'}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg border border-red-800/40">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: loading ? '#155880' : 'linear-gradient(90deg, #1d6fa4, #2589c4)',
                boxShadow: loading ? 'none' : '0 4px 15px rgba(29,111,164,0.4)',
              }}
            >
              {loading ? 'Authenticating…' : 'Sign In to EMMA'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-xs text-center" style={{ borderColor: 'rgba(29,111,164,0.2)', color: '#475569' }}>
            Use any credentials to access the demo environment
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#334155' }}>
          © 2025 Plymouth Port Authority · EMMA v2.4.1 · Restricted Access
        </p>
      </div>
    </div>
  );
}
