import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Platform } from './platform.jsx';
import { makeDiagnosis, makeEstimate, money } from './lib/domain.js';
import './styles.css';

const Icon = ({ name, size = 20, stroke = 1.9, className = '' }) => {
  const paths = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4.1 4L19 6.5"/>,
    shield: <><path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    spark: <><path d="M12 2 9.8 9.8 2 12l7.8 2.2L12 22l2.2-7.8L22 12l-7.8-2.2L12 2Z"/><path d="m5 3 .5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5L5 3Z"/></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2m4 0h2m-8 4h2m4 0h2m-8 3h2m4 0h2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 10h8m-8 4h5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    wrench: <><path d="M14.7 6.3a5 5 0 0 0-6.8 6.8L3 18l3 3 4.9-4.9a5 5 0 0 0 6.8-6.8l-3 3-2.5-.5-.5-2.5 3.1-3.1Z"/></>,
    map: <><path d="m9 18-6-3V5l6 3 6-3 6 3v10l-6-3-6 3Z"/><path d="M9 8v10M15 5v10"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    star: <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z"/>,
    play: <path d="m9 6 8 6-8 6V6Z"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    alert: <><path d="M10.3 3.8 2.4 17.1A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.9L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
    laptop: <><rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 18h20"/></>,
    fridge: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 11h12M9 6v2M9 15v3"/></>,
    washing: <><rect x="3.5" y="2.5" width="17" height="19" rx="2"/><circle cx="12" cy="14" r="4"/><path d="M7 6h.01M10 6h4"/></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

const scenarios = [
  { key: 'fridge', label: 'Fridge not cooling', icon: 'fridge', type: 'Refrigerator', symptom: 'The fridge is running continuously but not cooling properly. Food is warmer than usual.', price: '₹1,200–₹3,800', cause: 'Airflow restriction or cooling-system fault', tone: 'mint' },
  { key: 'wash', label: 'Washer won’t drain', icon: 'washing', type: 'Washing machine', symptom: 'Water remains in the drum after the wash cycle and the machine refuses to drain.', price: '₹850–₹2,600', cause: 'A blocked drain filter or pump obstruction', tone: 'blue' },
  { key: 'laptop', label: 'Laptop overheating', icon: 'laptop', type: 'Laptop', symptom: 'Laptop gets excessively hot, throttles performance, and shuts off unexpectedly during workloads.', price: '₹900–₹3,200', cause: 'Dust buildup in cooling heatsink or fan wear', tone: 'amber' },
  { key: 'unsafe', label: 'Burning smell', icon: 'alert', type: 'Refrigerator', symptom: 'There is an acrid burning smell and a small spark near the compressor power cord.', price: 'Safety review first', cause: 'Immediate electrical hazard', tone: 'coral', unsafe: true },
];

const featureCards = [
  { icon: 'spark', number: '01', title: 'Clarity, before commitment', copy: 'Turn an uncertain symptom into understandable possibilities and the safest next step with real AI diagnosis.', link: 'See how diagnosis works' },
  { icon: 'calculator', number: '02', title: 'Estimates you can inspect', copy: 'See diagnostic visit, labor, and parts calculated transparently — not one unexplained sum.', link: 'Explore transparent estimates' },
  { icon: 'users', number: '03', title: 'A choice that stays yours', copy: 'Compare verified specialists and approve itemized quotes before any repair work starts.', link: 'How technician matching works' },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showPlatform, setShowPlatform] = useState(() => window.location.pathname === '/auth/callback');
  const [formData, setFormData] = useState({ device: 'Refrigerator', details: '', locality: '' });
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [platformDraft, setPlatformDraft] = useState(null);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  const runDiagnosis = async (device, details, locality = '') => {
    setIsAssessing(true);
    let diagnosis = null;

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceCategory: device,
          symptoms: details,
          locality,
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.diagnosis) diagnosis = payload.diagnosis;
      }
    } catch (e) {
      console.warn('Diagnosis network note:', e);
    }

    if (!diagnosis) {
      diagnosis = makeDiagnosis({ deviceCategory: device, symptoms: details });
    }

    const estimate = makeEstimate(device);
    setAssessmentResult({
      form: { deviceCategory: device, symptoms: details, locality },
      diagnosis,
      estimate,
    });
    setIsAssessing(false);
  };

  const chooseScenario = (scenario) => {
    setSelectedScenario(scenario);
    setFormData({ device: scenario.type, details: scenario.symptom, locality: '' });
    scrollTo('diagnose');
    runDiagnosis(scenario.type, scenario.symptom);
  };

  const submitIntake = (event) => {
    event.preventDefault();
    if (!formData.device || !formData.details.trim()) return;
    runDiagnosis(formData.device, formData.details, formData.locality);
  };

  const openPlatformWithDraft = (draft) => {
    setPlatformDraft(draft);
    setShowPlatform(true);
  };

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && setShowExplorer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (showPlatform) {
    return (
      <Platform
        initialDraft={platformDraft}
        onExit={() => {
          window.history.replaceState({}, '', '/');
          setShowPlatform(false);
        }}
      />
    );
  }

  return (
    <div className="site-shell">
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Main navigation">
          <button className="brand" onClick={() => scrollTo('top')} aria-label="RepairMe home">
            <span className="brand-mark"><Icon name="wrench" size={19} /></span>
            <span>Repair<span>Me</span></span>
          </button>
          <div className="nav-links">
            <button onClick={() => scrollTo('how-it-works')}>How it works</button>
            <button onClick={() => scrollTo('why-repairme')}>Why RepairMe</button>
            <button onClick={() => scrollTo('diagnose')}>Live AI Diagnosis</button>
          </div>
          <button className="nav-cta" onClick={() => setShowPlatform(true)}>
            Sign in / get started <Icon name="arrow" size={16} />
          </button>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" aria-expanded={menuOpen}>
            <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
          </button>
        </nav>
        {menuOpen && (
          <div className="mobile-menu">
            <button onClick={() => scrollTo('how-it-works')}>How it works</button>
            <button onClick={() => scrollTo('why-repairme')}>Why RepairMe</button>
            <button onClick={() => scrollTo('diagnose')}>Live AI Diagnosis</button>
            <button className="mobile-cta" onClick={() => setShowPlatform(true)}>
              Sign in / get started <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot"></span> Powered by OpenRouter AI</div>
            <h1>Repair with <em>clarity.</em><br />Not guesswork.</h1>
            <p className="hero-sub">Understand what could be wrong, inspect transparent itemized pricing, and book verified repair specialists — all before you spend a rupee.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => scrollTo('diagnose')}>
                Diagnose my device <Icon name="arrow" size={18} />
              </button>
              <button className="button button-text" onClick={() => setShowExplorer(true)}>
                <span className="play-circle"><Icon name="play" size={14} /></span> Common problem explorer
              </button>
            </div>
            <div className="trust-row">
              <span><Icon name="shield" size={17} /> You’re always in control</span>
              <span className="trust-divider"></span>
              <span><Icon name="check" size={17} /> No unauthorized work</span>
            </div>
          </div>
          <div className="hero-art" aria-label="RepairMe repair assessment preview">
            <div className="art-grid"></div>
            <div className="hero-sun"></div>
            <div className="hero-arc arc-one"></div>
            <div className="hero-arc arc-two"></div>
            <div className="main-device-card">
              <div className="card-topline">
                <span className="status-live"><i></i> Live AI Diagnostic</span>
                <span className="more">•••</span>
              </div>
              <div className="device-visual">
                <div className="fridge-illustration"><span></span><i></i><b></b></div>
                <div className="device-glow"></div>
              </div>
              <div className="assessment-title">
                <div><small>DEVICE CATEGORY</small><strong>Refrigerator</strong></div>
                <span className="confidence-pill">AI Analyzed</span>
              </div>
              <div className="assessment-divider"></div>
              <div className="assessment-item">
                <span className="mini-icon mint"><Icon name="spark" size={14} /></span>
                <div><small>PRIMARY CAUSE</small><b>Cooling airflow restriction</b></div>
                <Icon name="chevron" size={17} />
              </div>
              <div className="assessment-item">
                <span className="mini-icon navy"><Icon name="calculator" size={14} /></span>
                <div><small>ESTIMATED RANGE</small><b>₹1,200 — ₹3,800</b></div>
                <Icon name="chevron" size={17} />
              </div>
            </div>
            <div className="floating-chip chip-safe">
              <span><Icon name="shield" size={15} /></span>
              <div><b>Safety checked</b><small>AI safety protocols</small></div>
            </div>
            <div className="floating-chip chip-quote">
              <span><Icon name="check" size={15} /></span>
              <div><b>Itemized quote</b><small>Approval required</small></div>
            </div>
          </div>
        </section>

        <section className="proof-strip">
          <div className="container proof-inner">
            <span>Designed for the critical questions people ask <b>before a repair:</b></span>
            <div className="proof-topics">
              <span>“Is it safe to run?”</span>
              <span>“What is the realistic cost?”</span>
              <span>“Who is certified to fix it?”</span>
            </div>
          </div>
        </section>

        <section className="section intro-section container" id="why-repairme">
          <div className="section-kicker">ONE REPAIR, TOO MANY UNKNOWNS</div>
          <div className="split-heading">
            <h2>A better way to get<br /><i>appliances working again.</i></h2>
            <p>A broken appliance should not mean an open checkbook. RepairMe gives you a guided, cautious path from “something went wrong” to “I know exactly what to do next.”</p>
          </div>
          <div className="feature-grid">
            {featureCards.map((card, i) => (
              <article className={'feature-card feature-' + (i + 1)} key={card.title}>
                <div className="feature-number">{card.number}</div>
                <div className="feature-icon"><Icon name={card.icon} size={24} /></div>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
                <button onClick={() => scrollTo(i === 0 ? 'diagnose' : 'how-it-works')}>
                  {card.link} <Icon name="arrow" size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="section process-section" id="how-it-works">
          <div className="container">
            <div className="process-top">
              <div>
                <div className="section-kicker">ONE CLEAR PATH FORWARD</div>
                <h2>From problem to<br /><i>peace of mind.</i></h2>
              </div>
              <p>Every step replaces uncertainty with verified information — keeping full authority in your hands.</p>
            </div>
            <div className="process-list">
              {[
                ['01', 'Describe the issue', 'Tell us what’s happening in everyday words. Photos are optional.', 'clipboard'],
                ['02', 'Get AI-guided clarity', 'Receive objective possible causes, non-invasive safe checks, and safety rules.', 'spark'],
                ['03', 'Inspect itemized estimate', 'Review separate costs for the diagnostic visit, labor, and anticipated parts.', 'calculator'],
                ['04', 'Choose, book, and approve', 'Select a verified specialist. No repair begins without your explicit quote approval.', 'calendar'],
              ].map(([num, title, copy, icon]) => (
                <article className="process-step" key={num}>
                  <span className="step-number">{num}</span>
                  <div className="step-icon"><Icon name={icon} size={23} /></div>
                  <div className="step-copy">
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                  <Icon name="arrow" className="step-arrow" size={22} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section experience-section container">
          <div className="experience-layout">
            <div className="experience-copy">
              <div className="section-kicker">FROM UNCERTAINTY TO ACTION</div>
              <h2>Know the story<br />behind the <i>price.</i></h2>
              <p>A single unexplained price quote creates distrust. RepairMe breaks down the components of every estimate so you understand what to expect.</p>
              <ul>
                <li><span><Icon name="check" size={14} /></span> Itemized lines for visit, labor, and parts</li>
                <li><span><Icon name="check" size={14} /></span> Clear explanation of factors influencing costs</li>
                <li><span><Icon name="check" size={14} /></span> Written approval required before repairs begin</li>
              </ul>
              <button className="button button-dark" onClick={() => scrollTo('diagnose')}>
                Diagnose your device <Icon name="arrow" size={17} />
              </button>
            </div>
            <div className="estimate-card">
              <div className="estimate-head">
                <span className="estimate-symbol"><Icon name="calculator" size={19} /></span>
                <div><small>TRANSPARENT BREAKDOWN</small><strong>Refrigerator cooling service</strong></div>
                <span className="info-dot">i</span>
              </div>
              <div className="estimate-lines">
                <div><span>Diagnostic inspection visit</span><b>₹350</b></div>
                <div><span>Labor estimate</span><b>₹550 – ₹1,200</b></div>
                <div><span>Likely parts (fan / relay / sensor)</span><b>₹300 – ₹2,250</b></div>
              </div>
              <div className="estimate-total">
                <span>ESTIMATED REGIONAL RANGE</span>
                <strong>₹1,200 – ₹3,800</strong>
                <small>Final price requires physical inspection & your approval</small>
              </div>
              <div className="estimate-note">
                <Icon name="spark" size={15} />
                <span><b>Why this range?</b> Common cooling faults range from simple fan relay replacements to internal system repairs.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section demo-section" id="diagnose">
          <div className="container demo-layout">
            <div className="demo-side">
              <div className="section-kicker">INTERACTIVE INTAKE</div>
              <h2>Start with what<br />you <i>notice.</i></h2>
              <p>Select a common problem or describe yours. OpenRouter’s AI will provide a preliminary hypothesis, safety checks, and an itemized estimate.</p>
              <div className="scenario-list">
                {scenarios.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => chooseScenario(s)}
                    className={'scenario-button ' + (selectedScenario.key === s.key ? 'selected ' : '') + s.tone}
                  >
                    <span className="scenario-icon"><Icon name={s.icon} size={19} /></span>
                    <span>{s.label}</span>
                    <Icon name="chevron" size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="intake-card">
              <div className="intake-header">
                <span className="intake-step">{assessmentResult ? 'DIAGNOSTIC SUMMARY' : 'STEP 1 OF 3'}</span>
                <span className="intake-progress"><i></i><i></i><i></i></span>
              </div>

              {isAssessing ? (
                <div className="assessing-box">
                  <div className="assessing-spinner"></div>
                  <b>Analyzing symptoms with OpenRouter AI…</b>
                  <p>Evaluating potential failure modes, checking electrical safety, and assembling safe preliminary checks.</p>
                </div>
              ) : assessmentResult ? (
                <Assessment
                  result={assessmentResult}
                  onReset={() => setAssessmentResult(null)}
                  onBook={() => openPlatformWithDraft(assessmentResult)}
                />
              ) : (
                <form onSubmit={submitIntake}>
                  <h3>What needs attention?</h3>
                  <p>Tell us enough to evaluate the failure mode.</p>
                  <label>
                    Device category
                    <select
                      value={formData.device}
                      onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                      required
                    >
                      <option>Refrigerator</option>
                      <option>Washing machine</option>
                      <option>Laptop</option>
                      <option>Air conditioner</option>
                      <option>Smartphone</option>
                    </select>
                  </label>
                  <label>
                    What’s happening?
                    <textarea
                      value={formData.details}
                      onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                      placeholder="e.g. The refrigerator runs continuously but the fresh food compartment is not cooling..."
                      required
                    />
                  </label>
                  <label>
                    Locality <span className="optional">optional</span>
                    <input
                      value={formData.locality}
                      onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                      placeholder="e.g. Indiranagar, Koramangala"
                    />
                  </label>
                  <button className="button button-primary intake-submit" type="submit">
                    Run AI Diagnosis <Icon name="arrow" size={17} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-glow one"></div>
          <div className="cta-glow two"></div>
          <div className="container cta-inner">
            <div className="section-kicker light">REPAIR DECISIONS, MADE CLEAR</div>
            <h2>Give the next repair<br /><i>the clarity it deserves.</i></h2>
            <p>Start with a symptom. Leave with a plan and verified professionals you can trust.</p>
            <div>
              <button className="button button-light" onClick={() => scrollTo('diagnose')}>
                Diagnose my device <Icon name="arrow" size={18} />
              </button>
              <button className="button button-ghost" onClick={() => setShowPlatform(true)}>
                Sign in to platform <Icon name="arrow" size={13} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <button className="brand footer-brand" onClick={() => scrollTo('top')}>
            <span className="brand-mark"><Icon name="wrench" size={17} /></span>
            <span>Repair<span>Me</span></span>
          </button>
          <span>Transparent appliance diagnostics & certified repair network.</span>
          <span>© 2026 RepairMe · All quotes subject to on-site inspection.</span>
        </div>
      </footer>

      {showExplorer && (
        <ExplorerModal
          onClose={() => setShowExplorer(false)}
          onChoose={(s) => {
            chooseScenario(s);
            setShowExplorer(false);
          }}
        />
      )}
    </div>
  );
}

function Assessment({ result, onReset, onBook }) {
  const { diagnosis, estimate } = result;
  const isDanger = diagnosis.riskLevel === 'danger';

  return (
    <div className="assessment-result">
      <div className={`result-status ${isDanger ? 'danger' : ''}`}>
        <span><Icon name={isDanger ? 'alert' : 'spark'} size={17} /></span>
        <div>
          <small>{isDanger ? 'SAFETY INTERVENTION' : 'AI PRELIMINARY DIAGNOSIS'}</small>
          <b>{isDanger ? 'Stop use immediately and disconnect power' : 'Hypotheses evaluated by OpenRouter AI'}</b>
        </div>
      </div>

      <h3>{diagnosis.problemSummary}</h3>

      {diagnosis.possibleCauses?.length > 0 && (
        <div className="landing-causes">
          {diagnosis.possibleCauses.slice(0, 3).map((cause, i) => (
            <div key={i} className="landing-cause-item">
              <span className={`confidence ${cause.confidence.includes('urgent') ? 'danger' : ''}`}>
                {cause.confidence}
              </span>
              <b>{cause.cause}</b>
            </div>
          ))}
        </div>
      )}

      {diagnosis.safeChecks?.length > 0 && (
        <ul className="landing-checks">
          {diagnosis.safeChecks.slice(0, 3).map((check, i) => (
            <li key={i}>
              <Icon name="check" size={14} />
              <span>{check}</span>
            </li>
          ))}
        </ul>
      )}

      {!isDanger && (
        <div className="mini-estimate">
          <span>ESTIMATED REGIONAL COST RANGE</span>
          <strong>{money(estimate.totalMin)} – {money(estimate.totalMax)}</strong>
          <small>Includes diagnostic visit ({money(estimate.diagnosticFee)}), labor & likely parts</small>
        </div>
      )}

      <div className="result-actions" style={{ marginTop: '16px' }}>
        <button className="button button-primary" onClick={onBook}>
          {isDanger ? 'Find Emergency Technician' : 'Compare Technicians & Book'} <Icon name="arrow" size={16} />
        </button>
        <button className="plain-button" onClick={onReset}>
          Edit details
        </button>
      </div>
    </div>
  );
}

function ExplorerModal({ onClose, onChoose }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={onClose}>
      <div className="demo-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">
          <Icon name="close" size={21} />
        </button>
        <div className="modal-hero">
          <span className="modal-badge"><Icon name="play" size={12} /> COMMON ISSUES</span>
          <h2 id="modal-title">Explore common failure modes.</h2>
          <p>Choose an appliance scenario to see how RepairMe performs live AI diagnosis and itemized cost estimation.</p>
        </div>
        <div className="modal-scenarios">
          {scenarios.map((s) => (
            <button
              onClick={() => onChoose(s)}
              key={s.key}
              className={'modal-scenario ' + s.tone}
            >
              <span><Icon name={s.icon} size={20} /></span>
              <div>
                <b>{s.label}</b>
                <small>{s.unsafe ? 'Safety protocol' : 'Diagnosis · Estimate · Matching'}</small>
              </div>
              <Icon name="arrow" size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
