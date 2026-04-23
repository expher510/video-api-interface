import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where,
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { 
  Copy, Eye, EyeOff, LayoutDashboard, KeyRound, Check, Book, Fingerprint
} from 'lucide-react';
import { format } from 'date-fns';

const LIMIT_OPTIONS = [50, 100, 200, 500, 1000, 5000];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingInit(false);
    });
    return unsub;
  }, []);

  if (loadingInit) {
    return <div className="flex h-screen items-center justify-center bg-[#FAF9F6]"><div className="animate-spin text-[#5A5A40]"><KeyRound size={32} /></div></div>;
  }

  return (
    <div className="font-sans text-[#3D3D33] min-h-screen bg-[#FAF9F6] selection:bg-[#E5E2D9] selection:text-[#3D3D33]">
      {user ? <Dashboard user={user} /> : <AuthScreen />}
    </div>
  );
}

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#FAF9F6] text-[#3D3D33]">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-10 border border-[#E5E2D9] shadow-sm">
        <div className="text-center">
          <h2 className="text-3xl font-serif font-bold italic text-[#5A5A40] tracking-tight">KeyVault.</h2>
          <p className="mt-2 text-sm text-[#706F66]">
            {isLogin ? 'Sign in to access your keys' : 'Create a new account'}
          </p>
        </div>
        
        {error && (
          <div className="rounded-xl bg-[#FDE8E8] p-4 text-sm text-[#8C3D3D] font-medium text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-xl border-[#E5E2D9] border bg-[#F5F2ED] px-4 py-3 text-[#3D3D33] placeholder-[#A3A192] focus:border-[#5A5A40] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40] sm:text-sm transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border-[#E5E2D9] border bg-[#F5F2ED] px-4 py-3 text-[#3D3D33] placeholder-[#A3A192] focus:border-[#5A5A40] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40] sm:text-sm transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-xl bg-[#5A5A40] px-4 py-3 text-sm font-bold text-white hover:bg-[#4A4A34] focus:outline-none transition-colors disabled:opacity-70"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Register')}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-[#706F66] hover:text-[#5A5A40] underline transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');
  
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF9F6]">
      <nav className="w-64 border-r border-[#E5E2D9] bg-[#F5F2ED] flex flex-col shrink-0">
        <div className="p-8">
          <h1 className="text-xl font-serif font-bold italic text-[#5A5A40] tracking-tight">KeyVault.</h1>
        </div>
        <div className="flex-1 space-y-1 px-4 text-sm">
          <button
            onClick={() => setActiveTab('keys')}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium ${
              activeTab === 'keys' ? 'bg-[#5A5A40] text-white' : 'text-[#706F66] hover:bg-[#E5E2D9]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors font-medium ${
              activeTab === 'docs' ? 'bg-[#5A5A40] text-white' : 'text-[#706F66] hover:bg-[#E5E2D9]'
            }`}
          >
            <Book className="w-5 h-5 mr-3" />
            Documentation
          </button>
        </div>
        <div className="p-6 border-t border-[#E5E2D9]">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#D1CFB9] flex items-center justify-center font-bold text-[#5A5A40]">
              {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-[#3D3D33] truncate">{user.email}</p>
              <p className="text-[10px] text-[#A3A192] uppercase tracking-wider font-semibold">Free Plan</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="w-full text-left text-xs font-bold text-[#8C3D3D] hover:underline px-1 transition-colors">Log Out</button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'keys' ? <KeysView user={user} /> : <DocsView />}
      </main>
    </div>
  );
}

function KeysView({ user }: { user: User }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyData, setNewKeyData] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    const qWhere = query(
      collection(db, 'api_keys'),
      where('user_id', '==', user.uid)
    );
    
    const unsub = onSnapshot(qWhere, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => b.created_at - a.created_at);
      setKeys(data);
    });
    return unsub;
  }, [user.uid]);

  const stats = {
    total: keys.length,
    active: keys.filter(k => k.status === 'active').length,
    revoked: keys.filter(k => k.status === 'revoked').length,
  };

  return (
    <>
      <header className="h-16 border-b border-[#E5E2D9] flex items-center justify-between px-8 bg-white shrink-0">
        <h2 className="font-serif text-lg text-[#5A5A40]">Project Keys</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-[#5A5A40] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#4A4A34] transition-colors"
        >
          {showCreateForm ? 'Cancel Creation' : '+ Create New Key'}
        </button>
      </header>

      <div className="p-8 space-y-6 flex-1 overflow-auto flex flex-col">
        {newKeyData && (
          <div className="bg-[#EFEFDC] border border-[#D9D9B8] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center mr-4 shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest">Key Created Successfully</p>
                <div className="flex items-center mt-1">
                  <p className="font-mono text-sm text-[#3D3D33]">{newKeyData.key}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigator.clipboard.writeText(newKeyData.key)}
                className="text-xs font-bold underline text-[#5A5A40] px-4 py-2 hover:bg-[#D9D9B8] rounded-lg transition-colors"
              >
                Copy Secret Key
              </button>
              <button 
                onClick={() => setNewKeyData(null)}
                className="text-[10px] font-bold uppercase tracking-widest text-[#706F66] px-3 py-2 hover:bg-[#D9D9B8] rounded-lg transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-3xl border border-[#E5E2D9] shadow-sm">
            <p className="text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1">Total Keys</p>
            <span className="text-3xl font-serif text-[#3D3D33]">{stats.total}</span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-[#E5E2D9] shadow-sm">
            <p className="text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1">Active Keys</p>
            <span className="text-3xl font-serif text-[#3D3D33]">{stats.active}</span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-[#E5E2D9] shadow-sm">
            <p className="text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1">Revoked</p>
            <span className="text-3xl font-serif text-[#8C3D3D]">{stats.revoked}</span>
          </div>
        </div>

        {showCreateForm && (
          <CreateKeyForm user={user} onSuccess={(data) => {
            setNewKeyData(data);
            setShowCreateForm(false);
          }} />
        )}

        <div className="bg-white rounded-3xl border border-[#E5E2D9] flex-1 min-h-[300px] flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F5F2ED] text-[10px] font-bold text-[#A3A192] uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Name & Project</th>
                  <th className="px-6 py-4">Key</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[#F0EFED]">
                {keys.map((k) => (
                  <KeyRow key={k.id} item={k} />
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#706F66]">
                      <Fingerprint className="mx-auto h-8 w-8 opacity-40 mb-3" />
                      No API keys found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex-1 bg-[#FCFBFA] border-t border-[#F0EFED]"></div>
        </div>
      </div>
    </>
  );
}

function CreateKeyForm({ user, onSuccess }: { user: User, onSuccess: (data: any) => void }) {
  const [name, setName] = useState('');
  const [project, setProject] = useState('');
  const [limit, setLimit] = useState<number>(200);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const generatedKey = 'vg_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0);

      const docData = {
        user_id: user.uid,
        key: generatedKey,
        name,
        project,
        permissions: [],
        daily_limit: limit,
        requests_today: 0,
        limit_reset_at: nextMidnight.getTime(),
        status: 'active',
        created_at: Date.now()
      };

      await addDoc(collection(db, 'api_keys'), docData);
      onSuccess(docData);
    } catch (err: any) {
      alert("Error creating API key: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 border border-[#E5E2D9] rounded-3xl shadow-sm shrink-0">
      <h3 className="font-serif text-lg text-[#5A5A40]">Configure New Key</h3>
      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label className="block text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1.5">Key Name</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production Web Key" className="block w-full rounded-xl border-[#E5E2D9] border bg-[#F5F2ED] px-4 py-2.5 text-[#3D3D33] placeholder-[#A3A192] focus:border-[#5A5A40] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40] sm:text-sm transition-colors" />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1.5">Project Name</label>
          <input required type="text" value={project} onChange={e => setProject(e.target.value)} placeholder="e.g. project-x" className="block w-full rounded-xl border-[#E5E2D9] border bg-[#F5F2ED] px-4 py-2.5 text-[#3D3D33] placeholder-[#A3A192] focus:border-[#5A5A40] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40] sm:text-sm transition-colors" />
        </div>

        <div className="sm:col-span-6">
          <label className="block text-[10px] font-bold text-[#A3A192] uppercase tracking-widest mb-1.5">Daily Quota Limit</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="block w-full rounded-xl border-[#E5E2D9] border bg-[#F5F2ED] px-4 py-2.5 text-[#3D3D33] focus:border-[#5A5A40] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40] sm:text-sm cursor-pointer transition-colors">
            {LIMIT_OPTIONS.map(l => (
              <option key={l} value={l}>{l} requests</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="mt-8 flex justify-end pt-6 border-t border-[#F0EFED]">
        <button type="submit" disabled={loading} className="rounded-xl bg-[#5A5A40] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#4A4A34] focus:outline-none disabled:opacity-70 transition-colors">
          Generate API Key
        </button>
      </div>
    </form>
  );
}

function KeyRow({ item }: { item: any; key?: React.Key }) {
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState<'revoke' | 'delete' | null>(null);
  
  const displayKey = revealed ? item.key : item.key.substring(0, 7) + '•'.repeat(16);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(item.key);
  };

  const handleRevoke = async () => {
    try {
      await updateDoc(doc(db, 'api_keys', item.id), { status: 'revoked' });
      setConfirming(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async () => {
    try {
      await updateDoc(doc(db, 'api_keys', item.id), { status: 'active' });
      setConfirming(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'api_keys', item.id));
    } catch (e) {
      console.error(e);
    }
  };

  const isRevoked = item.status === 'revoked';

  return (
    <tr className={isRevoked ? 'bg-[#FBFAF8]' : ''}>
      <td className={`px-6 py-4 whitespace-nowrap ${isRevoked ? 'opacity-70' : ''}`}>
        <p className="font-bold text-[#3D3D33]">{item.name}</p>
        <p className="text-xs text-[#A3A192]">{item.project}</p>
      </td>
      <td className={`px-6 py-4 whitespace-nowrap ${isRevoked ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#706F66] bg-[#F5F2ED] px-2 py-1 rounded border border-[#E5E2D9]">{displayKey}</span>
          <button onClick={() => setRevealed(!revealed)} className="text-[#A3A192] hover:text-[#5A5A40] transition-colors" title="Reveal">
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={handleCopy} className="text-[#A3A192] hover:text-[#5A5A40] transition-colors" title="Copy">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {isRevoked ? (
          <div className="flex items-center justify-center">
            <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-2"></span>
            <span className="text-xs font-medium text-red-700">Revoked</span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            <span className="text-xs font-medium text-green-700">Active</span>
          </div>
        )}
        {!isRevoked && (
          <div className="mt-1.5 flex items-center justify-center gap-1">
            <div className="w-16 bg-[#E5E2D9] rounded-full h-1 overflow-hidden">
              <div 
                className={`h-1 rounded-full ${item.requests_today >= item.daily_limit ? 'bg-[#8C3D3D]' : 'bg-[#5A5A40]'}`} 
                style={{ width: `${Math.min(100, (item.requests_today / item.daily_limit) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-[#706F66] text-sm ${isRevoked ? 'opacity-70' : ''}`}>
        {format(item.created_at, 'MMM dd, yyyy')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
        {confirming === 'revoke' ? (
           <div className="flex items-center justify-end gap-2">
             <span className="text-[10px] text-[#8C3D3D] font-bold uppercase tracking-wider">Revoke?</span>
             <button onClick={handleRevoke} className="bg-[#8C3D3D] text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-opacity-80 transition-all">Yes</button>
             <button onClick={() => setConfirming(null)} className="bg-[#E5E2D9] text-[#3D3D33] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-opacity-80 transition-all">No</button>
           </div>
        ) : confirming === 'delete' ? (
           <div className="flex items-center justify-end gap-2">
             <span className="text-[10px] text-[#A3A192] font-bold uppercase tracking-wider">Delete?</span>
             <button onClick={handleDelete} className="bg-[#3D3D33] text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-opacity-80 transition-all">Yes</button>
             <button onClick={() => setConfirming(null)} className="bg-[#E5E2D9] text-[#3D3D33] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-opacity-80 transition-all">No</button>
           </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            {!isRevoked ? (
              <button 
                onClick={() => setConfirming('revoke')} 
                className="text-[#8C3D3D] hover:underline font-bold text-[10px] uppercase tracking-wider transition-all"
              >
                Revoke
              </button>
            ) : (
              <button 
                onClick={handleResume} 
                className="text-[#5A5A40] hover:underline font-bold text-[10px] uppercase tracking-wider transition-all"
              >
                Resume
              </button>
            )}
            <button 
              onClick={() => setConfirming('delete')} 
              className="text-[#706F66] hover:underline font-bold text-[10px] uppercase tracking-wider transition-all"
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function DocsView() {
  return (
    <>
      <header className="h-16 border-b border-[#E5E2D9] flex items-center justify-between px-8 bg-white shrink-0">
        <h2 className="font-serif text-lg text-[#5A5A40]">Documentation</h2>
      </header>

      <div className="p-8 space-y-6 flex-1 overflow-auto">
        <div className="bg-white rounded-3xl border border-[#E5E2D9] p-8 shadow-sm max-w-4xl">
          <div className="max-w-3xl text-sm text-[#706F66]">
            <p>You can use your generated API keys to authenticate against the REST API or webhook nodes.</p>
          </div>
          
          <div className="mt-8 space-y-8">
            <div>
              <h4 className="text-sm font-bold text-[#3D3D33] uppercase tracking-wider mb-2 border-b border-[#F0EFED] pb-2">Authentication & Generation</h4>
              <p className="text-sm text-[#706F66] mb-4">
                All requests must include the <code className="bg-[#F5F2ED] border border-[#E5E2D9] px-1.5 py-0.5 rounded text-[#5A5A40] font-mono text-[11px]">Authorization</code> header with your API key as a Bearer token.
              </p>
              <div className="bg-[#2D2D2A] rounded-2xl p-5 overflow-x-auto shadow-inner space-y-4">
                <pre className="text-[#D1CFB9] text-sm font-mono leading-relaxed">
{`curl -X POST https://alisaadeng-n8n.hf.space/webhook/generate \\
  -H "Authorization: Bearer vg_xxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "body": "your prompt here"
  }'`}
                </pre>
                
                <div className="pt-4 border-t border-[#3D3D33]">
                  <p className="text-[10px] text-[#A3A192] uppercase tracking-wider mb-2">Expected Response (Queued)</p>
                  <pre className="text-[#89A889] text-xs font-mono leading-relaxed">
{`[
  {
    "success": true,
    "state": "queued",
    "job_id": "268c2294-98c9-44ab-9482-3915a03f794b",
    "message": "Video generation job has been queued",
    "estimated_time": 120,
    "poll_url": "https://alisaadeng-n8n.hf.space/webhook/git-video",
    "poll_interval": 10
  }
]`}
                  </pre>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#3D3D33] uppercase tracking-wider mb-2 border-b border-[#F0EFED] pb-2">Download / Polling Request</h4>
              <p className="text-sm text-[#706F66] mb-4">
                To retrieve a completed video, make a <code className="bg-[#F5F2ED] border border-[#E5E2D9] px-1.5 py-0.5 rounded text-[#5A5A40] font-mono text-[11px]">GET</code> request providing your key and passing the <code className="bg-[#F5F2ED] border border-[#E5E2D9] px-1.5 py-0.5 rounded text-[#5A5A40] font-mono text-[11px]">job_id</code> in the request body to the download endpoint.
              </p>
              <div className="bg-[#2D2D2A] rounded-2xl p-5 overflow-x-auto shadow-inner space-y-4">
                <pre className="text-[#D1CFB9] text-sm font-mono leading-relaxed">
{`curl -X GET https://alisaadeng-n8n.hf.space/webhook/download \\
  -H "Authorization: Bearer vg_xxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "268c2294-98c9-44ab-9482-3915a03f794b"
  }'`}
                </pre>
                
                <div className="pt-4 border-t border-[#3D3D33] grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] text-[#A3A192] uppercase tracking-wider mb-2">Expected Response (Processing)</p>
                    <pre className="text-[#D9B855] text-xs font-mono leading-relaxed">
{`[
  {
    "state": "processing",
    "message": "Video is still being generated",
    "retry_after": 10
  }
]`}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#A3A192] uppercase tracking-wider mb-2">Expected Response (Completed)</p>
                    <pre className="text-[#89A889] text-xs font-mono leading-relaxed break-all whitespace-pre-wrap">
{`[
  {
    "index": 1,
    "url": "https://scontent-iad6-1.xx.fbcdn.net/o1/v/t6/f2/m258/...mp4?..."
  }
]`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
