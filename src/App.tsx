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
import { Check, Copy, Eye, EyeOff, Fingerprint, KeyRound, Play, ShieldCheck, Video } from 'lucide-react';
import { format } from 'date-fns';

type AuthMode = 'login' | 'register';
type ApiKeyStatus = 'active' | 'revoked';
type GenerateMode = 'image' | 'video' | 'image_to_video';
type AppSection = 'generate' | 'docs' | 'keys';

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

type MediaItem = {
  url: string;
  kind: 'image' | 'video' | 'unknown';
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

const looksLikeUrl = (value: string) => /^https?:\/\//i.test(value);

const detectMediaKind = (url: string): MediaItem['kind'] => {
  const lower = url.toLowerCase();
  if (lower.includes('type=video') || /\.(mp4|mov|webm)(\?|$)/.test(lower)) return 'video';
  if (lower.includes('type=image') || /\.(png|jpg|jpeg|gif|webp)(\?|$)/.test(lower)) return 'image';
  return 'unknown';
};

const extractMediaUrls = (payload: unknown): MediaItem[] => {
  const collected = new Set<string>();

  const walk = (node: unknown) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (looksLikeUrl(node)) collected.add(node);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item) => walk(item));
      return;
    }

    if (typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach((item) => walk(item));
    }
  };

  walk(payload);

  return Array.from(collected).map((url) => ({ url, kind: detectMediaKind(url) }));
};

export default function App() {
  const [section, setSection] = useState<AppSection>('generate');
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
          <span>Preparing API Playground...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="left-nav">
        <div className="left-brand">
          <img src={brandImage} alt="EG Autonomous" />
          <div>
            <p>EG Autonomous</p>
            <span>Video API Platform</span>
          </div>
        </div>

        <nav className="left-links">
          <button className={section === 'generate' ? 'active' : ''} onClick={() => setSection('generate')}>
            Generate Studio
          </button>
          <button className={section === 'docs' ? 'active' : ''} onClick={() => setSection('docs')}>
            API Docs
          </button>
          <button className={section === 'keys' ? 'active' : ''} onClick={() => setSection('keys')}>
            Key Console
          </button>
        </nav>

        <div className="left-auth">
          {user ? (
            <>
              <p>{user.email}</p>
              <button onClick={() => signOut(auth)}>Log out</button>
            </>
          ) : (
            <button onClick={() => setSection('keys')}>Sign in to manage keys</button>
          )}
        </div>
      </aside>

      <main className="main-stage">
        {section === 'generate' && <GenerateStudioView user={user} onOpenKeyConsole={() => setSection('keys')} />}
        {section === 'docs' && <ApiDocsView />}
        {section === 'keys' && (user ? <KeysView user={user} /> : <AuthScreen />)}
      </main>
    </div>
  );
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
    <section className="panel auth-panel">
      <h2>Key Console Access</h2>
      <p>Sign in to create and manage secure API keys.</p>
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
    </section>
  );
}

function GenerateStudioView({ user, onOpenKeyConsole }: { user: User | null; onOpenKeyConsole: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Create a cinematic drone shot of Cairo at sunrise.');
  const [mode, setMode] = useState<GenerateMode>('video');
  const [imageUrl, setImageUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [output, setOutput] = useState('Run a request to preview API responses here.');
  const [lastPayload, setLastPayload] = useState<unknown>(null);
  const [loadingAction, setLoadingAction] = useState<'generate' | 'download' | null>(null);
  const [runStatus, setRunStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [runMessage, setRunMessage] = useState('Ready to run generation.');
  const [barDocked, setBarDocked] = useState(false);
  const [galleryItems, setGalleryItems] = useState<MediaItem[]>([]);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenSourceUrl, setRegenSourceUrl] = useState('');
  const [regenPrompt, setRegenPrompt] = useState('Create a stronger cinematic variation.');
  const [activeRegenSourceUrl, setActiveRegenSourceUrl] = useState('');
  const [userKeys, setUserKeys] = useState<ApiKeyDoc[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keyPromptOpen, setKeyPromptOpen] = useState(false);

  const mediaItems = useMemo(() => galleryItems, [galleryItems]);
  const latestImage = useMemo(() => mediaItems.find((item) => item.kind === 'image')?.url ?? '', [mediaItems]);

  useEffect(() => {
    if (!user) {
      setUserKeys([]);
      setApiKey('');
      return;
    }

    setLoadingKeys(true);
    const qWhere = query(collection(db, 'api_keys'), where('user_id', '==', user.uid));
    const unsub = onSnapshot(
      qWhere,
      (snapshot) => {
        const keys = snapshot.docs
          .map((docItem) => coerceKeyDoc(docItem.id, docItem.data() as Record<string, unknown>))
          .filter((item) => item.status === 'active')
          .sort((a, b) => b.created_at - a.created_at);

        setUserKeys(keys);
        setApiKey((currentKey) => (keys.some((item) => item.key === currentKey) ? currentKey : keys[0]?.key ?? ''));
        setLoadingKeys(false);
      },
      () => {
        setUserKeys([]);
        setLoadingKeys(false);
      },
    );

    return unsub;
  }, [user]);

  const parseState = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    const candidates = [record.state, record.status, record.job_status, record.phase];
    const firstText = candidates.find((item) => typeof item === 'string');
    return typeof firstText === 'string' ? firstText.toLowerCase() : '';
  };

  const parseErrorMessage = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    const candidates = [record.error, record.reason, record.error_message];
    const firstText = candidates.find((item) => typeof item === 'string');
    return typeof firstText === 'string' ? firstText : '';
  };

  const pollForResult = async (nextJobId: string) => {
    const waitMs = 3000;
    let attempt = 1;
    setRunStatus('queued');
    setRunMessage('Job queued. Waiting for generation result...');

    while (true) {
      try {
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({ job_id: nextJobId }),
        });

        const data = await response.json();
        setLastPayload(data);
        setOutput(JSON.stringify(data, null, 2));

        const state = parseState(data);
        const successValue =
          typeof data === 'object' && data && 'success' in (data as Record<string, unknown>)
            ? Boolean((data as Record<string, unknown>).success)
            : undefined;
        const hasMedia = extractMediaUrls(data).length > 0;
        const hasError =
          state.includes('fail') ||
          state.includes('error') ||
          successValue === false ||
          Boolean(parseErrorMessage(data));

        if (hasError) {
          setRunStatus('failed');
          setRunMessage(parseErrorMessage(data) || 'Generation failed. Please inspect the response JSON.');
          setActiveRegenSourceUrl('');
          return;
        }

        if (hasMedia || state.includes('complete') || state.includes('success') || state.includes('done')) {
          const nextMedia = extractMediaUrls(data);
          if (nextMedia.length > 0) {
            setGalleryItems((prev) => {
              const merged = [...prev];
              nextMedia.forEach((nextItem) => {
                if (!merged.some((existing) => existing.url === nextItem.url)) merged.push(nextItem);
              });
              return merged;
            });
          }
          setRunStatus('completed');
          setRunMessage('Generation completed. All available media items are shown below.');
          setActiveRegenSourceUrl('');
          return;
        }

        setRunStatus('processing');
        setRunMessage(`Processing... polling attempt ${attempt}`);
      } catch {
        setRunStatus('failed');
        setRunMessage('Auto polling failed while calling /api/download.');
        setActiveRegenSourceUrl('');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs));
      attempt += 1;
    }
  };

  const runGenerate = async () => {
    if (!apiKey.trim()) {
      setKeyPromptOpen(true);
      return;
    }

    setLoadingAction('generate');
    setRunStatus('idle');
    setRunMessage('Starting generation...');
    setBarDocked(true);
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
      setLastPayload(data);
      if (data?.job_id) {
        const nextJobId = String(data.job_id);
        setJobId(nextJobId);
        setOutput(JSON.stringify(data, null, 2));
        setLoadingAction(null);
        await pollForResult(nextJobId);
        return;
      }
      setRunStatus('failed');
      setRunMessage('No job ID returned from /api/generate.');
      setOutput(JSON.stringify(data, null, 2));
    } catch {
      const fallback = { success: false, message: 'Failed to call /api/generate.' };
      setLastPayload(fallback);
      setRunStatus('failed');
      setRunMessage('Failed to start generation.');
      setOutput(JSON.stringify(fallback, null, 2));
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
      setLastPayload(data);
      setRunMessage('Manual /api/download response received.');
      setOutput(JSON.stringify(data, null, 2));
    } catch {
      const fallback = { success: false, message: 'Failed to call /api/download.' };
      setLastPayload(fallback);
      setOutput(JSON.stringify(fallback, null, 2));
    } finally {
      setLoadingAction(null);
    }
  };

  const openRegen = (sourceUrl: string) => {
    setRegenSourceUrl(sourceUrl);
    setRegenPrompt('Create a stronger cinematic variation.');
    setRegenOpen(true);
  };

  const runRegenerate = async () => {
    if (!regenSourceUrl.trim() || !regenPrompt.trim()) return;
    if (!apiKey.trim()) {
      setKeyPromptOpen(true);
      return;
    }

    setRegenOpen(false);
    setMode('image_to_video');
    setImageUrl(regenSourceUrl.trim());
    setPrompt(regenPrompt.trim());
    setActiveRegenSourceUrl(regenSourceUrl.trim());
    setBarDocked(true);
    setLoadingAction('generate');
    setRunStatus('queued');
    setRunMessage('Creating a new variant...');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          prompt: regenPrompt.trim(),
          mode: 'image_to_video',
          image_url: regenSourceUrl.trim(),
        }),
      });

      const data = await response.json();
      setLastPayload(data);
      if (data?.job_id) {
        const nextJobId = String(data.job_id);
        setJobId(nextJobId);
        await pollForResult(nextJobId);
        return;
      }

      setRunStatus('failed');
      setRunMessage('No job ID returned from regenerate request.');
      setActiveRegenSourceUrl('');
    } catch {
      setRunStatus('failed');
      setRunMessage('Failed to start regenerate request.');
      setActiveRegenSourceUrl('');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <section className="studio-shell">
      <img src={brandImage} alt="Studio background" className="studio-bg" />
      <div className="studio-overlay" />

      <div className={`studio-center ${barDocked ? 'studio-center-docked' : ''}`}>
        <h1>YOURS TO CREATE</h1>

        <div className={`studio-bar ${barDocked ? 'studio-bar-docked' : ''}`}>
          {userKeys.length > 0 ? (
            <select value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="key-input key-select">
              {userKeys.map((item) => (
                <option key={item.id} value={item.key}>
                  {item.name || item.project || 'API Key'}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" className="key-input key-select-empty" onClick={onOpenKeyConsole}>
              {loadingKeys ? 'Loading keys...' : user ? 'Create API key' : 'Sign in for API key'}
            </button>
          )}
          <input
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Type a prompt..."
            className="prompt-input"
          />
          <button
            onClick={runGenerate}
            disabled={
              loadingAction !== null ||
              prompt.trim().length < 3 ||
              (mode === 'image_to_video' && imageUrl.trim().length < 10)
            }
          >
            {loadingAction === 'generate' ? 'Generating...' : 'Generate'}
          </button>
        </div>

        <div className="studio-modes">
          {(['image', 'video', 'image_to_video'] as GenerateMode[]).map((itemMode) => (
            <button
              key={itemMode}
              className={mode === itemMode ? 'active' : ''}
              onClick={() => setMode(itemMode)}
              type="button"
            >
              {itemMode}
            </button>
          ))}
        </div>

        {mode === 'image_to_video' && (
          <div className="studio-image-url">
            <input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Image URL for image_to_video"
            />
            <button type="button" className="secondary" disabled={!latestImage} onClick={() => setImageUrl(latestImage)}>
              Use latest image
            </button>
          </div>
        )}

        <div className={`run-status status-${runStatus}`}>
          <span className="dot-pulse" />
          <strong>{runStatus.toUpperCase()}</strong>
          <span>{runMessage}</span>
        </div>

        <div className="studio-results">
          {runStatus !== 'completed' && (runStatus === 'queued' || runStatus === 'processing') && (
            <div className="loading-stage">
              <div className="ring" />
              <p>Generating... please wait</p>
            </div>
          )}

          {runStatus === 'failed' && (
            <div className="error-stage">
              <p>{runMessage}</p>
            </div>
          )}

          {mediaItems.length > 0 && (
            <div className="media-grid">
              {mediaItems.map((item) => (
                <article key={item.url} className="media-item">
                  {item.kind === 'video' ? (
                    <video controls src={item.url} preload="metadata" />
                  ) : item.kind === 'image' ? (
                    <img src={item.url} alt="Generated result" loading="lazy" />
                  ) : (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open media URL
                    </a>
                  )}
                  {activeRegenSourceUrl === item.url && (runStatus === 'queued' || runStatus === 'processing') && (
                    <div className="card-loading">Regenerating...</div>
                  )}
                  <button type="button" className="regen-btn" onClick={() => openRegen(item.url)}>
                    Re-generate
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        {regenOpen && (
          <div className="regen-modal-backdrop" role="dialog" aria-modal="true">
            <div className="regen-modal">
              <h3>Re-generate Variant</h3>
              <label>Source URL</label>
              <input value={regenSourceUrl} readOnly />
              <label>New Prompt</label>
              <input value={regenPrompt} onChange={(event) => setRegenPrompt(event.target.value)} />
              <div className="regen-actions">
                <button type="button" className="secondary" onClick={() => setRegenOpen(false)}>
                  Cancel
                </button>
                <button type="button" onClick={runRegenerate} disabled={loadingAction !== null}>
                  Generate Variant
                </button>
              </div>
            </div>
          </div>
        )}

        {keyPromptOpen && (
          <div className="regen-modal-backdrop" role="dialog" aria-modal="true">
            <div className="regen-modal">
              <h3>Create API key first</h3>
              <p className="modal-copy">You need an active API key before generating media.</p>
              <div className="regen-actions">
                <button type="button" className="secondary" onClick={() => setKeyPromptOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKeyPromptOpen(false);
                    onOpenKeyConsole();
                  }}
                >
                  Create API Key
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

function ApiDocsView() {
  return (
    <div className="docs-layout">
      <section className="panel docs-panel">
        <h2>
          <ShieldCheck size={18} /> API Docs
        </h2>
        <p>Use Bearer API keys from Key Console. Base URL is your Vercel domain.</p>
        <div className="docs-grid">
          <article className="panel-lite">
            <h4>POST /api/generate</h4>
            <p>Start a generation job and get a `job_id`.</p>
            <pre>{`{
  "prompt": "Create a premium ad shot",
  "mode": "video",
  "image_url": "https://example.com/image.jpg"
}`}</pre>
            <pre>{`{
  "success": true,
  "job_id": "uuid",
  "status": "queued"
}`}</pre>
          </article>
          <article className="panel-lite">
            <h4>POST /api/download</h4>
            <p>Poll by `job_id` until completed or failed.</p>
            <pre>{`{
  "job_id": "uuid"
}`}</pre>
            <pre>{`{
  "success": true,
  "status": "completed",
  "videos": ["https://..."],
  "images": ["https://..."]
}`}</pre>
          </article>
          <article className="panel-lite">
            <h4>GET /api/media</h4>
            <p>Use signed URLs returned from download responses.</p>
            <pre>{`GET /api/media?job_id=<id>&type=video&index=1&exp=<ts>&sig=<hash>`}</pre>
          </article>
          <article className="panel-lite">
            <h4>Best Practice Flow</h4>
            <pre>{`1) Generate -> store job_id
2) Poll every 2-4s
3) Stop on completed/failed
4) Render all returned media`}</pre>
          </article>
        </div>
      </section>
      <DocsPlaygroundCard />
    </div>
  );
}

function DocsPlaygroundCard() {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Create a fashion cinematic intro.');
  const [mode, setMode] = useState<GenerateMode>('video');
  const [imageUrl, setImageUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [loadingAction, setLoadingAction] = useState<'generate' | 'download' | null>(null);
  const [output, setOutput] = useState('Run a request to preview response JSON.');

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
      if (data?.job_id) setJobId(String(data.job_id));
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
    <section className="panel docs-panel">
      <h2>Docs Playground</h2>
      <p>Manual technical tester for request body and raw JSON responses.</p>
      <div className="playground-grid">
        <div>
          <label>API Key</label>
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="eg_xxx" />
        </div>
        <div>
          <label>Mode</label>
          <select value={mode} onChange={(event) => setMode(event.target.value as GenerateMode)}>
            <option value="video">video</option>
            <option value="image">image</option>
            <option value="image_to_video">image_to_video</option>
          </select>
        </div>
        <div className="full">
          <label>Prompt</label>
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </div>
        {mode === 'image_to_video' && (
          <div className="full">
            <label>Image URL</label>
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." />
          </div>
        )}
      </div>
      <div className="playground-actions">
        <button onClick={runGenerate} disabled={loadingAction !== null || apiKey.trim().length < 10}>
          {loadingAction === 'generate' ? 'Running...' : 'POST /generate'}
        </button>
        <button
          className="secondary"
          onClick={runDownload}
          disabled={loadingAction !== null || apiKey.trim().length < 10 || jobId.trim().length < 8}
        >
          {loadingAction === 'download' ? 'Running...' : 'POST /download'}
        </button>
      </div>
      <pre>{output}</pre>
    </section>
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
    <section className="panel keys-panel">
      <header className="view-header">
        <div>
          <h2>Key Console</h2>
          <p>Manage generation tokens with strict operational control.</p>
        </div>
        <button onClick={() => setShowCreateForm((value) => !value)} className={showCreateForm ? 'outline' : ''}>
          {showCreateForm ? 'Cancel' : '+ Create New Key'}
        </button>
      </header>

      {newKeyData && (
        <div className="success-banner">
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

      <div className="table-card">
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
    </section>
  );
}

function StatCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="stat-card">
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
    <form onSubmit={handleSubmit} className="create-form">
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
