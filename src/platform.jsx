import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Bell, BriefcaseBusiness, CalendarClock, CheckCircle2, Circle, ClipboardList, History, Inbox, IndianRupee, LayoutDashboard, Laptop, LogOut, Menu, Settings as SettingsIcon, Sparkles, Upload, Wrench } from 'lucide-react';
import { isSupabaseConfigured, supabase, getOrCreateProfile } from './lib/supabase';
import { STATUS_LABELS, repairPartners, makeDiagnosis, makeEstimate, money, canTransition, newRequest, isoNow } from './lib/domain';
import './platform.css';
import './refinement.css';

const SESSION_KEY = 'repairme:session:v2';
const STORE_KEY = 'repairme:store:v2';
const ROLE_KEY = 'repairme:role:v2';

const initialStore = () => ({
  requests: [],
  partnerProfile: {
    businessName: 'Northline Home Care',
    intro: 'Transparent appliance diagnostics and repair with clear itemized quotes before work begins.',
    locality: 'Indiranagar',
    experience: '8',
    categories: ['Refrigerator', 'Washing machine', 'Air conditioner'],
    draft: false,
    slots: ['Tomorrow · 10:00–12:00', 'Tomorrow · 14:00–16:00'],
  },
});

const iconMap = {
  '✦': Sparkles, '⌁': Wrench, '⌘': BriefcaseBusiness, '◫': LayoutDashboard, '↓': Inbox,
  '▤': ClipboardList, '◷': CalendarClock, '↻': History, '▣': Laptop, '⚙': SettingsIcon,
  '↪': LogOut, '₹': IndianRupee, '♢': Bell, '!': AlertTriangle, '✓': CheckCircle2, '＋': Upload,
};

const Glyph = ({ children, className = '' }) => {
  const VectorIcon = iconMap[children] || Circle;
  return <span className={`glyph ${className}`} aria-hidden="true"><VectorIcon /></span>;
};

const RoleBadge = ({ role }) => (
  <span className="role-badge">{role === 'repair_partner' ? 'Repair Partner' : 'Customer'}</span>
);

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return initialStore();
    const parsed = JSON.parse(raw);
    return { ...initialStore(), ...parsed, requests: parsed.requests || [] };
  } catch {
    return initialStore();
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

function displayStatus(status) {
  return STATUS_LABELS[status] || status;
}

function Notification({ message, onClose }) {
  if (!message) return null;
  const NoticeIcon = message.kind === 'error' ? AlertTriangle : CheckCircle2;
  return (
    <div className={`notice ${message.kind || 'info'}`} role="status">
      <NoticeIcon aria-hidden="true" />
      <p>{message.text}</p>
      <button onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  );
}

export function Platform({ onExit, initialDraft = null }) {
  const [screen, setScreen] = useState('selection');
  const [selectedRole, setSelectedRole] = useState(() => sessionStorage.getItem(ROLE_KEY) === 'repair_partner' ? 'repair_partner' : 'customer');
  const [user, setUser] = useState(null);
  const [active, setActive] = useState(initialDraft ? 'partners' : 'overview');
  const [notice, setNotice] = useState(null);
  const [store, setStore] = useState(initialStore);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    if (store) saveStore(store);
  }, [store]);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        setScreen('workspace');
        if (initialDraft) setActive('partners');
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted || !data.session?.user) return;
      try {
        const profile = await getOrCreateProfile(data.session.user, selectedRole);
        if (!mounted) return;
        setUser({
          id: data.session.user.id,
          name: profile.display_name || data.session.user.email,
          email: data.session.user.email,
          role: profile.role,
          verificationStatus: profile.verification_status,
          guest: false,
        });
        setScreen('workspace');
        if (initialDraft) setActive('partners');
      } catch (error) {
        if (mounted) setNotice({ kind: 'error', text: error.message || 'We could not load your RepairMe profile.' });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user || !mounted) return;
      try {
        const profile = await getOrCreateProfile(session.user, selectedRole);
        if (mounted) {
          setUser({
            id: session.user.id,
            name: profile.display_name || session.user.email,
            email: session.user.email,
            role: profile.role,
            verificationStatus: profile.verification_status,
            guest: false,
          });
          setScreen('workspace');
          if (initialDraft) setActive('partners');
        }
      } catch (error) {
        if (mounted) setNotice({ kind: 'error', text: error.message || 'Profile setup error.' });
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [selectedRole, initialDraft]);

  function enterAsGuest(role, customName = null) {
    const guestUser = {
      id: `usr_${Date.now()}`,
      name: customName || (role === 'repair_partner' ? 'Service Partner' : 'Appliance Owner'),
      email: customName ? `${customName.toLowerCase().replace(/\s+/g, '')}@repairme.io` : 'guest@repairme.io',
      role,
      verificationStatus: role === 'repair_partner' ? 'pending' : null,
      guest: true,
    };
    setUser(guestUser);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(guestUser));
    setScreen('workspace');
    setActive(initialDraft ? 'partners' : 'overview');
  }

  async function handleEmailAuth({ mode, email, password, name }) {
    if (!supabase) {
      enterAsGuest(selectedRole, name || email.split('@')[0]);
      return;
    }

    setAuthBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name || email.split('@')[0],
              role: selectedRole,
            },
          },
        });
        if (error) throw error;
        if (data?.user) {
          const profile = await getOrCreateProfile(data.user, selectedRole);
          setUser({
            id: data.user.id,
            name: profile.display_name || name || email.split('@')[0],
            email: data.user.email,
            role: profile.role,
            verificationStatus: profile.verification_status,
            guest: false,
          });
          setScreen('workspace');
          setActive(initialDraft ? 'partners' : 'overview');
          setNotice({ kind: 'info', text: 'Account created successfully.' });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.user) {
          const profile = await getOrCreateProfile(data.user, selectedRole);
          setUser({
            id: data.user.id,
            name: profile.display_name || email.split('@')[0],
            email: data.user.email,
            role: profile.role,
            verificationStatus: profile.verification_status,
            guest: false,
          });
          setScreen('workspace');
          setActive(initialDraft ? 'partners' : 'overview');
        }
      }
    } catch (err) {
      setNotice({ kind: 'error', text: err.message || 'Authentication failed. Please verify credentials.' });
    } finally {
      setAuthBusy(false);
    }
  }

  async function continueWithGoogle() {
    if (!supabase) {
      setNotice({ kind: 'error', text: 'Supabase client is not configured yet. Set VITE_SUPABASE_URL in .env.local.' });
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setAuthBusy(false);
      setNotice({ kind: 'error', text: error.message });
    }
  }

  async function signOut() {
    if (!user?.guest && supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    setScreen('selection');
    setActive('overview');
  }

  const updateStore = useCallback((updater) => {
    setStore((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  if (screen === 'selection') {
    return (
      <>
        <Notification message={notice} onClose={() => setNotice(null)} />
        <RoleSelection
          onBack={onExit}
          onChoose={(role) => {
            sessionStorage.setItem(ROLE_KEY, role);
            setSelectedRole(role);
            setScreen('signin');
          }}
        />
      </>
    );
  }

  if (screen === 'signin') {
    return (
      <>
        <Notification message={notice} onClose={() => setNotice(null)} />
        <SignIn
          role={selectedRole}
          busy={authBusy}
          hasDraft={Boolean(initialDraft)}
          configured={isSupabaseConfigured}
          onBack={() => setScreen('selection')}
          onEmailAuth={handleEmailAuth}
          onGoogle={continueWithGoogle}
          onGuest={() => enterAsGuest(selectedRole)}
        />
      </>
    );
  }

  return (
    <Workspace
      user={user}
      store={store}
      setStore={updateStore}
      active={active}
      setActive={setActive}
      initialDraft={initialDraft}
      onSignOut={signOut}
      onExit={onExit}
      notify={setNotice}
      notice={notice}
      clearNotice={() => setNotice(null)}
    />
  );
}

function RoleSelection({ onChoose, onBack }) {
  return (
    <main className="auth-page">
      <header className="portal-top">
        <button className="portal-brand" onClick={onBack}>
          <Sparkles aria-hidden="true" /> Repair<span>Me</span>
        </button>
        <button className="back-link" onClick={onBack}>← Back to home</button>
      </header>
      <section className="role-wrap">
        <div className="portal-eyebrow">WELCOME TO REPAIRME</div>
        <h1>Which side of repair<br /><i>are you on?</i></h1>
        <p className="auth-intro">Choose your experience. Customer accounts manage repairs with guaranteed quote approvals; Repair Partners receive verified requests and manage quotes.</p>
        <div className="role-grid">
          <RoleCard
            icon="⌁"
            title="I need a repair"
            text="Diagnose an appliance problem with AI, compare verified repair specialists, inspect transparent estimates, and approve quotes."
            action="Continue as Customer"
            onClick={() => onChoose('customer')}
          />
          <RoleCard
            icon="⌘"
            title="I’m a Repair Partner"
            text="Receive regional repair requests, manage inspection availability, provide itemized quotations, and build customer trust."
            action="Continue as Repair Partner"
            partner
            onClick={() => onChoose('repair_partner')}
          />
        </div>
      </section>
    </main>
  );
}

function RoleCard({ icon, title, text, action, onClick, partner }) {
  return (
    <article className={`role-card ${partner ? 'partner' : ''}`}>
      <Glyph>{icon}</Glyph>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="solid-action" onClick={onClick}>{action} <span>→</span></button>
    </article>
  );
}

function SignIn({ role, onBack, onEmailAuth, onGoogle, onGuest, hasDraft, busy }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const roleName = role === 'repair_partner' ? 'Repair Partner' : 'Customer';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    onEmailAuth({ mode, email, password, name });
  };

  return (
    <main className="auth-page">
      <header className="portal-top">
        <button className="portal-brand" onClick={onBack}>
          <Sparkles aria-hidden="true" /> Repair<span>Me</span>
        </button>
        <button className="back-link" onClick={onBack}>← Change role</button>
      </header>
      <section className="sign-in-wrap">
        <div className="sign-in-panel">
          <RoleBadge role={role} />
          <h1>{mode === 'signup' ? 'Create your account' : `Welcome, ${roleName}.`}</h1>
          <p>
            {hasDraft
              ? 'Your device diagnosis is ready. Sign in to view matching certified repair technicians and request a slot.'
              : 'Sign in to access your repair records, itemized estimates, and booking management.'}
          </p>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={mode === 'signin' ? 'active' : ''}
              onClick={() => setMode('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => setMode('signup')}
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label>
                Full Name
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="solid-action full" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : mode === 'signup' ? 'Create Account & Continue' : 'Sign In'} <span>→</span>
            </button>
          </form>

          <div className="auth-divider">or continue with</div>

          <button className="google-button" type="button" onClick={onGoogle} disabled={busy}>
            <span className="google-g">G</span> Continue with Google
          </button>

          <button className="guest-link" type="button" onClick={onGuest}>
            Continue as Guest (Instant Access) →
          </button>
        </div>

        <aside className="sign-in-aside">
          <div className="aside-orbit"></div>
          <div className="aside-card">
            <Glyph>⌁</Glyph>
            <span>TRANSPARENT REPAIR</span>
            <strong>Itemized quotes.<br />Customer approval first.</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}

const customerNav = [
  ['overview', 'Overview', '◫'],
  ['diagnose', 'Diagnose device', '✦'],
  ['partners', 'Find Repair Partners', '⌁'],
  ['requests', 'My repair requests', '▤'],
  ['appointments', 'Appointments', '◷'],
  ['history', 'Repair history', '↻'],
  ['devices', 'Saved devices', '▣'],
  ['settings', 'Profile & settings', '⚙'],
];

const partnerNav = [
  ['overview', 'Overview', '◫'],
  ['incoming', 'Incoming requests', '↓'],
  ['active', 'Active repairs', '⌁'],
  ['quotes', 'Quotes & estimates', '▤'],
  ['appointments', 'Appointments', '◷'],
  ['availability', 'Availability', '◫'],
  ['profile', 'Business profile', '▣'],
  ['verification', 'Verification status', '✓'],
  ['settings', 'Account settings', '⚙'],
];

function Workspace({ user, store, setStore, active, setActive, initialDraft, onSignOut, onExit, notify, notice, clearNotice }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = user.role === 'repair_partner' ? partnerNav : customerNav;
  const requests = store.requests || [];

  useEffect(() => {
    if (user.guest || !supabase) return;
    let current = true;
    const load = async () => {
      const column = user.role === 'customer' ? 'customer_id' : 'partner_id';
      const { data, error } = await supabase
        .from('repair_requests')
        .select('*, repair_quotes(*), repair_status_events(*)')
        .eq(column, user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Table not created yet or RLS policy warning
        return;
      }
      if (current && data && data.length > 0) {
        setStore((s) => ({ ...s, requests: data.map(databaseRequest) }));
      }
    };
    load();
    return () => { current = false; };
  }, [user, setStore]);

  const updateRequest = (id, mutate) => setStore((s) => {
    const updatedRequests = s.requests.map((r) => (r.id === id ? mutate(r) : r));
    const changed = updatedRequests.find((r) => r.id === id);
    if (!user.guest && changed) persistRequestChange(changed, notify);
    return { ...s, requests: updatedRequests };
  });

  const addRequest = (request) => {
    setStore((s) => ({ ...s, requests: [request, ...s.requests] }));
    if (!user.guest) persistNewRequest(request, notify);
  };

  const contentProps = { user, store, requests, updateRequest, addRequest, setStore, setActive, notify, initialDraft };

  return (
    <>
      <a className="skip-link" href="#workspace-content">Skip to workspace content</a>
      <div className="workspace">
        <Notification message={notice} onClose={clearNotice} />
        <aside className={`workspace-sidebar ${menuOpen ? 'open' : ''}`}>
          <button className="portal-brand side-brand" onClick={onExit}>
            <Sparkles aria-hidden="true" /> Repair<span>Me</span>
          </button>
          <div className="side-user">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <b>{user.name}</b>
              <RoleBadge role={user.role} />
            </div>
          </div>
          <nav aria-label="Workspace navigation">
            {nav.map(([id, label, icon]) => (
              <button
                key={id}
                aria-current={active === id ? 'page' : undefined}
                className={active === id ? 'active' : ''}
                onClick={() => { setActive(id); setMenuOpen(false); }}
              >
                <Glyph className="side-nav-icon">{icon}</Glyph>
                <span>{label}</span>
                {id === 'incoming' && user.role === 'repair_partner' && (
                  <i aria-label={`${requests.filter((r) => r.status === 'REQUESTED').length} incoming requests`}>
                    {requests.filter((r) => r.status === 'REQUESTED').length}
                  </i>
                )}
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <button className="sign-out" onClick={onSignOut}>
              <LogOut aria-hidden="true" /> Sign out
            </button>
          </div>
        </aside>

        <div className="workspace-main">
          <header className="workspace-header">
            <button className="workspace-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
              <Menu aria-hidden="true" />
            </button>
            <div>
              <span className="crumb">REPAIRME / {user.role === 'repair_partner' ? 'PARTNER PORTAL' : 'CUSTOMER PORTAL'}</span>
              <h1>{nav.find((n) => n[0] === active)?.[1] || 'RepairMe'}</h1>
            </div>
            <div className="header-actions">
              <button className="bell" aria-label="Notifications"><Bell aria-hidden="true" /><i></i></button>
            </div>
          </header>
          <main id="workspace-content" className="dashboard-content">
            {user.role === 'customer' ? <CustomerView active={active} {...contentProps} /> : <PartnerView active={active} {...contentProps} />}
          </main>
        </div>
      </div>
    </>
  );
}

function databaseRequest(row) {
  const quote = row.repair_quotes?.[0];
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name || 'Customer',
    deviceCategory: row.device_category,
    brandModel: row.brand_model || 'Not provided',
    deviceAge: row.device_age || 'Not provided',
    symptoms: row.symptoms,
    locality: row.locality || 'Not provided',
    photoName: row.photo_name || null,
    diagnosis: row.diagnosis_json || makeDiagnosis({ deviceCategory: row.device_category, symptoms: row.symptoms }),
    estimate: row.estimate_json || makeEstimate(row.device_category),
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    appointment: row.appointment_slot,
    status: row.status,
    quote: quote ? { labor: quote.labor_amount, parts: quote.parts_amount, visit: quote.visit_fee, total: quote.total_amount, note: quote.note } : null,
    inspectionNotes: row.inspection_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: (row.repair_status_events || []).map((e) => ({ at: e.created_at, actor: e.actor_role, status: e.status, note: e.note })),
  };
}

async function persistNewRequest(request, notify) {
  if (!supabase) return;
  const { error } = await supabase.rpc('create_repair_request', { p_request: request });
  if (error) {
    console.warn('Supabase sync note:', error.message);
  }
}

async function persistRequestChange(request, notify) {
  if (!supabase) return;
  const lastEvent = request.events?.[request.events.length - 1];
  const { error } = await supabase.rpc('transition_repair_request', {
    p_request_id: request.id,
    p_target_status: request.status,
    p_note: lastEvent?.note || null,
    p_quote: request.status === 'QUOTE_PENDING' ? request.quote : null,
    p_inspection_notes: request.inspectionNotes || null,
  });
  if (error) {
    console.warn('Supabase status sync note:', error.message);
  }
}

function CustomerView({ active, user, requests, updateRequest, addRequest, setActive, notify, initialDraft }) {
  const [draft, setDraft] = useState(initialDraft || null);

  useEffect(() => {
    if (initialDraft) setDraft(initialDraft);
  }, [initialDraft]);

  if (active === 'diagnose') return <Diagnose user={user} onReady={(data) => { setDraft(data); setActive('partners'); }} notify={notify} />;
  if (active === 'partners') {
    return (
      <PartnerFinder
        user={user}
        draft={draft}
        onBooked={(partner, slot) => {
          if (!draft) {
            notify({ kind: 'error', text: 'Start with a device diagnosis so RepairMe can match you with the right specialist.' });
            setActive('diagnose');
            return;
          }
          addRequest(newRequest(draft.form, user, draft.diagnosis, draft.estimate, partner, slot));
          notify({ kind: 'info', text: 'Booking request confirmed. Your technician has been notified.' });
          setActive('requests');
        }}
      />
    );
  }
  if (active === 'requests') return <CustomerRequests requests={requests.filter((r) => r.customerId === user.id)} updateRequest={updateRequest} notify={notify} />;
  if (active === 'appointments') return <Appointments requests={requests.filter((r) => r.customerId === user.id)} />;
  if (active === 'history') return <EmptyState icon="↻" title="No completed repairs yet" copy="Completed repair summaries and warranty receipts will appear here once service is complete." />;
  if (active === 'devices') return <SavedDevices />;
  if (active === 'settings') return <Settings user={user} />;
  return <CustomerOverview user={user} requests={requests.filter((r) => r.customerId === user.id)} setActive={setActive} />;
}

function CustomerOverview({ user, requests, setActive }) {
  const activeRequests = requests.filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status));
  const appointment = requests.find((r) => r.appointment && !['COMPLETED', 'CANCELLED'].includes(r.status));

  return (
    <>
      <section className="welcome-row">
        <div>
          <span className="portal-eyebrow">CUSTOMER OVERVIEW</span>
          <h2>Good to see you, <i>{user.name.split(' ')[0]}.</i></h2>
          <p>Start with what you know. RepairMe provides cautious AI diagnosis and connects you to certified repair specialists.</p>
        </div>
        <button className="solid-action" onClick={() => setActive('diagnose')}>
          <Sparkles aria-hidden="true" /> Diagnose a device <span>→</span>
        </button>
      </section>

      <section className="metric-grid">
        <Metric label="Active requests" value={activeRequests.length} icon="▤" />
        <Metric label="Upcoming visits" value={appointment ? '1' : '0'} icon="◷" />
        <Metric label="Estimated repair range" value={activeRequests[0] ? `${money(activeRequests[0].estimate.totalMin)}+` : '—'} icon="₹" />
        <Metric label="Saved devices" value="0" icon="▣" />
      </section>

      <section className="dashboard-grid">
        <article className="panel request-panel">
          <PanelHeading kicker="YOUR CURRENT REPAIR" title={activeRequests[0] ? `${activeRequests[0].deviceCategory} · ${activeRequests[0].brandModel}` : 'No active repairs'} action={activeRequests[0] ? displayStatus(activeRequests[0].status) : 'All clear'} />
          {activeRequests[0] ? (
            <RequestSummary request={activeRequests[0]} />
          ) : (
            <EmptyCompact copy="When an appliance needs repair, start a guided AI diagnosis here." button="Diagnose a device" onClick={() => setActive('diagnose')} />
          )}
        </article>
        <article className="panel how-panel">
          <PanelHeading kicker="HOW REPAIRME PROTECTS YOU" title="Clear steps, zero surprises" />
          <ol>
            <li><b>1</b><span>AI preliminary hypothesis & safety check</span></li>
            <li><b>2</b><span>Transparent regional estimate breakdown</span></li>
            <li><b>3</b><span>In-person inspection & your explicit quote approval</span></li>
          </ol>
          <p>No work ever starts without your written itemized approval.</p>
        </article>
      </section>
    </>
  );
}

function Metric({ label, value, icon }) {
  return (
    <article className="metric">
      <Glyph>{icon}</Glyph>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PanelHeading({ kicker, title, action }) {
  return (
    <div className="panel-heading">
      <div>
        <span>{kicker}</span>
        <h3>{title}</h3>
      </div>
      {action && <em>{action}</em>}
    </div>
  );
}

function EmptyCompact({ copy, button, onClick }) {
  return (
    <div className="empty-compact">
      <p>{copy}</p>
      <button onClick={onClick}>{button} →</button>
    </div>
  );
}

function Diagnose({ user, onReady, notify }) {
  const [form, setForm] = useState({
    deviceCategory: 'Refrigerator',
    brandModel: '',
    deviceAge: '',
    symptoms: '',
    locality: '',
    warranty: 'Unknown',
    photoName: '',
  });
  const [photo, setPhoto] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify({ kind: 'error', text: 'Please upload a JPG, PNG, or WebP image under 5 MB.' });
      return;
    }
    set('photoName', file.name);
    setPhoto(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    if (form.symptoms.trim().length < 12) {
      notify({ kind: 'error', text: 'Please add a little more detail about the symptom (at least 12 characters).' });
      return;
    }
    setBusy(true);
    let diagnosis = null;

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceCategory: form.deviceCategory,
          symptoms: form.symptoms,
          brandModel: form.brandModel,
          deviceAge: form.deviceAge,
          imageDataUrl,
        }),
      });
      if (response.ok) {
        const apiResult = await response.json();
        if (apiResult?.diagnosis) diagnosis = apiResult.diagnosis;
      }
    } catch {
      // Fallback below
    }

    if (!diagnosis) {
      diagnosis = makeDiagnosis(form);
    }

    setResult({ diagnosis, estimate: makeEstimate(form.deviceCategory) });
    setBusy(false);
  }

  if (result) {
    return (
      <DiagnosisResult
        form={form}
        photo={photo}
        result={result}
        onBack={() => setResult(null)}
        onContinue={() => onReady({ form, ...result })}
      />
    );
  }

  return (
    <section className="diagnose-layout">
      <div className="form-intro">
        <span className="portal-eyebrow">GUIDED INTAKE · STEP 1 OF 3</span>
        <h2>Tell us what<br /><i>you’re noticing.</i></h2>
        <p>Describe what happened in everyday language. Our OpenRouter AI assistant isolates possible causes and ensures safety.</p>
        <div className="safety-rail">
          <b>Safety comes first</b>
          <span>For smoke, sparks, burning odors, gas leaks, or swollen batteries, immediately turn off the device and do not open it.</span>
        </div>
      </div>

      <form className="diagnose-form panel" onSubmit={submit}>
        <ol className="flow-steps" aria-label="Repair request progress">
          <li className="active"><span>1</span><b>Describe issue</b></li>
          <li><span>2</span><b>Review findings</b></li>
          <li><span>3</span><b>Choose repair</b></li>
        </ol>

        <label>
          Device category
          <select value={form.deviceCategory} onChange={(e) => set('deviceCategory', e.target.value)}>
            <option>Refrigerator</option>
            <option>Washing machine</option>
            <option>Laptop</option>
            <option>Air conditioner</option>
            <option>Smartphone</option>
          </select>
        </label>

        <div className="form-two">
          <label>
            Brand & model <small>optional</small>
            <input value={form.brandModel} onChange={(e) => set('brandModel', e.target.value)} placeholder="e.g. Samsung RT28" />
          </label>
          <label>
            Approx. age <small>optional</small>
            <input value={form.deviceAge} onChange={(e) => set('deviceAge', e.target.value)} placeholder="e.g. 4 years" />
          </label>
        </div>

        <label>
          What’s happening?
          <textarea
            value={form.symptoms}
            onChange={(e) => set('symptoms', e.target.value)}
            placeholder="For example, the refrigerator runs continuously but food is warm. I noticed it yesterday..."
            required
          />
        </label>

        <div className="form-two">
          <label>
            Locality <small>optional</small>
            <input value={form.locality} onChange={(e) => set('locality', e.target.value)} placeholder="e.g. Indiranagar" />
          </label>
          <label>
            Warranty status
            <select value={form.warranty} onChange={(e) => set('warranty', e.target.value)}>
              <option>Unknown</option>
              <option>In warranty</option>
              <option>Out of warranty</option>
            </select>
          </label>
        </div>

        <label className="upload-field">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
          <span>
            <b><Upload aria-hidden="true" /> Add a device photo</b>
            <small>{form.photoName || 'Optional · JPG, PNG, or WebP under 5 MB'}</small>
          </span>
          {photo && <img src={photo} alt="Device preview" />}
        </label>

        <button className="solid-action full" disabled={busy}>
          {busy ? 'Analyzing with AI…' : 'Get possible causes'} <span>→</span>
        </button>
      </form>
    </section>
  );
}

function DiagnosisResult({ form, result, photo, onBack, onContinue }) {
  const { diagnosis, estimate } = result;
  const danger = diagnosis.riskLevel === 'danger';

  return (
    <section className="result-page">
      <div className={`result-banner ${danger ? 'danger' : ''}`}>
        <Glyph>{danger ? '!' : '✦'}</Glyph>
        <div>
          <span>{danger ? 'SAFETY INTERVENTION REQUIRED' : 'AI-ASSISTED PRELIMINARY DIAGNOSIS'}</span>
          <strong>{danger ? 'Stop use immediately and arrange qualified help.' : 'Hypotheses evaluated · Certified inspection confirms root cause.'}</strong>
        </div>
      </div>

      <div className="result-grid">
        <article className="panel">
          <PanelHeading kicker="REPORTED ISSUE" title={`${form.deviceCategory}${form.brandModel ? ` · ${form.brandModel}` : ''}`} />
          <p className="symptom-quote">“{form.symptoms}”</p>
          {photo && <img className="result-photo" src={photo} alt="Uploaded device" />}
          <h4>{diagnosis.problemSummary}</h4>
          <div className="cause-list">
            {diagnosis.possibleCauses.map((cause, i) => (
              <div key={i}>
                <span className={`confidence ${cause.confidence.includes('urgent') ? 'danger' : ''}`}>{cause.confidence}</span>
                <b>{cause.cause}</b>
                <small>{cause.supportingEvidence?.[0]}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel checks-panel">
          <PanelHeading kicker="SAFE PRELIMINARY CHECKS" title="Safe checks before technician arrives" />
          <ul>
            {diagnosis.safeChecks.map((check, i) => (
              <li key={i}><CheckCircle2 aria-hidden="true" />{check}</li>
            ))}
          </ul>
          {diagnosis.missingInformation?.length > 0 && (
            <div className="missing-info">
              <b>Details to keep ready for technician:</b>
              {diagnosis.missingInformation.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          )}
        </article>

        {!danger && <EstimateCard estimate={estimate} />}

        {danger && (
          <article className="panel emergency-panel">
            <PanelHeading kicker="SAFETY PROTOCOL" title="Do not attempt DIY disassembly" />
            <p>Do not open the cabinet or touch exposed wiring, gas connections, or swollen battery packs. A qualified technician will inspect it with proper protective equipment.</p>
          </article>
        )}
      </div>

      <div className="result-actions">
        <button className="text-action" onClick={onBack}>← Edit details</button>
        {danger ? (
          <button className="solid-action" onClick={onBack}>I understand the safety guidance</button>
        ) : (
          <button className="solid-action" onClick={onContinue}>Compare Repair Partners <span>→</span></button>
        )}
      </div>
    </section>
  );
}

function EstimateCard({ estimate }) {
  return (
    <article className="panel estimate-panel">
      <PanelHeading kicker="TRANSPARENT ESTIMATE" title="Itemized calculation" />
      <div className="cost-line"><span>Diagnostic visit</span><b>{money(estimate.diagnosticFee)}</b></div>
      <div className="cost-line"><span>Labor estimate</span><b>{money(estimate.laborMin)} – {money(estimate.laborMax)}</b></div>
      <div className="cost-line"><span>Likely parts</span><b>{money(estimate.partsMin)} – {money(estimate.partsMax)}</b></div>
      <div className="estimate-result">
        <span>EXPECTED RANGE</span>
        <strong>{money(estimate.totalMin)} – {money(estimate.totalMax)}</strong>
        <small>Final price requires on-site inspection and your explicit approval.</small>
      </div>
      <p className="estimate-assumption">{estimate.assumptions[0]}</p>
    </article>
  );
}

function PartnerFinder({ user, draft, onBooked }) {
  const [chosen, setChosen] = useState(null);
  const [slot, setSlot] = useState('');
  const [partners, setPartners] = useState(repairPartners);
  const category = draft?.form?.deviceCategory;

  useEffect(() => {
    if (!supabase) return;
    let current = true;
    supabase.from('repair_partner_directory').select('*').then(({ data, error }) => {
      if (!current || error || !data || data.length === 0) return;
      setPartners(data.map((p) => ({
        id: p.id,
        name: p.display_name,
        business: p.business_name || p.display_name,
        locality: p.service_locality || 'Regional area',
        distance: 'Nearby',
        years: p.experience_years || 6,
        visitFee: 350,
        categories: p.categories?.length ? p.categories : ['Refrigerator', 'Washing machine', 'Air conditioner', 'Laptop', 'Smartphone'],
        brands: p.brands || ['LG', 'Samsung', 'Whirlpool'],
        slots: p.available_slots?.length ? p.available_slots : ['Tomorrow · 10:00–12:00', 'Tomorrow · 14:00–16:00'],
        intro: p.introduction || 'Certified Repair Partner specializing in domestic appliances and electronics.',
      })));
    });
    return () => { current = false; };
  }, []);

  const matches = partners.filter((p) => !category || p.categories.includes(category));

  return (
    <section>
      <div className="section-lead">
        <div>
          <span className="portal-eyebrow">VERIFIED TECHNICIANS</span>
          <h2>Compare your<br /><i>repair options.</i></h2>
        </div>
        <p>
          {draft
            ? `Specialists available for ${category} in ${draft.form.locality || 'your locality'}.`
            : 'Complete a device diagnosis to view matching certified repair technicians.'}
        </p>
      </div>

      <div className="partner-grid">
        {matches.map((partner) => (
          <article className={`partner-card panel ${chosen?.id === partner.id ? 'chosen' : ''}`} key={partner.id}>
            <div className="partner-head">
              <div className="partner-avatar">{partner.name.slice(0, 1)}</div>
              <div>
                <h3>{partner.name}</h3>
                <span>{partner.business}</span>
              </div>
            </div>
            <p>{partner.intro}</p>
            <div className="partner-details">
              <span>⌁ {partner.categories.join(' · ')}</span>
              <span>⌖ {partner.locality} · {partner.distance}</span>
              <span>◷ {partner.years} years verified experience</span>
              <span>₹ {money(partner.visitFee)} diagnostic visit</span>
            </div>

            {chosen?.id === partner.id ? (
              <div className="slot-picker">
                <b>Choose an appointment slot:</b>
                {partner.slots.map((s) => (
                  <button key={s} className={slot === s ? 'picked' : ''} onClick={() => setSlot(s)}>
                    {s}
                  </button>
                ))}
                <button className="solid-action full" disabled={!slot} onClick={() => onBooked(partner, slot)}>
                  Request booking <span>→</span>
                </button>
              </div>
            ) : (
              <button className="outline-action" onClick={() => { setChosen(partner); setSlot(''); }}>
                View availability <span>→</span>
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function CustomerRequests({ requests, updateRequest, notify }) {
  return (
    <section>
      <div className="section-lead compact">
        <div>
          <span className="portal-eyebrow">YOUR REPAIR JOURNEY</span>
          <h2>Requests and <i>approvals.</i></h2>
        </div>
      </div>
      {requests.length ? (
        <div className="request-stack">
          {requests.map((r) => (
            <RequestDetail key={r.id} request={r} role="customer" updateRequest={updateRequest} notify={notify} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="▤"
          title="No repair requests yet"
          copy="Complete a device diagnosis and choose a technician to create your first repair request."
        />
      )}
    </section>
  );
}

function RequestDetail({ request, role, updateRequest, notify }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [notes, setNotes] = useState(request.inspectionNotes || '');
  const [quote, setQuote] = useState(
    request.quote || { labor: '', parts: '', visit: request.estimate?.diagnosticFee || 350, note: '' }
  );

  const total = Number(quote.labor || 0) + Number(quote.parts || 0) + Number(quote.visit || 0);

  const change = (status, note) => {
    if (!canTransition(role, request.status, status)) {
      notify({ kind: 'error', text: 'That action is not available at this stage of the repair.' });
      return;
    }
    updateRequest(request.id, (r) => ({
      ...r,
      status,
      updatedAt: isoNow(),
      events: [...r.events, { at: isoNow(), actor: role, status, note }],
      ...(status === 'INSPECTION' ? { inspectionNotes: notes } : {}),
      ...(status === 'QUOTE_PENDING' ? { quote: { ...quote, total } } : {}),
    }));
    notify({ kind: 'info', text: `Repair request updated: ${displayStatus(status)}.` });
  };

  return (
    <article className="request-detail panel">
      <div className="request-title">
        <div>
          <span className="portal-eyebrow">{request.id}</span>
          <h3>{request.deviceCategory} <small>{request.brandModel}</small></h3>
          <p>{request.locality} · Submitted {new Date(request.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
        <Status status={request.status} />
      </div>

      <div className="request-columns">
        <div>
          <b>Reported symptom</b>
          <p>{request.symptoms}</p>
          {request.partnerName && (
            <p className="assigned">⌁ {request.partnerName}{request.appointment ? ` · ${request.appointment}` : ''}</p>
          )}
          <b>Preliminary estimate</b>
          <p>{money(request.estimate.totalMin)} – {money(request.estimate.totalMax)}</p>
        </div>

        <div className="timeline">
          <b>Journey</b>
          {request.events.slice(-4).reverse().map((e, i) => (
            <div key={i}>
              <i></i>
              <span>
                {displayStatus(e.status)}
                <small>{e.note} · {new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      {request.quote && (
        <div className="quote-review">
          <span>ITEMIZED TECHNICIAN QUOTE</span>
          <strong>{money(request.quote.total)}</strong>
          <p>{request.quote.note || 'Itemized quote submitted following physical inspection.'}</p>
          {role === 'customer' && request.status === 'QUOTE_PENDING' && (
            <div>
              <button className="solid-action" onClick={() => change('APPROVED', 'Customer approved the revised itemized quote')}>
                Approve quote <span>→</span>
              </button>
              <button className="text-action danger-text" onClick={() => change('CANCELLED', 'Customer declined the quote')}>
                Reject quote
              </button>
            </div>
          )}
        </div>
      )}

      {role === 'customer' && ['REQUESTED', 'ACCEPTED', 'INSPECTION'].includes(request.status) && (
        <button className="text-action danger-text" onClick={() => change('CANCELLED', 'Cancelled by customer')}>
          Cancel request
        </button>
      )}

      {role === 'repair_partner' && (
        <PartnerActions
          request={request}
          notes={notes}
          setNotes={setNotes}
          quote={quote}
          setQuote={setQuote}
          total={total}
          quoteOpen={quoteOpen}
          setQuoteOpen={setQuoteOpen}
          change={change}
        />
      )}
    </article>
  );
}

function PartnerActions({ request, notes, setNotes, quote, setQuote, total, quoteOpen, setQuoteOpen, change }) {
  if (request.status === 'REQUESTED') {
    return (
      <div className="request-actions">
        <button className="solid-action" onClick={() => change('ACCEPTED', 'Repair Partner accepted the request')}>
          Accept request <span>→</span>
        </button>
        <button className="outline-action danger-outline" onClick={() => change('CANCELLED', 'Repair Partner declined')}>
          Decline
        </button>
      </div>
    );
  }

  if (request.status === 'ACCEPTED') {
    return (
      <div className="request-actions">
        <button className="solid-action" onClick={() => change('INSPECTION', 'Physical inspection started')}>
          Start inspection <span>→</span>
        </button>
      </div>
    );
  }

  if (request.status === 'INSPECTION') {
    return (
      <div className="quote-editor">
        <label>
          Inspection findings
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document confirmed root cause and parts required."
          />
        </label>
        {quoteOpen ? (
          <>
            <div className="form-three">
              <label>Labor <input type="number" min="0" value={quote.labor} onChange={(e) => setQuote({ ...quote, labor: e.target.value })} /></label>
              <label>Parts <input type="number" min="0" value={quote.parts} onChange={(e) => setQuote({ ...quote, parts: e.target.value })} /></label>
              <label>Visit fee <input type="number" min="0" value={quote.visit} onChange={(e) => setQuote({ ...quote, visit: e.target.value })} /></label>
            </div>
            <label>
              Quote notes
              <input value={quote.note} onChange={(e) => setQuote({ ...quote, note: e.target.value })} placeholder="e.g. Includes compressor relay replacement with 6-month warranty" />
            </label>
            <div className="quote-total">
              Customer will review <b>{money(total)}</b> before approval.
            </div>
            <button className="solid-action" disabled={!notes || total <= 0} onClick={() => change('QUOTE_PENDING', 'Itemized quote submitted for customer approval')}>
              Submit itemized quote <span>→</span>
            </button>
          </>
        ) : (
          <button className="outline-action" onClick={() => setQuoteOpen(true)}>
            Prepare itemized quote →
          </button>
        )}
      </div>
    );
  }

  if (request.status === 'APPROVED') {
    return (
      <div className="request-actions">
        <button className="solid-action" onClick={() => change('IN_PROGRESS', 'Repair work commenced after customer approval')}>
          Start approved repair <span>→</span>
        </button>
      </div>
    );
  }

  if (request.status === 'IN_PROGRESS') {
    return (
      <div className="request-actions">
        <button className="solid-action" onClick={() => change('COMPLETED', 'Repair marked completed by technician')}>
          Mark repair complete <span>→</span>
        </button>
      </div>
    );
  }

  return null;
}

function Status({ status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{displayStatus(status)}</span>;
}

function RequestSummary({ request }) {
  return (
    <div className="mini-request">
      <div className="mini-device">⌁</div>
      <div>
        <b>{request.deviceCategory} · {request.brandModel}</b>
        <p>{request.symptoms}</p>
        <Status status={request.status} />
      </div>
    </div>
  );
}

function PartnerView({ active, user, store, requests, updateRequest, setStore, notify }) {
  const partnerRequests = requests.filter((r) => !r.partnerId || r.partnerId === user.id || r.partnerId === 'partner-anu');

  if (active === 'incoming') {
    return (
      <PartnerRequests
        title="Incoming repair requests"
        copy="Requests matched to your categories and service locality."
        requests={partnerRequests.filter((r) => ['REQUESTED', 'ACCEPTED', 'INSPECTION', 'QUOTE_PENDING', 'APPROVED'].includes(r.status))}
        updateRequest={updateRequest}
        notify={notify}
      />
    );
  }

  if (active === 'active' || active === 'quotes') {
    return (
      <PartnerRequests
        title={active === 'quotes' ? 'Quotes and estimates' : 'Active repairs'}
        copy={active === 'quotes' ? 'Itemized quotes require customer explicit approval.' : 'Approved work in progress.'}
        requests={partnerRequests.filter((r) => (active === 'quotes' ? ['INSPECTION', 'QUOTE_PENDING', 'APPROVED'].includes(r.status) : ['ACCEPTED', 'INSPECTION', 'APPROVED', 'IN_PROGRESS'].includes(r.status)))}
        updateRequest={updateRequest}
        notify={notify}
      />
    );
  }

  if (active === 'availability') return <Availability user={user} profile={store.partnerProfile} setStore={setStore} notify={notify} />;
  if (active === 'profile') return <PartnerProfile user={user} profile={store.partnerProfile} setStore={setStore} notify={notify} />;
  if (active === 'verification') return <Verification />;
  if (active === 'appointments') return <Appointments requests={partnerRequests.filter((r) => r.appointment)} />;
  if (active === 'settings') return <Settings user={user} />;
  return <PartnerOverview user={user} requests={partnerRequests} />;
}

function PartnerOverview({ user, requests }) {
  const pending = requests.filter((r) => r.status === 'REQUESTED').length;
  const inProgress = requests.filter((r) => ['ACCEPTED', 'INSPECTION', 'APPROVED', 'IN_PROGRESS'].includes(r.status)).length;

  return (
    <>
      <section className="welcome-row">
        <div>
          <span className="portal-eyebrow">REPAIR PARTNER OVERVIEW</span>
          <h2>Welcome back, <i>{user.name.split(' ')[0]}.</i></h2>
          <p>Manage repair intake, submit transparent inspection quotes, and complete approved repairs.</p>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="Incoming requests" value={pending} icon="↓" />
        <Metric label="Active repairs" value={inProgress} icon="⌁" />
        <Metric label="Quotes pending approval" value={requests.filter((r) => r.status === 'QUOTE_PENDING').length} icon="▤" />
        <Metric label="Completed repairs" value={requests.filter((r) => r.status === 'COMPLETED').length} icon="✓" />
      </section>

      <section className="dashboard-grid">
        <article className="panel request-panel">
          <PanelHeading kicker="NEXT IN QUEUE" title={pending ? `${pending} request${pending > 1 ? 's' : ''} awaiting response` : 'Queue clear'} />
          {pending ? (
            <RequestSummary request={requests.find((r) => r.status === 'REQUESTED')} />
          ) : (
            <EmptyCompact copy="New customer repair requests will appear here." button="Check incoming" onClick={() => {}} />
          )}
        </article>
        <article className="panel how-panel">
          <PanelHeading kicker="PARTNER WORKFLOW" title="Clear customer standards" />
          <ol>
            <li><b>1</b><span>Inspect equipment on-site</span></li>
            <li><b>2</b><span>Submit itemized parts & labor</span></li>
            <li><b>3</b><span>Begin repair only after customer approval</span></li>
          </ol>
          <p>Every quote approval is permanently documented in the customer timeline.</p>
        </article>
      </section>
    </>
  );
}

function PartnerRequests({ title, copy, requests, updateRequest, notify }) {
  return (
    <section>
      <div className="section-lead compact">
        <div>
          <span className="portal-eyebrow">PARTNER WORKSPACE</span>
          <h2>{title.split(' ').slice(0, -1).join(' ')} <i>{title.split(' ').slice(-1)}</i></h2>
        </div>
        <p>{copy}</p>
      </div>
      {requests.length ? (
        <div className="request-stack">
          {requests.map((r) => (
            <RequestDetail key={r.id} request={r} role="repair_partner" updateRequest={updateRequest} notify={notify} />
          ))}
        </div>
      ) : (
        <EmptyState icon="↓" title="No requests at this stage" copy="Requests will appear here as repairs progress." />
      )}
    </section>
  );
}

function Availability({ user, profile, setStore, notify }) {
  const [newSlot, setNewSlot] = useState('');
  const slots = profile.slots || [];

  const updateSlots = (next) => {
    const updated = { ...profile, slots: next };
    setStore((st) => ({ ...st, partnerProfile: updated }));
    notify({ kind: 'info', text: 'Availability updated.' });
  };

  return (
    <section className="single-panel">
      <div className="section-lead compact">
        <div>
          <span className="portal-eyebrow">SERVICE SLOTS</span>
          <h2>Manage <i>availability.</i></h2>
        </div>
      </div>
      <article className="panel availability-panel">
        <p>Customers can book these slots when selecting your profile.</p>
        <div className="slot-list">
          {slots.map((s) => (
            <span key={s}>
              {s}
              <button onClick={() => updateSlots(slots.filter((x) => x !== s))}>×</button>
            </span>
          ))}
        </div>
        <div className="slot-add">
          <input
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
            placeholder="e.g. Saturday · 11:00–13:00"
          />
          <button
            className="solid-action"
            onClick={() => {
              if (!newSlot.trim()) return;
              updateSlots([...slots, newSlot.trim()]);
              setNewSlot('');
            }}
          >
            Add slot
          </button>
        </div>
      </article>
    </section>
  );
}

function PartnerProfile({ user, profile, setStore, notify }) {
  const [data, setData] = useState(profile);

  function save(draft) {
    const updated = { ...data, draft };
    setStore((s) => ({ ...s, partnerProfile: updated }));
    notify({ kind: 'info', text: draft ? 'Draft profile saved.' : 'Business profile published.' });
  }

  return (
    <section className="single-panel">
      <div className="section-lead compact">
        <div>
          <span className="portal-eyebrow">BUSINESS PROFILE</span>
          <h2>Technician <i>credentials.</i></h2>
        </div>
      </div>
      <article className="panel profile-form">
        <div className="form-two">
          <label>
            Business / display name
            <input value={data.businessName || ''} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
          </label>
          <label>
            Service locality
            <input value={data.locality || ''} onChange={(e) => setData({ ...data, locality: e.target.value })} />
          </label>
        </div>
        <div className="form-two">
          <label>
            Years of experience
            <input type="number" min="0" value={data.experience || ''} onChange={(e) => setData({ ...data, experience: e.target.value })} />
          </label>
          <label>
            Repair categories
            <input
              value={(data.categories || []).join(', ')}
              onChange={(e) => setData({ ...data, categories: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
            />
          </label>
        </div>
        <label>
          Professional introduction
          <textarea value={data.intro || ''} onChange={(e) => setData({ ...data, intro: e.target.value })} />
        </label>
        <div className="dual-actions">
          <button className="outline-action" onClick={() => save(true)}>Save draft</button>
          <button className="solid-action" onClick={() => save(false)}>Save business profile <span>→</span></button>
        </div>
      </article>
    </section>
  );
}

function Verification() {
  return (
    <section className="single-panel">
      <article className="panel verification-panel">
        <span className="portal-eyebrow">PARTNER BADGE</span>
        <div className="verification-mark">✓</div>
        <h2>Certified Partner Status</h2>
        <p>RepairMe partners undergo identity and trade experience verification before receiving automated service dispatches.</p>
        <div>
          <b>Partner Standards</b>
          <span>Clear diagnostic visits, itemized written estimates, and 90-day service warranty on replaced components.</span>
        </div>
      </article>
    </section>
  );
}

function Appointments({ requests }) {
  const upcoming = requests.filter((r) => r.appointment && !['COMPLETED', 'CANCELLED'].includes(r.status));
  return (
    <section className="single-panel">
      <div className="section-lead compact">
        <div>
          <span className="portal-eyebrow">SCHEDULE</span>
          <h2>Confirmed <i>appointments.</i></h2>
        </div>
      </div>
      {upcoming.length ? (
        <div className="appointment-list">
          {upcoming.map((r) => (
            <article className="panel" key={r.id}>
              <Glyph>◷</Glyph>
              <div>
                <b>{r.appointment}</b>
                <span>{r.deviceCategory} · {r.brandModel}</span>
                <small>{r.locality} · {displayStatus(r.status)}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="◷" title="No appointments scheduled" copy="Confirmed appointments will appear here after booking." />
      )}
    </section>
  );
}

function SavedDevices() {
  return (
    <section className="single-panel">
      <EmptyState icon="▣" title="No saved devices" copy="Your submitted repair requests retain full device specifications and diagnostic records automatically." />
    </section>
  );
}

function Settings({ user }) {
  return (
    <section className="single-panel">
      <article className="panel settings-card">
        <span className="portal-eyebrow">ACCOUNT</span>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <RoleBadge role={user.role} />
        <hr />
        <b>Privacy & Safety</b>
        <p>Contact information is shared exclusively with the assigned technician once a booking is confirmed.</p>
      </article>
    </section>
  );
}

function EmptyState({ icon, title, copy }) {
  return (
    <div className="empty-state">
      <Glyph>{icon}</Glyph>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}
