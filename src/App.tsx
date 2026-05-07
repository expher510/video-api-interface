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
import { Check, Copy, Eye, EyeOff, Fingerprint, KeyRound, Play, ShieldCheck, Video, Zap, Sparkles, Film, ShoppingCart, Megaphone, Share2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Player } from '@remotion/player';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

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
const API_BASE_URL = 'https://eg-autonomous.vercel.app';

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
        <div className={section === 'generate' ? 'stage-view' : 'stage-view hidden'}>
          <GenerateStudioView user={user} onOpenKeyConsole={() => setSection('keys')} />
        </div>
        {section === 'docs' && <ApiDocsView user={user} />}
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
  const [provider, setProvider] = useState<'meta' | 'veo'>('meta');
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait'>('landscape');
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
          provider,
          prompt,
          mode,
          ...(provider === 'veo' ? { aspect_ratio: aspectRatio } : {}),
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
      setRunMessage(data?.message || 'No job ID returned from /api/generate.');
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

        <div className="studio-modes" style={{ marginBottom: '8px' }}>
          <button
            className={provider === 'meta' ? 'active' : ''}
            onClick={() => setProvider('meta')}
            type="button"
          >
            Meta AI
          </button>
          <button
            className={provider === 'veo' ? 'active' : ''}
            onClick={() => {
              setProvider('veo');
              if (mode !== 'video') setMode('video');
            }}
            type="button"
          >
            Veo AI
          </button>
        </div>

        <div className="studio-modes">
          {(['image', 'video', 'image_to_video'] as GenerateMode[])
            .filter((itemMode) => provider === 'meta' || itemMode === 'video')
            .map((itemMode) => (
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

        {provider === 'veo' && (
          <div className="studio-modes" style={{ marginTop: '8px' }}>
            <button
              className={aspectRatio === 'landscape' ? 'active' : ''}
              onClick={() => setAspectRatio('landscape')}
              type="button"
            >
              Landscape (16:9)
            </button>
            <button
              className={aspectRatio === 'portrait' ? 'active' : ''}
              onClick={() => setAspectRatio('portrait')}
              type="button"
            >
              Portrait (9:16)
            </button>
          </div>
        )}

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
                <article key={item.url} className={`media-item ${provider === 'veo' ? aspectRatio : 'landscape'}`}>
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
                  {provider === 'meta' && (
                    <button type="button" className="regen-btn" onClick={() => openRegen(item.url)}>
                      Re-generate
                    </button>
                  )}
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

function ApiDocsView({ user }: { user: User | null }) {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    const seenTutorial = window.localStorage.getItem('eg-n8n-tutorial-seen');
    if (!seenTutorial) {
      setTutorialOpen(true);
    }
  }, []);

  const closeTutorial = () => {
    window.localStorage.setItem('eg-n8n-tutorial-seen', 'true');
    setTutorialOpen(false);
  };

  return (
    <div className="docs-layout">
      <section className="panel docs-panel">
        {/* Documentation Header */}
        <div className="docs-header">
          <div className="docs-header-icon">
            <Zap size={24} />
          </div>
          <div className="docs-header-content">
            <h1>API Documentation</h1>
            <p>Powerful, scalable video generation API for developers. Create stunning videos, images, and video transformations in seconds using our cutting-edge AI models.</p>
          </div>
        </div>

        {/* Quick Start Section */}
        <div className="quickstart-section">
          <h3>Quick Start in 3 Steps</h3>
          <div className="quickstart-steps">
            <div className="quickstart-step">
              <div className="step-number">1</div>
              <h4>Get API Key</h4>
              <p>Create a free account and generate your Bearer token from the Key Console.</p>
            </div>
            <div className="quickstart-step">
              <div className="step-number">2</div>
              <h4>Send Request</h4>
              <p>POST to /api/generate with your prompt and desired mode (video, image, or transform).</p>
            </div>
            <div className="quickstart-step">
              <div className="step-number">3</div>
              <h4>Poll Results</h4>
              <p>Use /api/download with the returned job_id to check status and retrieve files.</p>
            </div>
          </div>
        </div>

        {/* Production Base URL */}
        <div className="base-url-card">
          <span>Production Base URL</span>
          <code>{API_BASE_URL}</code>
        </div>

        {/* Tutorial Button */}
        <button type="button" className="tutorial-launch-card" onClick={() => setTutorialOpen(true)}>
          <Video size={16} /> Watch n8n Integration Tutorial
        </button>

        {/* Endpoint 1: Generate */}
        <div className="endpoint-card">
          <div className="endpoint-header">
            <div className="endpoint-method post">POST</div>
            <div className="endpoint-path">
              <h3>/api/generate</h3>
              <p>Initiate a new video, image, or video transformation request</p>
            </div>
          </div>

          <div className="provider-badges">
            <span className="provider-badge meta">
              <Sparkles size={14} /> Meta AI
            </span>
            <span className="provider-badge veo">
              <Sparkles size={14} /> Veo AI
            </span>
          </div>

          {/* Parameters */}
          <div className="params-section">
            <h4>Request Body Parameters</h4>
            <div className="param-list">
              <div className="param-item">
                <div>
                  <div className="param-name">provider <span className="param-required">required</span></div>
                  <div className="param-description">AI provider for generation</div>
                </div>
                <span className="param-type">enum</span>
              </div>
              <div className="param-item">
                <div>
                  <div className="param-name">mode <span className="param-required">required</span></div>
                  <div className="param-description">Generation type: video, image, or image_to_video (Veo supports video only)</div>
                </div>
                <span className="param-type">enum</span>
              </div>
              <div className="param-item">
                <div>
                  <div className="param-name">prompt <span className="param-required">required</span></div>
                  <div className="param-description">Detailed text description of desired output. Be specific for best results.</div>
                </div>
                <span className="param-type">string</span>
              </div>
              <div className="param-item">
                <div>
                  <div className="param-name">aspect_ratio</div>
                  <div className="param-description">Output aspect ratio (landscape or portrait). Veo AI only. Default: landscape</div>
                </div>
                <span className="param-type">enum</span>
              </div>
              <div className="param-item">
                <div>
                  <div className="param-name">image_url</div>
                  <div className="param-description">Source image URL for image_to_video mode. Meta AI only, required when mode is image_to_video.</div>
                </div>
                <span className="param-type">string</span>
              </div>
            </div>
          </div>

          {/* Status Codes */}
          <div className="status-codes">
            <h4>Response Status Codes</h4>
            <div className="status-list">
              <div className="status-item success">
                <span className="status-code">200</span>
                <span className="status-description">Successfully queued generation job</span>
              </div>
              <div className="status-item info">
                <span className="status-code">400</span>
                <span className="status-description">Invalid parameters or missing required fields</span>
              </div>
              <div className="status-item error">
                <span className="status-code">401</span>
                <span className="status-description">Invalid or expired API key</span>
              </div>
              <div className="status-item error">
                <span className="status-code">429</span>
                <span className="status-description">Rate limit exceeded</span>
              </div>
            </div>
          </div>

          {/* Code Examples */}
          <div className="code-examples-section">
            <h4>Code Examples</h4>
            
            <div className="code-example">
              <h5>Veo AI: Cinematic Video</h5>
              <pre>{`curl -X POST ${API_BASE_URL}/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "veo",
    "mode": "video",
    "aspect_ratio": "landscape",
    "prompt": "A futuristic drone shot flying through a neon-lit cyberpunk cityscape at night"
  }'`}</pre>
            </div>

            <div className="code-example">
              <h5>Meta AI: Image to Video</h5>
              <pre>{`curl -X POST ${API_BASE_URL}/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "meta",
    "mode": "image_to_video",
    "image_url": "https://example.com/landscape.jpg",
    "prompt": "The landscape comes alive with weather effects - rain starts falling, wind moves trees"
  }'`}</pre>
            </div>
          </div>
        </div>

        {/* Endpoint 2: Download */}
        <div className="endpoint-card">
          <div className="endpoint-header">
            <div className="endpoint-method post">POST</div>
            <div className="endpoint-path">
              <h3>/api/download</h3>
              <p>Poll generation status and retrieve completed media files</p>
            </div>
          </div>

          {/* Parameters */}
          <div className="params-section">
            <h4>Request Body Parameters</h4>
            <div className="param-list">
              <div className="param-item">
                <div>
                  <div className="param-name">job_id <span className="param-required">required</span></div>
                  <div className="param-description">Unique identifier returned from /api/generate endpoint. Use this to track your generation job.</div>
                </div>
                <span className="param-type">string</span>
              </div>
            </div>
          </div>

          {/* Status Codes */}
          <div className="status-codes">
            <h4>Response Status Codes</h4>
            <div className="status-list">
              <div className="status-item success">
                <span className="status-code">200</span>
                <span className="status-description">Job status retrieved (queued, processing, completed, or failed)</span>
              </div>
              <div className="status-item info">
                <span className="status-code">404</span>
                <span className="status-description">Job ID not found</span>
              </div>
              <div className="status-item error">
                <span className="status-code">401</span>
                <span className="status-description">Invalid or expired API key</span>
              </div>
            </div>
          </div>

          {/* Code Examples */}
          <div className="code-examples-section">
            <h4>Code Example</h4>
            <pre>{`curl -X POST ${API_BASE_URL}/api/download \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "abc123def456"
  }'

# Response when completed:
{
  "success": true,
  "status": "completed",
  "videos": ["https://cdn.example.com/video_12345.mp4"],
  "images": ["https://cdn.example.com/image_12345.png"]
}`}</pre>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="usecases-section">
          <div className="usecases-header">
            <h2>Real-World Use Cases</h2>
            <p className="usecases-subtitle">Explore comprehensive examples for common and advanced scenarios</p>
          </div>

          {/* E-Commerce Use Case */}
          <div className="usecase-detailed">
            <div className="usecase-card">
              <div className="usecase-header">
                <div className="usecase-icon">
                  <ShoppingCart size={18} />
                </div>
                <h4 className="usecase-title">E-Commerce Product Showcase</h4>
              </div>
              <div className="usecase-body">
                <p className="usecase-description">Generate product showcase videos automatically for your catalog. Create engaging demonstrations that increase conversion rates and reduce return rates. Perfect for scaling video production across thousands of SKUs.</p>
                
                <div className="usecase-subsection">
                  <h5>Basic Example: Fashion Product Video</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "veo",
    "mode": "video",
    "aspect_ratio": "landscape",
    "prompt": "Luxury designer sneaker product showcase. Rotating 360 view on clean white background with soft lighting, showing details of materials and craftsmanship"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Advanced Example: Image-to-Video Product Animation</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "meta",
    "mode": "image_to_video",
    "image_url": "https://cdn.example.com/products/handbag-main.jpg",
    "prompt": "Animate the leather texture with subtle movement, showcase the clasp opening and closing, show interior compartments. Professional product photography style"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Code Integration Example (Node.js)</h5>
                  <pre>{`const generateProductVideo = async (product) => {
  const response = await fetch('https://api.example.com/api/generate', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      provider: 'veo',
      mode: 'video',
      aspect_ratio: 'landscape',
      prompt: \`\${product.name} - \${product.description}. Professional showcase with \${product.features.join(', ')}\`
    })
  });
  
  const { job_id } = await response.json();
  
  // Poll for completion
  let completed = false;
  while (!completed) {
    const statusRes = await fetch('https://api.example.com/api/download', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.API_KEY}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ job_id })
    });
    
    const { status, videos } = await statusRes.json();
    if (status === 'completed') {
      return videos[0];
    }
    
    await new Promise(r => setTimeout(r, 5000));
  }
};`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Entertainment Use Case */}
          <div className="usecase-detailed">
            <div className="usecase-card">
              <div className="usecase-header">
                <div className="usecase-icon">
                  <Film size={18} />
                </div>
                <h4 className="usecase-title">Entertainment & Filmmaking</h4>
              </div>
              <div className="usecase-body">
                <p className="usecase-description">Create cinematic trailers, scenes, and visual effects for film projects. Perfect for concept validation, storyboarding, rapid prototyping, and visual effects generation. Speed up pre-production and reduce costs significantly.</p>
                
                <div className="usecase-subsection">
                  <h5>Scene Generation: Action Sequence</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "veo",
    "mode": "video",
    "aspect_ratio": "landscape",
    "prompt": "High-energy superhero action sequence. Multiple explosions, dynamic camera movements, vibrant colors, cinematic lighting. Hero character performing acrobatic combat moves against futuristic backdrop"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Trailer Generation: Movie Teaser</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "veo",
    "mode": "video",
    "aspect_ratio": "landscape",
    "prompt": "Sci-fi thriller movie trailer. Dark atmospheric cityscape with neon lights, mysterious figure in shadows, dramatic music beats synchronized with quick cuts, lens flares, title reveals"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Python Implementation: Batch Scene Generation</h5>
                  <pre>{`import requests
import time
from concurrent.futures import ThreadPoolExecutor

class FilmGenAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.example.com'
    
    def generate_scene(self, scene_description, aspect_ratio='landscape'):
        """Generate a single scene"""
        response = requests.post(
            f'{self.base_url}/api/generate',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'provider': 'veo',
                'mode': 'video',
                'aspect_ratio': aspect_ratio,
                'prompt': scene_description
            }
        )
        return response.json()['job_id']
    
    def poll_result(self, job_id, max_wait=300):
        """Poll until scene is ready"""
        start_time = time.time()
        while time.time() - start_time < max_wait:
            response = requests.post(
                f'{self.base_url}/api/download',
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json'
                },
                json={'job_id': job_id}
            )
            data = response.json()
            
            if data['status'] == 'completed':
                return data['videos'][0]
            
            time.sleep(3)
        
        raise TimeoutError(f'Scene generation timed out for job {job_id}')
    
    def generate_multiple_scenes(self, scenes):
        """Generate multiple scenes in parallel"""
        job_ids = [self.generate_scene(scene) for scene in scenes]
        
        results = {}
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(self.poll_result, jid): jid 
                for jid in job_ids
            }
            for future in futures:
                video_url = future.result()
                results[futures[future]] = video_url
        
        return results

# Usage
api = FilmGenAPI('your_api_key')
scenes = [
    'Establishing shot of dystopian city skyline at sunset',
    'Hero walking through rain-soaked streets with neon reflections',
    'Climactic confrontation with antagonist in abandoned warehouse'
]

videos = api.generate_multiple_scenes(scenes)
for job_id, video_url in videos.items():
    print(f'Scene {job_id}: {video_url}')`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Marketing Use Case */}
          <div className="usecase-detailed">
            <div className="usecase-card">
              <div className="usecase-header">
                <div className="usecase-icon">
                  <Megaphone size={18} />
                </div>
                <h4 className="usecase-title">Marketing & Advertising</h4>
              </div>
              <div className="usecase-body">
                <p className="usecase-description">Generate campaign videos at scale for social media and advertising. Create personalized content for different audience segments without expensive production teams. Reduce time-to-market from weeks to minutes.</p>
                
                <div className="usecase-subsection">
                  <h5>Campaign: Brand Animation</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "meta",
    "mode": "image_to_video",
    "image_url": "https://cdn.example.com/brand-logo.png",
    "prompt": "Animate brand logo with dynamic motion graphics. Colors morph and flow, particles orbit the logo, modern tech aesthetic with smooth transitions"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Personalized A/B Testing Campaign</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "veo",
    "mode": "video",
    "aspect_ratio": "portrait",
    "prompt": "Lifestyle advertisement showing young professionals using SaaS platform. Modern office environment, collaborative workspace, diverse team members, sleek UI elements, motivational tone"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Batch Campaign Generation (Python)</h5>
                  <pre>{`import requests
import json

class MarketingCampaignGenerator:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.example.com'
    
    def generate_campaign_variations(self, brand_data, audience_segments):
        """Generate multiple campaign variations for different audiences"""
        campaigns = []
        
        for segment in audience_segments:
            # Customize prompt based on audience
            prompt = self._build_audience_prompt(brand_data, segment)
            
            job_id = self._generate_video(prompt, segment.get('aspect_ratio', 'landscape'))
            campaigns.append({
                'job_id': job_id,
                'segment': segment['name'],
                'audience': segment['description']
            })
        
        return campaigns
    
    def _build_audience_prompt(self, brand_data, segment):
        """Build tailored prompt for audience segment"""
        base = f"Brand: {brand_data['name']}. {brand_data['description']}. "
        
        if segment['type'] == 'young_professionals':
            return base + "Target audience: ambitious young professionals aged 25-35. Show modern career growth, tech integration, success stories. Energetic vibe with contemporary aesthetics."
        
        elif segment['type'] == 'families':
            return base + "Target audience: families with children. Emphasize trust, safety, warmth. Show family bonding moments, practical benefits. Friendly and welcoming tone."
        
        elif segment['type'] == 'enterprise':
            return base + "Target audience: enterprise decision makers. Focus on scalability, security, ROI. Professional corporate setting, leadership themes."
        
        return base
    
    def _generate_video(self, prompt, aspect_ratio='landscape'):
        """Make API call to generate video"""
        response = requests.post(
            f'{self.base_url}/api/generate',
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'provider': 'veo',
                'mode': 'video',
                'aspect_ratio': aspect_ratio,
                'prompt': prompt
            }
        )
        return response.json()['job_id']

# Example usage
generator = MarketingCampaignGenerator('your_api_key')

brand = {
    'name': 'TechFlow',
    'description': 'Next-generation productivity platform'
}

segments = [
    {
        'name': 'Young Professionals',
        'type': 'young_professionals',
        'description': 'LinkedIn demographic',
        'aspect_ratio': 'landscape'
    },
    {
        'name': 'Families',
        'type': 'families',
        'description': 'Facebook demographic',
        'aspect_ratio': 'landscape'
    }
]

campaigns = generator.generate_campaign_variations(brand, segments)
print(json.dumps(campaigns, indent=2))`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Social Media Use Case */}
          <div className="usecase-detailed">
            <div className="usecase-card">
              <div className="usecase-header">
                <div className="usecase-icon">
                  <Share2 size={18} />
                </div>
                <h4 className="usecase-title">Social Media Content Creation</h4>
              </div>
              <div className="usecase-body">
                <p className="usecase-description">Generate viral-worthy content tailored to platform-specific formats. Create short-form videos optimized for TikTok, Instagram Reels, and YouTube Shorts instantly. Scale content production without increasing team size.</p>
                
                <div className="usecase-subsection">
                  <h5>TikTok Format: Vertical Short-Form Video</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "meta",
    "mode": "video",
    "aspect_ratio": "portrait",
    "prompt": "Fast-paced trending TikTok dance challenge. Trendy music sync, quick cuts, vibrant colors, trending hashtag aesthetic. Young, energetic, fun vibe. Quick transitions with effects"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Instagram Reel: Lifestyle Content</h5>
                  <pre>{`curl -X POST https://api.example.com/api/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "veo",
    "mode": "video",
    "aspect_ratio": "portrait",
    "prompt": "Instagram Reel lifestyle video. Morning routine montage with aesthetic cinematography, natural lighting, smooth transitions, relatable moments, inspirational vibe"
  }'`}</pre>
                </div>

                <div className="usecase-subsection">
                  <h5>Content Calendar Generator (JavaScript)</h5>
                  <pre>{`async function generateContentCalendar(apiKey, contentStrategy) {
  const platforms = {
    tiktok: { aspect_ratio: 'portrait', duration: 'short' },
    instagram: { aspect_ratio: 'portrait', duration: 'short' },
    youtube: { aspect_ratio: 'landscape', duration: 'medium' }
  };
  
  const contentPlan = [];
  
  for (const week of contentStrategy.weeks) {
    for (const day of week.days) {
      for (const platform of Object.keys(platforms)) {
        const config = platforms[platform];
        
        const prompt = buildPrompt(day.topic, platform, day.style);
        
        const response = await fetch('https://api.example.com/api/generate', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${apiKey}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            provider: 'meta',
            mode: 'video',
            aspect_ratio: config.aspect_ratio,
            prompt: prompt
          })
        });
        
        const { job_id, status } = await response.json();
        
        contentPlan.push({
          date: day.date,
          platform,
          topic: day.topic,
          job_id,
          status
        });
      }
    }
  }
  
  return contentPlan;
}

function buildPrompt(topic, platform, style) {
  const platformTips = {
    tiktok: 'Fast-paced, trending aesthetic, viral potential',
    instagram: 'Aesthetic, polished, story-telling focused',
    youtube: 'Comprehensive, engaging thumbnails, high production value'
  };
  
  return \`\${topic}. Platform: \${platform}. Style: \${style}. Tips: \${platformTips[platform]}\`;
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <DocsPlaygroundCard user={user} />
      {tutorialOpen && <N8nTutorialModal onClose={closeTutorial} />}
    </div>
  );
}

function N8nTutorialComposition() {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / 330);
  const pulse = interpolate(frame % 60, [0, 30, 60], [0.65, 1, 0.65]);
  const sceneIndex = frame < 75 ? 0 : frame < 155 ? 1 : frame < 235 ? 2 : 3;

  const scenes = [
    { title: 'n8n Trigger', body: 'Start with Manual Trigger or Webhook' },
    { title: 'POST /api/generate', body: 'Send prompt + mode + Bearer API key' },
    { title: 'Save job_id', body: 'Store the returned job_id for polling' },
    { title: 'POST /api/download', body: 'Poll until videos or images are returned' },
  ];
  const requestSnippet =
    sceneIndex < 3
      ? `POST ${API_BASE_URL}/api/generate
Authorization: Bearer eg_xxx

{
  "provider": "veo",
  "aspect_ratio": "landscape",
  "prompt": "Create a cinematic teaser",
  "mode": "video"
}`
      : `POST ${API_BASE_URL}/api/download
Authorization: Bearer eg_xxx

{
  "job_id": "268c..."
}`;
  const responseSnippet =
    sceneIndex < 2
      ? `{
  "success": true,
  "job_id": "268c...",
  "status": "queued"
}`
      : `{
  "success": true,
  "status": "completed",
  "videos": ["https://..."],
  "images": ["https://..."]
}`;

  return (
    <AbsoluteFill className="tutorial-video-scene">
      <div className="tutorial-video-header">
        <span>EG Autonomous API</span>
        <strong>n8n workflow tutorial</strong>
      </div>
      <div className="tutorial-flow">
        {scenes.map((scene, index) => (
          <div key={scene.title} className={`tutorial-node ${index <= sceneIndex ? 'active' : ''}`}>
            <span>{index + 1}</span>
            <strong>{scene.title}</strong>
            <p>{scene.body}</p>
          </div>
        ))}
      </div>
      <div className="tutorial-request-strip">
        <code>{sceneIndex < 3 ? `POST ${API_BASE_URL}/api/generate` : `POST ${API_BASE_URL}/api/download`}</code>
      </div>
      <div className="tutorial-io-grid">
        <div className="tutorial-code-card">
          <span>Request</span>
          <pre>{requestSnippet}</pre>
        </div>
        <div className="tutorial-code-card response">
          <span>Response</span>
          <pre>{responseSnippet}</pre>
        </div>
      </div>
      <div className="tutorial-n8n-canvas">
        <div className="tutorial-n8n-node">Trigger</div>
        <div className="tutorial-line" />
        <div className="tutorial-n8n-node accent">HTTP Request</div>
        <div className="tutorial-line" />
        <div className="tutorial-n8n-node">Response</div>
      </div>
      <div className="tutorial-progress">
        <div style={{ width: `${progress * 100}%`, opacity: pulse }} />
      </div>
    </AbsoluteFill>
  );
}

function N8nTutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="tutorial-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tutorial-modal">
        <div className="tutorial-modal-head">
          <div>
            <p>Visual guide</p>
            <h3>Use the API in n8n</h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <Player
          component={N8nTutorialComposition}
          durationInFrames={330}
          compositionWidth={1280}
          compositionHeight={720}
          fps={30}
          controls
          loop
          style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }}
        />
      </div>
    </div>
  );
}

function DocsPlaygroundCard({ user }: { user: User | null }) {
  const [provider, setProvider] = useState<'meta' | 'veo'>('meta');
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait'>('landscape');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Create a fashion cinematic intro.');
  const [mode, setMode] = useState<GenerateMode>('video');
  const [imageUrl, setImageUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [loadingAction, setLoadingAction] = useState<'generate' | 'download' | null>(null);
  const [output, setOutput] = useState('Run a request to preview response JSON.');
  const [userKeys, setUserKeys] = useState<ApiKeyDoc[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

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
          provider,
          prompt,
          mode,
          ...(provider === 'veo' ? { aspect_ratio: aspectRatio } : {}),
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

  const applyPreset = (presetType: string) => {
    switch (presetType) {
      case 'veo-cinematic':
        setProvider('veo');
        setMode('video');
        setAspectRatio('landscape');
        setPrompt('Epic cinematic shot of a futuristic city skyline at sunset');
        break;
      case 'meta-image':
        setProvider('meta');
        setMode('image');
        setPrompt('Generate a stunning landscape photograph');
        break;
      case 'meta-i2v':
        setProvider('meta');
        setMode('image_to_video');
        setImageUrl('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800');
        setPrompt('Animate this mountain landscape with dramatic weather and lighting changes');
        break;
    }
  };

  return (
    <section className="panel docs-panel">
      <div className="docs-playground-header">
        <h3>Interactive API Playground</h3>
        <p>Test API requests in real-time. Configure parameters, send requests, and see live responses from our AI models.</p>
      </div>

      {/* Preset Buttons */}
      <div className="preset-buttons">
        <button className="preset-btn" onClick={() => applyPreset('veo-cinematic')}>
          Veo Cinematic
        </button>
        <button className="preset-btn" onClick={() => applyPreset('meta-image')}>
          Meta Image
        </button>
        <button className="preset-btn" onClick={() => applyPreset('meta-i2v')}>
          Image-to-Video
        </button>
      </div>

      {/* Request Controls */}
      <div className="docs-playground-controls">
        <div>
          <label>API Key</label>
          <select value={apiKey} onChange={(event) => setApiKey(event.target.value)}>
            {loadingKeys && <option value="">Loading keys...</option>}
            {!loadingKeys && userKeys.length > 0 &&
              userKeys.map((item) => (
                <option key={item.id} value={item.key}>
                  {item.name || item.project || 'API Key'}
                </option>
              ))}
            {!loadingKeys && userKeys.length === 0 && (
              <option value="">{user ? 'No active API keys' : 'Sign in to use saved keys'}</option>
            )}
          </select>
        </div>
        <div>
          <label>Provider</label>
          <select value={provider} onChange={(event) => {
            const nextProvider = event.target.value as 'meta' | 'veo';
            setProvider(nextProvider);
            if (nextProvider === 'veo' && mode !== 'video') setMode('video');
          }}>
            <option value="meta">Meta AI</option>
            <option value="veo">Veo AI</option>
          </select>
        </div>
        <div>
          <label>Mode</label>
          <select value={mode} onChange={(event) => setMode(event.target.value as GenerateMode)}>
            <option value="video">video</option>
            {provider === 'meta' && <option value="image">image</option>}
            {provider === 'meta' && <option value="image_to_video">image_to_video</option>}
          </select>
        </div>
        {provider === 'veo' && (
          <div>
            <label>Aspect Ratio</label>
            <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as 'landscape' | 'portrait')}>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
        )}
        <div className="wide">
          <label>Prompt</label>
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe what you want to generate..." />
        </div>
        {mode === 'image_to_video' && (
          <div className="wide">
            <label>Image URL</label>
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.jpg" />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="playground-actions">
        <button onClick={runGenerate} disabled={loadingAction !== null || apiKey.trim().length < 10}>
          {loadingAction === 'generate' ? 'Generating...' : 'POST /api/generate'}
        </button>
        <button
          className="secondary"
          onClick={runDownload}
          disabled={loadingAction !== null || apiKey.trim().length < 10 || jobId.trim().length < 8}
        >
          {loadingAction === 'download' ? 'Downloading...' : 'POST /api/download'}
        </button>
      </div>

      {/* Response Display */}
      {jobId && (
        <div className="response-status success">
          <span className="status-dot"></span>
          <span>Job ID: <strong>{jobId.slice(0, 12)}...</strong></span>
        </div>
      )}

      <div className="request-response-grid response-only-grid">
        <article className="code-panel">
          <div className="code-panel-head">
            <span>JSON Response</span>
            <code>200</code>
          </div>
          <pre>{output}</pre>
        </article>
      </div>
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
