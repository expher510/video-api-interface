import React, { useEffect, useMemo, useState } from 'react';
import brandImage from './assets/eg-autonomous-brand.jpeg';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Book,
  Check,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';

type AuthMode = 'login' | 'register';
type ApiKeyStatus = 'active' | 'revoked';
type GenerateMode = 'text' | 'image' | 'video' | 'image_to_video';

type ApiKeyDoc = {
  id: string;
  user_id: string;
  key: string;
  name: string;
  project: string;
  permissions: string[];
  daily_limit: number;
  requests_today: number;
  limit_reset_at: number;
  status: ApiKeyStatus;
  created_at: number;
};

const LIMIT_OPTIONS = [50, 100, 200, 500, 1000, 5000];
const MAX_TEXT_LENGTH = 64;

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, ' ');

const mapAuthErrorMessage = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) : '';

  if (code.includes('auth/invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('auth/invalid-credential')) return 'Incorrect email or password.';
  if (code.includes('auth/user-not-found')) return 'No user found with this email.';
  if (code.includes('auth/wrong-password')) return 'Incorrect email or password.';
  if (code.includes('auth/email-already-in-use')) return 'This email is already in use.';
  if (code.includes('auth/weak-password')) return 'Password must be at least 8 characters.';
  if (code.includes('auth/too-many-requests')) return 'Too many attempts. Please wait and try again.';

  return 'Authentication failed. Please try again.';
};

const generateSecureApiKey = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const randomHex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `eg_${randomHex}`;
};

const maskApiKey = (key: string) => {
  const visiblePart = key.slice(0, 9);
  const hiddenChars = Math.max(8, key.length - visiblePart.length);
  return `${visiblePart}${'*'.repeat(hiddenChars)}`;
};

const coerceKeyDoc = (id: string, data: Record<string, unknown>): ApiKeyDoc => {
  const statusValue = data.status === 'revoked' ? 'revoked' : 'active';
  return {
    id,
    user_id: String(data.user_id ?? ''),
    key: String(data.key ?? ''),
    name: String(data.name ?? ''),
    project: String(data.project ?? ''),
    permissions: Array.isArray(data.permissions)
      ? data.permissions.filter((item): item is string => typeof item === 'string')
      : [],
    daily_limit: Number(data.daily_limit ?? 0),
    requests_today: Number(data.requests_today ?? 0),
    limit_reset_at: Number(data.limit_reset_at ?? 0),
    status: statusValue,
    created_at: Number(data.created_at ?? 0),
  };
};

const safeDate = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'Unknown';
  try {
    return format(value, 'MMM dd, yyyy');
  } catch {
    return 'Unknown';
  }
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoadingInit(false);
    });
    return unsub;
  }, []);

  if (loadingInit) {
    return (
      <div className="loading-screen">
        <div className="loading-badge">
          <KeyRound size={28} />
          <span>Securing Session...</span>
        </div>
      </div>
    );
  }

  return <div className="app-shell">{user ? <Dashboard user={user} /> : <AuthScreen />}</div>;
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      setError('Email and password are required.');
      return;
    }

    if (!isLogin && normalizedPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
      } else {
        await createUserWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
      }
    } catch (authError: unknown) {
      setError(mapAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-brand-panel reveal-up">
        <div className="brand-glow" aria-hidden="true" />
        <img src={brandImage} alt="EG Autonomous" className="brand-image" />
        <div className="brand-copy">
          <p className="brand-kicker">EG AUTONOMOUS</p>
          <h1>Secure AI Video Key Management</h1>
          <p>
            Enterprise-grade key control, usage limits, and fast operational workflows tailored for AI video pipelines.
          </p>
        </div>
      </section>

      <section className="auth-form-panel reveal-up-delay">
        <div className="auth-card">
          <div className="auth-title-wrap">
            <h2>Welcome to EG Autonomous</h2>
            <p>{isLogin ? 'Sign in to your secure dashboard.' : 'Create your secure account.'}</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              maxLength={120}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={isLogin ? 1 : 8}
              maxLength={128}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <button
            type="button"
            className="switch-mode"
            onClick={() => {
              setError('');
              setMode(isLogin ? 'register' : 'login');
            }}
          >
            {isLogin ? 'Need an account? Register' : 'Already have an account? Sign in'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Dashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <img src={brandImage} alt="EG Autonomous" />
          <div>
            <p>EG Autonomous</p>
            <span>Security Console</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <button onClick={() => setActiveTab('keys')} className={activeTab === 'keys' ? 'active' : ''}>
            <LayoutDashboard className="w-5 h-5" />
            API Keys
          </button>
          <button onClick={() => setActiveTab('docs')} className={activeTab === 'docs' ? 'active' : ''}>
            <Book className="w-5 h-5" />
            Docs
          </button>
        </div>

        <div className="sidebar-user">
          <div className="avatar">{user.email ? user.email.charAt(0).toUpperCase() : 'U'}</div>
          <div>
            <p>{user.email}</p>
            <span>Secure Plan</span>
          </div>
        </div>

        <button className="logout" onClick={() => signOut(auth)}>
          Log Out
        </button>
      </aside>

      <main className="dashboard-main">{activeTab === 'keys' ? <KeysView user={user} /> : <DocsView />}</main>
    </div>
  );
}

function KeysView({ user }: { user: User }) {
  const [keys, setKeys] = useState<ApiKeyDoc[]>([]);
  const [newKeyData, setNewKeyData] = useState<ApiKeyDoc | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    const qWhere = query(collection(db, 'api_keys'), where('user_id', '==', user.uid));

    const unsub = onSnapshot(qWhere, (snapshot) => {
      const data = snapshot.docs
        .map((docItem) => coerceKeyDoc(docItem.id, docItem.data() as Record<string, unknown>))
        .sort((a, b) => b.created_at - a.created_at);
      setKeys(data);
    });

    return unsub;
  }, [user.uid]);

  const stats = useMemo(
    () => ({
      total: keys.length,
      active: keys.filter((item) => item.status === 'active').length,
      revoked: keys.filter((item) => item.status === 'revoked').length,
      requestsToday: keys.reduce((sum, item) => sum + Math.max(0, item.requests_today), 0),
      remainingToday: keys.reduce((sum, item) => {
        if (item.daily_limit <= 0) return sum;
        return sum + Math.max(0, item.daily_limit - item.requests_today);
      }, 0),
    }),
    [keys],
  );

  return (
    <>
      <header className="view-header">
        <div>
          <h2>EG API Keys</h2>
          <p>Manage generation tokens with strict operational control.</p>
        </div>
        <button
          onClick={() => setShowCreateForm((value) => !value)}
          className={showCreateForm ? 'outline' : ''}
        >
          {showCreateForm ? 'Cancel' : '+ Create New Key'}
        </button>
      </header>

      <div className="view-content">
        {newKeyData && (
          <div className="success-banner reveal-up">
            <div className="success-icon">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p>New secure key created</p>
              <code>{newKeyData.key}</code>
            </div>
            <div className="success-actions">
              <button onClick={() => navigator.clipboard.writeText(newKeyData.key)}>Copy</button>
              <button onClick={() => setNewKeyData(null)}>Dismiss</button>
            </div>
          </div>
        )}

        <div className="stats-grid">
          <StatCard label="Total Keys" value={stats.total} />
          <StatCard label="Active Keys" value={stats.active} />
          <StatCard label="Requests Today" value={stats.requestsToday} />
          <StatCard label="Remaining Today" value={stats.remainingToday} />
          <StatCard label="Revoked" value={stats.revoked} danger />
        </div>

        {showCreateForm && (
          <CreateKeyForm
            user={user}
            onSuccess={(data) => {
              setNewKeyData(data);
              setShowCreateForm(false);
            }}
          />
        )}

        <div className="table-card reveal-up-delay">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name & Project</th>
                  <th>Key</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Usage Today</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((item) => (
                  <KeyRow key={item.id} item={item} />
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      <Fingerprint className="w-8 h-8" />
                      <p>No API keys yet. Create one to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="stat-card reveal-up">
      <p>{label}</p>
      <strong className={danger ? 'danger' : ''}>{value}</strong>
    </div>
  );
}

function CreateKeyForm({ user, onSuccess }: { user: User; onSuccess: (data: ApiKeyDoc) => void }) {
  const [name, setName] = useState('');
  const [project, setProject] = useState('');
  const [limit, setLimit] = useState<number>(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanedName = normalizeLabel(name);
    const cleanedProject = normalizeLabel(project);

    if (!cleanedName || !cleanedProject) {
      setError('Key name and project name are required.');
      return;
    }

    if (cleanedName.length > MAX_TEXT_LENGTH || cleanedProject.length > MAX_TEXT_LENGTH) {
      setError('Key name and project name must be 64 characters or less.');
      return;
    }

    setLoading(true);
    try {
      const generatedKey = generateSecureApiKey();

      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0);

      const docData: Omit<ApiKeyDoc, 'id'> = {
        user_id: user.uid,
        key: generatedKey,
        name: cleanedName,
        project: cleanedProject,
        permissions: [],
        daily_limit: limit,
        requests_today: 0,
        limit_reset_at: nextMidnight.getTime(),
        status: 'active',
        created_at: Date.now(),
      };

      const createdRef = await addDoc(collection(db, 'api_keys'), docData);
      onSuccess({ id: createdRef.id, ...docData });
      setName('');
      setProject('');
      setLimit(200);
    } catch {
      setError('Could not create key right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-form reveal-up">
      <div className="form-header">
        <h3>Configure Secure Key</h3>
        <p>All keys are generated with browser cryptographic randomness.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="form-grid">
        <div>
          <label>Key Name</label>
          <input
            required
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Production Pipeline"
            maxLength={MAX_TEXT_LENGTH}
          />
        </div>

        <div>
          <label>Project Name</label>
          <input
            required
            type="text"
            value={project}
            onChange={(event) => setProject(event.target.value)}
            placeholder="eg-video-engine"
            maxLength={MAX_TEXT_LENGTH}
          />
        </div>

        <div>
          <label>Daily Quota Limit</label>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} requests
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate API Key'}
        </button>
      </div>
    </form>
  );
}

function KeyRow({ item }: { item: ApiKeyDoc; key?: React.Key }) {
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState<'revoke' | 'delete' | null>(null);

  const displayKey = revealed ? item.key : maskApiKey(item.key);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.key);
  };

  const handleRevoke = async () => {
    try {
      await updateDoc(doc(db, 'api_keys', item.id), { status: 'revoked' });
      setConfirming(null);
    } catch {
      setConfirming(null);
    }
  };

  const handleResume = async () => {
    try {
      await updateDoc(doc(db, 'api_keys', item.id), { status: 'active' });
      setConfirming(null);
    } catch {
      setConfirming(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'api_keys', item.id));
      setConfirming(null);
    } catch {
      setConfirming(null);
    }
  };

  const isRevoked = item.status === 'revoked';
  const usagePercent = item.daily_limit > 0 ? Math.min(100, (item.requests_today / item.daily_limit) * 100) : 0;
  const remainingToday = item.daily_limit > 0 ? Math.max(0, item.daily_limit - item.requests_today) : 0;

  return (
    <tr className={isRevoked ? 'row-revoked' : ''}>
      <td>
        <p className="table-title">{item.name}</p>
        <p className="table-subtitle">{item.project}</p>
      </td>
      <td>
        <div className="key-wrap">
          <code>{displayKey}</code>
          <button onClick={() => setRevealed((value) => !value)} title="Reveal">
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={handleCopy} title="Copy">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td>
        <div className="status-wrap">
          <span className={isRevoked ? 'dot revoked' : 'dot active'} />
          <span>{isRevoked ? 'Revoked' : 'Active'}</span>
        </div>
        {!isRevoked && (
          <div className="progress-line">
            <div style={{ width: `${usagePercent}%` }} />
          </div>
        )}
      </td>
      <td className="usage-cell">
        <p className="usage-main">
          {Math.max(0, item.requests_today)} / {Math.max(0, item.daily_limit)}
        </p>
        <p className="usage-sub">{remainingToday} remaining</p>
      </td>
      <td>{safeDate(item.created_at)}</td>
      <td>
        {confirming === 'revoke' ? (
          <div className="confirm-actions">
            <span>Revoke?</span>
            <button onClick={handleRevoke}>Yes</button>
            <button onClick={() => setConfirming(null)}>No</button>
          </div>
        ) : confirming === 'delete' ? (
          <div className="confirm-actions">
            <span>Delete?</span>
            <button onClick={handleDelete}>Yes</button>
            <button onClick={() => setConfirming(null)}>No</button>
          </div>
        ) : (
          <div className="row-actions">
            {!isRevoked ? (
              <button onClick={() => setConfirming('revoke')}>Revoke</button>
            ) : (
              <button onClick={handleResume}>Resume</button>
            )}
            <button onClick={() => setConfirming('delete')}>Delete</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function DocsView() {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Create a cinematic drone shot of Cairo at sunrise.');
  const [mode, setMode] = useState<GenerateMode>('video');
  const [imageUrl, setImageUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [output, setOutput] = useState('Run a request to preview API responses here.');
  const [loadingAction, setLoadingAction] = useState<'generate' | 'download' | null>(null);

  const runGenerate = async () => {
    setLoadingAction('generate');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          prompt,
          mode,
          ...(mode === 'image_to_video' ? { image_url: imageUrl.trim() } : {}),
        }),
      });

      const data = await response.json();
      if (data?.job_id) {
        setJobId(String(data.job_id));
      }
      setOutput(JSON.stringify(data, null, 2));
    } catch {
      setOutput(JSON.stringify({ success: false, message: 'Failed to call /api/generate.' }, null, 2));
    } finally {
      setLoadingAction(null);
    }
  };

  const runDownload = async () => {
    setLoadingAction('download');
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ job_id: jobId.trim() }),
      });

      const data = await response.json();
      setOutput(JSON.stringify(data, null, 2));
    } catch {
      setOutput(JSON.stringify({ success: false, message: 'Failed to call /api/download.' }, null, 2));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <header className="view-header">
        <div>
          <h2>API Documentation</h2>
          <p>Use secure Bearer tokens from EG Autonomous dashboard.</p>
        </div>
      </header>

      <div className="view-content">
        <div className="docs-card reveal-up">
          <h4>
            <ShieldCheck className="w-4 h-4" />
            POST /api/generate
          </h4>
          <p>Queue generation task with mode support: text, image, video, image_to_video.</p>

          <pre>{`curl -X POST https://eg-autonomous.vercel.app/api/generate \\
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Create a cinematic launch video for EG Autonomous",
    "mode": "video"
  }'`}</pre>

          <pre>{`curl -X POST https://eg-autonomous.vercel.app/api/generate \\
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Create a futuristic city poster for EG Autonomous",
    "mode": "image"
  }'`}</pre>

          <pre>{`curl -X POST https://eg-autonomous.vercel.app/api/generate \\
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Animate this image",
    "mode": "image_to_video",
    "image_url": "https://example.com/image.jpg"
  }'`}</pre>

          <h4>
            <ShieldCheck className="w-4 h-4" />
            POST /api/download
          </h4>
          <p>Poll by job ID until state becomes completed or failed.</p>

          <pre>{`curl -X POST https://eg-autonomous.vercel.app/api/download \\
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "268c2294-98c9-44ab-9482-3915a03f794b"
  }'`}</pre>

          <h4>
            <ShieldCheck className="w-4 h-4" />
            Internal Endpoints
          </h4>
          <p>
            <code>/api/set-cookies</code> is admin-protected for Meta cookie updates. <code>/api/received-video</code> is a
            secured callback endpoint for your automation worker.
          </p>
        </div>

        <div className="docs-card reveal-up-delay">
          <h4>
            <ShieldCheck className="w-4 h-4" />
            API Playground
          </h4>
          <p>Use this section to test your key and endpoints directly from the dashboard.</p>

          <div className="playground-grid">
            <div>
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="eg_xxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div>
              <label>Prompt</label>
              <input
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe your video idea"
              />
            </div>
            <div>
              <label>Mode</label>
              <select value={mode} onChange={(event) => setMode(event.target.value as GenerateMode)}>
                <option value="video">video</option>
                <option value="image">image</option>
                <option value="text">text</option>
                <option value="image_to_video">image_to_video</option>
              </select>
            </div>
            {mode === 'image_to_video' && (
              <div>
                <label>Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}
            <div>
              <label>Job ID</label>
              <input
                type="text"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder="Returned from /api/generate"
              />
            </div>
          </div>

          <div className="playground-actions">
            <button
              onClick={runGenerate}
              disabled={
                loadingAction !== null ||
                apiKey.trim().length < 10 ||
                prompt.trim().length < 3 ||
                (mode === 'image_to_video' && imageUrl.trim().length < 10)
              }
            >
              {loadingAction === 'generate' ? 'Generating...' : 'Test Generate'}
            </button>
            <button
              onClick={runDownload}
              disabled={loadingAction !== null || apiKey.trim().length < 10 || jobId.trim().length < 8}
              className="secondary"
            >
              {loadingAction === 'download' ? 'Polling...' : 'Test Download'}
            </button>
          </div>

          <pre>{output}</pre>
        </div>
      </div>
    </>
  );
}
