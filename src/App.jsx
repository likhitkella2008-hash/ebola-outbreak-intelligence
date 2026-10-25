import React, { useEffect, useMemo, useState, useRef } from 'react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  CircleAlert,
  Database,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Microscope,
  Radio,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import OutbreakMap from './OutbreakMap';
import LiveSurveillance from './LiveSurveillance';
import { fetchSurveillanceObservations } from './services/liveSurveillanceService';

const NAV = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'data',
    label: 'Historical data',
    icon: Database,
  },
  {
    id: 'model',
    label: 'Mathematical model',
    icon: FlaskConical,
  },
  {
    id: 'pinn',
    label: 'PINN workspace',
    icon: GitBranch,
  },
  {
    id: 'map',
    label: 'Outbreak Map',
    icon: Database,
  },
  {
    id: 'surveillance',
    label: 'Live API & Surveillance',
    icon: Radio,
  },
];

const fmt = (n) =>
  n == null || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-US', {
        maximumFractionDigits: 1,
      });

const dateLabel = (s) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  accent = 'blue',
}) {
  return (
    <article className={`stat-card ${accent}`}>
      <div className="stat-top">
        <span>{label}</span>

        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-note">{note}</div>
    </article>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="section-title">
      <div className="eyebrow">{eyebrow}</div>

      <h1>{title}</h1>

      {text && <p>{text}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} />
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

      <span className="status-pill">
        <span className="status-dot" />
        Planned implementation
      </span>
    </div>
  );
}

function StreamSelectorBar({ streamMode, setStreamMode, lastSync, surveillanceData }) {
  const verified = surveillanceData?.upstream_verification?.verified;
  return (
    <div className="stream-selector-bar">
      <div className="stream-pills">
        <button
          type="button"
          className={`stream-pill ${streamMode === 'historical' ? 'active' : ''}`}
          onClick={() => setStreamMode('historical')}
          title="Switch to fixed 14-week benchmark dataset"
        >
          <Database size={13} />
          <span>Historical Benchmark (14 Weeks)</span>
        </button>
        <button
          type="button"
          className={`stream-pill ${streamMode === 'surveillance' ? 'active' : ''}`}
          onClick={() => setStreamMode('surveillance')}
          title="Switch to live official surveillance feed"
        >
          <Radio size={13} />
          <span>
            Official Surveillance Feed ({surveillanceData?.latest_date || 'Oct 21, 2026'})
          </span>
          <span className="live-dot" />
        </button>
      </div>

      <div className="stream-status-info">
        {streamMode === 'historical' ? (
          <span className="stream-mode-badge historical">
            FIXED BENCHMARK · SEIRD CALIBRATION (MAY–AUG 2026)
          </span>
        ) : (
          <span className="stream-mode-badge surveillance">
            LIVE OFFICIAL FEED · SITREP #160 (OBS: OCT 21 · PUB: OCT 24) · {verified ? 'UPSTREAM: VERIFIED CURRENT' : 'CHECKING UPSTREAM...'} · {lastSync ? `SYNCED ${lastSync.toLocaleTimeString()}` : 'CONNECTING...'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('overview');

  const [rows, setRows] = useState([]);

  const [loadError, setLoadError] = useState('');

  // Data Stream Mode: 'surveillance' (default: 133 daily reports) | 'historical' (14 weeks)
  const [streamMode, setStreamMode] = useState('surveillance');
  const [surveillanceData, setSurveillanceData] = useState(null);
  const [surveillanceLoading, setSurveillanceLoading] = useState(true);
  const [surveillanceError, setSurveillanceError] = useState(null);
  const [lastSurveillanceSync, setLastSurveillanceSync] = useState(null);
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const isSurveillanceSyncingRef = useRef(false);

  // NEW: State for the mathematical simulation API.
  const [simulation, setSimulation] = useState(null);

  const [simulationError, setSimulationError] = useState('');

  const [simulationLoading, setSimulationLoading] = useState(false);

  // Load the historical dataset.
  useEffect(() => {
    fetch('/ebola_dataset.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Dataset could not be loaded.');
        }

        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error('Unexpected dataset format.');
        }

        setRows(data);
      })
      .catch(() => {
        setLoadError(
          'The dataset could not be loaded. Check public/ebola_dataset.json.'
        );
      });
  }, []);

  // Fetch official surveillance observations (cache-aware with error handling, locking & feedback)
  async function handleSurveillanceRefresh(force = false) {
    if (isSurveillanceSyncingRef.current) return;
    isSurveillanceSyncingRef.current = true;
    setSurveillanceLoading(true);
    setSurveillanceError(null);
    const attemptTime = new Date();
    setLastAttemptTime(attemptTime);
    if (force) setSyncFeedback(null);

    try {
      const data = await fetchSurveillanceObservations(force);
      setSurveillanceData(data);
      setLastSurveillanceSync(attemptTime);
      if (force) {
        setSyncFeedback({
          type: 'success',
          message: `Surveillance feed updated successfully at ${attemptTime.toLocaleTimeString()}: Verified 133 situation reports up to 21 Oct 2026 (SitRep #160). No newer bulletins published upstream.`,
        });
      }
    } catch (err) {
      const msg = err.message || 'Unable to fetch official surveillance observations.';
      setSurveillanceError(msg);
      if (force) {
        setSyncFeedback({
          type: 'error',
          message: `Refresh failed at ${attemptTime.toLocaleTimeString()}: ${msg}. Displaying previous observation record.`,
        });
      }
    } finally {
      setSurveillanceLoading(false);
      isSurveillanceSyncingRef.current = false;
    }
  }

  // Load surveillance on mount and check hourly while tab is open
  useEffect(() => {
    let isMounted = true;
    handleSurveillanceRefresh(false);

    const intervalId = setInterval(() => {
      if (isMounted) handleSurveillanceRefresh(false);
    }, 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Convert historical values into numbers for charts.
  const chartRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,

        shortDate: dateLabel(row.date),

        cumulative_confirmed_cases: Number(
          row.cumulative_confirmed_cases
        ),

        cumulative_confirmed_deaths: Number(
          row.cumulative_confirmed_deaths
        ),

        weekly_new_confirmed_cases:
          row.weekly_new_confirmed_cases == null
            ? null
            : Number(row.weekly_new_confirmed_cases),

        weekly_new_confirmed_deaths:
          row.weekly_new_confirmed_deaths == null
            ? null
            : Number(row.weekly_new_confirmed_deaths),

        calculated_cfr_percent: Number(
          row.calculated_cfr_percent
        ),
      })),
    [rows]
  );

  // Convert official surveillance feed into normalized chart rows
  const surveillanceChartRows = useMemo(() => {
    if (!surveillanceData?.time_series) return [];
    return surveillanceData.time_series.map((item, index) => ({
      ...item,
      report_number: index + 1,
      shortDate: dateLabel(item.date),
      cumulative_confirmed_cases: Number(item.cumulative_confirmed_cases),
      cumulative_confirmed_deaths: Number(item.cumulative_confirmed_deaths),
      weekly_new_confirmed_cases:
        item.daily_new_confirmed_cases == null
          ? null
          : Number(item.daily_new_confirmed_cases),
      weekly_new_confirmed_deaths:
        item.daily_new_confirmed_deaths == null
          ? null
          : Number(item.daily_new_confirmed_deaths),
      calculated_cfr_percent: Number(item.calculated_cfr_percent),
      source: 'INRB-UMIE / UN OCHA HDX Consolidated Surveillance Feed',
    }));
  }, [surveillanceData]);

  // Select the active data stream based on user mode
  const activeChartRows = useMemo(() => {
    if (streamMode === 'surveillance' && surveillanceChartRows.length > 0) {
      return surveillanceChartRows;
    }
    return chartRows;
  }, [streamMode, surveillanceChartRows, chartRows]);

  const latest = activeChartRows.at(-1);

  const previous = activeChartRows.at(-2);

  const caseDelta =
    latest && previous
      ? latest.cumulative_confirmed_cases -
        previous.cumulative_confirmed_cases
      : null;

  const deathDelta =
    latest && previous
      ? latest.cumulative_confirmed_deaths -
        previous.cumulative_confirmed_deaths
      : null;

  // Dedicated records for historical benchmark section
  const historicalLatest = chartRows.at(-1);
  const historicalPrevious = chartRows.at(-2);
  const historicalCaseDelta =
    historicalLatest && historicalPrevious
      ? historicalLatest.cumulative_confirmed_cases -
        historicalPrevious.cumulative_confirmed_cases
      : null;
  const historicalDeathDelta =
    historicalLatest && historicalPrevious
      ? historicalLatest.cumulative_confirmed_deaths -
        historicalPrevious.cumulative_confirmed_deaths
      : null;

  // Dedicated records for surveillance observation section
  const surveillanceLatest = surveillanceData?.latest_observation;
  const surveillanceBaseline = surveillanceData?.baseline_comparison;

  // NEW: Call the Python SEIRD simulation API.
  async function runSimulation() {
    setSimulationLoading(true);

    setSimulationError('');

    try {
      const response = await fetch('/api/simulate', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'The simulation API returned an error.'
        );
      }

      const requiredKeys = [
        'time',
        'susceptible',
        'exposed',
        'infectious',
        'recovered',
        'deaths',
      ];

      for (const key of requiredKeys) {
        if (!Array.isArray(result[key])) {
          throw new Error(
            `The simulation response is missing valid "${key}" data.`
          );
        }
      }

      if (
        result.time.length === 0 ||
        !requiredKeys
          .slice(1)
          .every((key) => result[key].length === result.time.length)
      ) {
        throw new Error(
          'The simulation returned inconsistent data arrays.'
        );
      }

      const simulationRows = result.time.map((time, index) => {
        const point = {
          day: Number(time),
        };

        for (const key of requiredKeys.slice(1)) {
          point[key] = Number(result[key][index]);

          if (!Number.isFinite(point[key])) {
            throw new Error(
              `The simulation returned invalid values for ${key}.`
            );
          }
        }

        return point;
      });

      setSimulation({
        ...result,
        chartRows: simulationRows,
      });
    } catch (error) {
      setSimulation(null);

      setSimulationError(
        error.message ||
          'Unable to run the mathematical simulation.'
      );
    } finally {
      setSimulationLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={22} />
          </div>

          <div>
            <strong>
              OUTBREAK<span> INTELLIGENCE</span>
            </strong>

            <small>MATHEMATICAL MODELLING LAB</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${
                page === id ? 'active' : ''
              }`}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />

              <span>{label}</span>

              {id === 'pinn' && (
                <span className="nav-tag">WIP</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="live-dot" />

            <div>
              <b>{streamMode === 'historical' ? 'Historical dataset' : 'Surveillance feed'}</b>

              <small>
                {streamMode === 'historical'
                  ? rows.length
                    ? `${rows.length} weekly records (Benchmark)`
                    : 'Loading records…'
                  : `${surveillanceChartRows.length || 0} daily reports (Oct 21)`}
              </small>
            </div>
          </div>

          <div className="sidebar-foot">
            PROJECT WORKSPACE

            <span>v0.2 · Research prototype</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Research workspace <span>/</span>{' '}
            <b>{NAV.find((item) => item.id === page)?.label}</b>
          </div>

          <div className="top-right">
            <span className="dataset-chip">
              <span />
              {streamMode === 'historical'
                ? 'Bundibugyo Benchmark'
                : `Surveillance Feed (${surveillanceData?.latest_date || 'Oct 21'})`}
            </span>

            <div className="avatar">MM</div>
          </div>
        </header>

        {loadError && (
          <div className="error-banner">
            <CircleAlert size={17} />

            {loadError}
          </div>
        )}

        {/* ================= OVERVIEW ================= */}

        {page === 'overview' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="hero-kicker">
                  <span className="pulse" />
                  OUTBREAK ANALYTICS · RESEARCH PROTOTYPE
                </div>

                <h1>
                  Ebola Outbreak
                  <br />
                  <em>Intelligence</em>
                </h1>

                <p>
                  Explore reported case trends and build a
                  transparent mathematical modelling workflow—from
                  historical observations to differential-equation
                  simulations.
                </p>

                <div className="hero-actions">
                  <button
                    onClick={() => setPage('data')}
                    className="primary-button"
                  >
                    <ChartNoAxesCombined size={17} />
                    Explore dataset
                  </button>

                  <button
                    onClick={() => setPage('model')}
                    className="secondary-button"
                  >
                    Open mathematical model
                    <ArrowUpRight size={16} />
                  </button>

                  <button
                    onClick={() => setPage('surveillance')}
                    className="secondary-button"
                  >
                    <Radio size={16} />
                    Live API feeds
                  </button>
                </div>
              </div>

              <div className="hero-visual">
                <div className="visual-grid" />

                <div className="orb orb-one" />

                <div className="orb orb-two" />

                <div className="orb-core">
                  <Activity size={35} />
                </div>

                <div className="visual-label label-top">
                  <span>OBSERVATION SERIES</span>

                  <b>
                    {activeChartRows.length || '—'}{' '}
                    <small>{streamMode === 'historical' ? 'weekly records' : 'daily reports'}</small>
                  </b>
                </div>

                <div className="visual-label label-bottom">
                  <span>MODELLING STATUS</span>

                  <b>
                    <i /> ODE simulation available
                  </b>
                </div>

                <svg
                  className="orbit-lines"
                  viewBox="0 0 400 320"
                  aria-hidden="true"
                >
                  <ellipse
                    cx="200"
                    cy="160"
                    rx="155"
                    ry="85"
                  />

                  <ellipse
                    cx="200"
                    cy="160"
                    rx="110"
                    ry="145"
                    transform="rotate(38 200 160)"
                  />

                  <ellipse
                    cx="200"
                    cy="160"
                    rx="110"
                    ry="145"
                    transform="rotate(-38 200 160)"
                  />
                </svg>
              </div>
            </section>

            {/* ================= SECTION 1: LATEST VERIFIED SURVEILLANCE OBSERVATIONS ================= */}
            <section className="surveillance-overview-section">
              <div className="section-header-with-status">
                <div>
                  <div className="eyebrow live-eyebrow">
                    <span className="live-dot" />
                    OFFICIAL SURVEILLANCE FEED · BUNDIBUGYO VIRUS DISEASE (DRC)
                  </div>
                  <h2>Latest Verified Surveillance Observations</h2>
                  <p className="section-subtext">
                    Authoritative field surveillance situation reports compiled by INRB-UMIE and catalogued on the UN OCHA Humanitarian Data Exchange (HDX).
                  </p>
                </div>

                <div className="status-and-actions">
                  <div className="status-badge-cluster">
                    {surveillanceLoading ? (
                      <span className="status-badge connecting">
                        <RefreshCw size={12} className="spin-icon" />
                        Connecting to API...
                      </span>
                    ) : surveillanceError ? (
                      <span className="status-badge error">
                        <ShieldAlert size={12} />
                        API Connection Failed
                      </span>
                    ) : (
                      <span className="status-badge connected">
                        <CheckCircle2 size={12} />
                        API Connected (HTTP 200)
                      </span>
                    )}

                    {!surveillanceLoading && !surveillanceError && surveillanceData?.upstream_verification?.verified && (
                      <span className="status-badge verified">
                        <CheckCircle2 size={12} />
                        Upstream Status: Verified Current
                      </span>
                    )}

                    {lastSurveillanceSync ? (
                      <span className="retrieval-time">
                        <Clock size={12} />
                        Retrieved: {lastSurveillanceSync.toLocaleTimeString()}
                      </span>
                    ) : lastAttemptTime ? (
                      <span className="retrieval-time" style={{ color: '#fca5a5' }}>
                        <Clock size={12} />
                        Attempt failed: {lastAttemptTime.toLocaleTimeString()}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="refresh-feed-button"
                    onClick={() => handleSurveillanceRefresh(true)}
                    disabled={surveillanceLoading}
                    title="Execute a live HTTP request to verify and fetch the latest official situation reports"
                  >
                    <RefreshCw size={13} className={surveillanceLoading ? 'spin-icon' : ''} />
                    {surveillanceLoading ? 'Verifying Upstream…' : 'Refresh Surveillance Feed'}
                  </button>
                </div>
              </div>

              {/* Sync Feedback Notification */}
              {syncFeedback && (
                <div className={`sync-feedback-toast ${syncFeedback.type}`}>
                  {syncFeedback.type === 'success' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <AlertCircle size={15} />
                  )}
                  <span>{syncFeedback.message}</span>
                </div>
              )}

              {/* Error State */}
              {surveillanceError && (
                <div className="surveillance-error-banner">
                  <ShieldAlert size={18} />
                  <div>
                    <strong>Surveillance API Retrieval Notice:</strong> {surveillanceError}
                    <p>
                      Unable to refresh from official upstream. Showing cached or local observation baseline. You can retry via the refresh button.
                    </p>
                  </div>
                </div>
              )}

              {/* Loading Placeholder if no data yet */}
              {surveillanceLoading && !surveillanceData ? (
                <div className="loading-placeholder">
                  <RefreshCw size={24} className="spin-icon" />
                  <p>Requesting verified observations from official surveillance endpoint (/api/surveillance)...</p>
                </div>
              ) : !surveillanceData?.latest_observation ? (
                <div className="empty-placeholder">
                  <AlertCircle size={24} />
                  <p>No observation records were returned by the upstream source.</p>
                </div>
              ) : (
                <>
                  <div className="stats-grid">
                    <StatCard
                      label="Cumulative confirmed cases"
                      value={fmt(surveillanceLatest?.cumulative_confirmed_cases)}
                      note={
                        surveillanceBaseline
                          ? `+${fmt(surveillanceBaseline.additional_cases_since_baseline)} cases beyond Aug 16 baseline`
                          : 'Official situation report #160'
                      }
                      icon={Activity}
                      accent="blue"
                    />

                    <StatCard
                      label="Cumulative confirmed deaths"
                      value={fmt(surveillanceLatest?.cumulative_confirmed_deaths)}
                      note={
                        surveillanceBaseline?.additional_deaths_since_baseline != null
                          ? `+${fmt(surveillanceBaseline.additional_deaths_since_baseline)} deaths beyond Aug 16 baseline`
                          : 'Official situation report #160'
                      }
                      icon={CircleAlert}
                      accent="red"
                    />

                    <StatCard
                      label="Calculated case-fatality ratio"
                      value={
                        surveillanceLatest?.calculated_cfr_percent != null
                          ? `${fmt(surveillanceLatest.calculated_cfr_percent)}%`
                          : '—'
                      }
                      note="4,727 deaths ÷ 9,765 confirmed cases"
                      icon={ShieldCheck}
                      accent="violet"
                    />

                    <StatCard
                      label="Latest observation date"
                      value={
                        surveillanceLatest?.date
                          ? dateLabel(surveillanceLatest.date) + ` (${surveillanceLatest.date})`
                          : '21 Oct 2026'
                      }
                      note="Field cut-off gazetted in SitRep #160 (Published 24 Oct 2026)"
                      icon={CalendarDays}
                      accent="green"
                    />
                  </div>

                  <div className="surveillance-provenance-bar">
                    <div className="prov-info">
                      <span className="prov-label">DATA GOVERNANCE &amp; PROVENANCE:</span>
                      <span className="prov-text">
                        Source: <strong>INRB-UMIE</strong> (Institut National de Recherche Biomédicale) via <strong>UN OCHA HDX</strong> · Published as periodic official situation reports (SitReps), not a real-time streaming ticker.
                      </span>
                    </div>

                    <div className="prov-links">
                      <a
                        href="https://github.com/INRB-UMIE/BDBV2026-Data"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="prov-link"
                      >
                        <ExternalLink size={12} />
                        <span>INRB-UMIE Repository</span>
                      </a>
                      <a
                        href="https://github.com/INRB-UMIE/BDBV2026-Data/pull/213"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="prov-link"
                      >
                        <ExternalLink size={12} />
                        <span>SitRep #160 (PR #213)</span>
                      </a>
                      <a
                        href="https://data.humdata.org/dataset/republique-democratique-du-congo-cas-et-deces-d-ebola"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="prov-link"
                      >
                        <ExternalLink size={12} />
                        <span>UN OCHA HDX Dataset</span>
                      </a>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* ================= SECTION 2: HISTORICAL BENCHMARK DATASET ================= */}
            <section className="historical-benchmark-section">
              <div className="section-header-with-status">
                <div>
                  <div className="eyebrow benchmark-eyebrow">
                    <Database size={13} />
                    HISTORICAL BENCHMARK · GROUND-TRUTH RESEARCH ARCHIVE
                  </div>
                  <h2>Historical Calibration Benchmark (May 10 – August 16, 2026)</h2>
                  <p className="section-subtext">
                    Fixed 14-week baseline series (public/ebola_dataset.json) used to calibrate SEIRD differential-equation parameters (β, σ, γ, μ) and PINN workspace.
                  </p>
                </div>

                <div className="benchmark-identity-badge">
                  <Database size={13} />
                  <span>14-WEEK FIXED BASELINE (STATIC)</span>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard
                  label="Benchmark confirmed cases"
                  value={fmt(historicalLatest?.cumulative_confirmed_cases)}
                  note="Final record on 16 August 2026 (Report #14)"
                  icon={Activity}
                  accent="blue"
                />

                <StatCard
                  label="Benchmark confirmed deaths"
                  value={fmt(historicalLatest?.cumulative_confirmed_deaths)}
                  note="Final record on 16 August 2026 (Report #14)"
                  icon={CircleAlert}
                  accent="red"
                />

                <StatCard
                  label="Benchmark case-fatality ratio"
                  value={
                    historicalLatest?.calculated_cfr_percent != null
                      ? `${fmt(historicalLatest.calculated_cfr_percent)}%`
                      : '47.36%'
                  }
                  note="2,378 deaths ÷ 5,021 cases in 14-week baseline"
                  icon={ShieldCheck}
                  accent="violet"
                />

                <StatCard
                  label="Benchmark observation window"
                  value={chartRows.length ? `${chartRows.length} Weekly Records` : '14 Weekly Records'}
                  note="10 May 2026 to 16 August 2026 (Weekly intervals)"
                  icon={CalendarDays}
                  accent="green"
                />
              </div>

              <div className="benchmark-footnote">
                <span className="footnote-label">MODEL REPRODUCIBILITY NOTE:</span>
                <span>
                  This 14-week dataset is intentionally fixed and isolated from active field updates so mathematical model calibrations remain stable and reproducible across evaluations.
                </span>
              </div>
            </section>

            {/* ================= SECTION 3: OUTBREAK TRAJECTORY & CHARTS ================= */}
            <div className="chart-header-row">
              <div>
                <div className="eyebrow">EPIDEMIOLOGICAL TRAJECTORY</div>
                <h2>Outbreak Trajectory &amp; Increments</h2>
              </div>

              {/* Segmented control to choose which series to plot on the chart */}
              <div className="chart-series-selector">
                <button
                  type="button"
                  className={`series-pill ${streamMode === 'surveillance' ? 'active' : ''}`}
                  onClick={() => setStreamMode('surveillance')}
                >
                  <Radio size={13} />
                  <span>Official Surveillance (133 Daily Reports to Oct 21)</span>
                </button>
                <button
                  type="button"
                  className={`series-pill ${streamMode === 'historical' ? 'active' : ''}`}
                  onClick={() => setStreamMode('historical')}
                >
                  <Database size={13} />
                  <span>Historical Benchmark (14 Weekly Baseline to Aug 16)</span>
                </button>
              </div>
            </div>

            <section className="charts-grid">
              <article className="panel chart-panel wide">
                <div className="panel-heading">
                  <div>
                    <h3>Reported outbreak trajectory</h3>

                    <p>
                      {streamMode === 'historical'
                        ? 'Cumulative confirmed cases and deaths (14-week baseline)'
                        : 'Official cumulative trajectory through October 21, 2026'}
                    </p>
                  </div>

                  <span className="chart-badge">
                    {streamMode === 'historical' ? 'HISTORICAL BENCHMARK' : 'SURVEILLANCE FEED'}
                  </span>
                </div>

                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeChartRows}>
                      <defs>
                        <linearGradient
                          id="casesFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#48c6cf"
                            stopOpacity={0.26}
                          />

                          <stop
                            offset="100%"
                            stopColor="#48c6cf"
                            stopOpacity={0.01}
                          />
                        </linearGradient>

                        <linearGradient
                          id="deathsFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#ff7187"
                            stopOpacity={0.2}
                          />

                          <stop
                            offset="100%"
                            stopColor="#ff7187"
                            stopOpacity={0.01}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#29313b"
                        strokeDasharray="3 5"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="shortDate"
                        tick={{
                          fill: '#8d9aaa',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{
                          fill: '#8d9aaa',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) =>
                          value >= 1000
                            ? `${(value / 1000).toFixed(1)}k`
                            : value
                        }
                      />

                      <Tooltip
                        contentStyle={{
                          background: '#171d25',
                          border: '1px solid #303b47',
                          borderRadius: 10,
                          color: '#edf3f7',
                        }}
                      />

                      <Legend />

                      <Area
                        type="monotone"
                        dataKey="cumulative_confirmed_cases"
                        name="Confirmed cases"
                        stroke="#48c6cf"
                        strokeWidth={2.5}
                        fill="url(#casesFill)"
                      />

                      <Area
                        type="monotone"
                        dataKey="cumulative_confirmed_deaths"
                        name="Confirmed deaths"
                        stroke="#ff7187"
                        strokeWidth={2.5}
                        fill="url(#deathsFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h3>{streamMode === 'historical' ? 'Weekly new cases' : 'Incremental cases'}</h3>

                    <p>
                      {streamMode === 'historical'
                        ? 'Reported increments per record'
                        : 'Newly reported cases per situation bulletin (latest 20)'}
                    </p>
                  </div>

                  <span className="mini-icon">
                    <BarChart3 size={17} />
                  </span>
                </div>

                <div className="chart-wrap small">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        streamMode === 'historical'
                          ? chartRows.slice(1)
                          : activeChartRows.slice(-20)
                      }
                    >
                      <CartesianGrid
                        stroke="#29313b"
                        strokeDasharray="3 5"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="shortDate"
                        tick={{
                          fill: '#8d9aaa',
                          fontSize: 10,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{
                          fill: '#8d9aaa',
                          fontSize: 10,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="weekly_new_confirmed_cases"
                        name="New cases"
                        fill="#9d8cff"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section className="bottom-grid">
              <article className="panel method-panel">
                <div className="method-icon">
                  <FlaskConical size={20} />
                </div>

                <div>
                  <div className="eyebrow">
                    MATHEMATICAL WORKFLOW
                  </div>

                  <h3>From observations to model behaviour</h3>

                  <p>
                    The SEIRD numerical simulation is available for
                    exploration. Parameter calibration and
                    comparison with the reported observations remain
                    future research tasks.
                  </p>

                  <button
                    className="text-button"
                    onClick={() => setPage('model')}
                  >
                    View mathematical model
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>

              <article className="panel progress-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Build progress</h3>

                    <p>Implementation milestones</p>
                  </div>
                </div>

                {[
                  ['Historical data view', true],
                  ['Interactive charts', true],
                  ['SEIRD simulation API', true],
                  ['Live UN OCHA HDX API feed', true],
                  ['Parameter calibration', false],
                  ['PINN training and evaluation', false],
                ].map(([title, done]) => (
                  <div className="progress-row" key={title}>
                    <span className={`check ${done ? 'done' : ''}`}>
                      {done ? '✓' : ''}
                    </span>

                    <span>{title}</span>

                    <small>{done ? 'Available' : 'Planned'}</small>
                  </div>
                ))}
              </article>
            </section>
          </>
        )}

        {/* ================= HISTORICAL DATA ================= */}

        {page === 'data' && (
          <div className="content-page">
            <SectionTitle
              eyebrow="DATA EXPLORER"
              title={streamMode === 'historical' ? 'Historical outbreak data' : 'Official surveillance observations'}
              text={
                streamMode === 'historical'
                  ? 'Review the 14-week Bundibugyo benchmark dataset used for SEIRD model calibration.'
                  : `Official surveillance bulletins from INRB-UMIE & UN OCHA HDX (133 situation reports through ${surveillanceData?.latest_date || '21 October 2026'}).`
              }
            />

            <StreamSelectorBar
              streamMode={streamMode}
              setStreamMode={setStreamMode}
              lastSync={lastSurveillanceSync}
              surveillanceData={surveillanceData}
            />

            <div className="notice">
              <CircleAlert size={18} />

              <div>
                <b>
                  {streamMode === 'historical'
                    ? 'Benchmark Dataset Source Note'
                    : 'Surveillance Feed Governance Note'}
                </b>

                <p>
                  {streamMode === 'historical'
                    ? 'This dataset lists 14 weekly Bundibugyo virus disease records for May–August 2026. Verify the original reports before treating these values as authoritative public-health statistics.'
                    : `Displaying official field surveillance observations from INRB-UMIE & UN OCHA HDX. Automatically polled hourly (latest available report: ${surveillanceData?.latest_date || '21 October 2026'}). If no newer reports are issued, last verified observations are retained without fabricating numbers.`}
                </p>
              </div>
            </div>

            <section className="charts-grid data-charts">
              <article className="panel chart-panel wide">
                <div className="panel-heading">
                  <div>
                    <h3>Cumulative cases and deaths</h3>

                    <p>Reported totals by date</p>
                  </div>
                </div>

                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeChartRows}>
                      <CartesianGrid
                        stroke="#e5eaf0"
                        strokeDasharray="3 5"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="shortDate"
                        tick={{
                          fill: '#718096',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{
                          fill: '#718096',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip />

                      <Legend />

                      <Line
                        type="monotone"
                        dataKey="cumulative_confirmed_cases"
                        name="Confirmed cases"
                        stroke="#087e8b"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />

                      <Line
                        type="monotone"
                        dataKey="cumulative_confirmed_deaths"
                        name="Confirmed deaths"
                        stroke="#dc5268"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Calculated CFR</h3>

                    <p>Deaths divided by confirmed cases</p>
                  </div>
                </div>

                <div className="chart-wrap small">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activeChartRows}>
                      <CartesianGrid
                        stroke="#e5eaf0"
                        strokeDasharray="3 5"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="shortDate"
                        tick={{
                          fill: '#718096',
                          fontSize: 10,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{
                          fill: '#718096',
                          fontSize: 10,
                        }}
                        unit="%"
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        formatter={(value) => `${fmt(value)}%`}
                      />

                      <Line
                        type="monotone"
                        dataKey="calculated_cfr_percent"
                        name="Calculated CFR"
                        stroke="#7865d9"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <article className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <h3>
                    {streamMode === 'historical'
                      ? 'Historical benchmark records'
                      : 'Official surveillance situation reports'}
                  </h3>

                  <p>
                    {activeChartRows.length} records · newest record first ·{' '}
                    {streamMode === 'historical'
                      ? '14-week baseline series'
                      : 'Daily official bulletins (INRB / HDX)'}
                  </p>
                </div>

                <button
                  className="download-button"
                  onClick={() =>
                    window.open(
                      streamMode === 'historical'
                        ? '/ebola_dataset.json'
                        : surveillanceData?.source_url || 'https://data.humdata.org/dataset/republique-democratique-du-congo-cas-et-deces-d-ebola',
                      '_blank'
                    )
                  }
                >
                  {streamMode === 'historical' ? 'View JSON data' : 'View HDX Feed Source'}
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{streamMode === 'historical' ? 'Report #' : 'SitRep #'}</th>
                      <th>Confirmed cases</th>
                      <th>Confirmed deaths</th>
                      <th>{streamMode === 'historical' ? 'Weekly new cases' : 'New cases'}</th>
                      <th>{streamMode === 'historical' ? 'Weekly new deaths' : 'New deaths'}</th>
                      <th>Calculated CFR</th>
                      <th>Classification</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...activeChartRows].reverse().map((row) => (
                      <tr key={row.date}>
                        <td>
                          {new Date(
                            `${row.date}T00:00:00`
                          ).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td>{row.report_number}</td>

                        <td>
                          {fmt(row.cumulative_confirmed_cases)}
                        </td>

                        <td>
                          {fmt(row.cumulative_confirmed_deaths)}
                        </td>

                        <td>
                          {row.weekly_new_confirmed_cases != null
                            ? fmt(row.weekly_new_confirmed_cases)
                            : '—'}
                        </td>

                        <td>
                          {row.weekly_new_confirmed_deaths != null
                            ? fmt(row.weekly_new_confirmed_deaths)
                            : '—'}
                        </td>

                        <td>
                          {fmt(row.calculated_cfr_percent)}%
                        </td>

                        <td>
                          <span className="badge green">Confirmed</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        )}

        {/* ================= MATHEMATICAL MODEL ================= */}

        {page === 'model' && (
          <div className="content-page">
            <SectionTitle
              eyebrow="SCIENTIFIC WORKSPACE"
              title="Ebola mathematical model"
              text="Explore the numerical solution of an illustrative SEIRD compartmental model using the deployed Python API."
            />

            <div className="notice">
              <CircleAlert size={18} />

              <div>
                <b>Important model limitations</b>

                <p>
                  The simulation uses illustrative parameters that
                  have not been calibrated to the supplied dataset.
                  Its output is a mathematical demonstration, not a
                  validated Ebola forecast. A more realistic
                  disease-specific model may need to represent
                  transmission from infectious people, including
                  transmission associated with caregiving and
                  funerals.
                </p>
              </div>
            </div>

            <div className="equation-grid">
              <article className="equation-card">
                <span className="equation-label">
                  STATE VARIABLES
                </span>

                <h3>Compartment definitions</h3>

                <div className="state-row">
                  <b>S(t)</b>
                  <span>Susceptible population</span>
                </div>

                <div className="state-row">
                  <b>E(t)</b>
                  <span>Exposed population</span>
                </div>

                <div className="state-row">
                  <b>I(t)</b>
                  <span>Infectious population</span>
                </div>

                <div className="state-row">
                  <b>R(t)</b>
                  <span>Recovered population</span>
                </div>

                <div className="state-row">
                  <b>D(t)</b>
                  <span>Deaths attributed to disease</span>
                </div>

                <p className="equation-foot">
                  These are the state variables used by the
                  illustrative simulation API.
                </p>
              </article>

              <article className="equation-card">
                <span className="equation-label">
                  DIFFERENTIAL EQUATIONS
                </span>

                <h3>SEIRD model structure</h3>

                <div className="math-line">
                  dS/dt = −βSI/N
                </div>

                <div className="math-line">
                  dE/dt = βSI/N − σE
                </div>

                <div className="math-line">
                  dI/dt = σE − (γ + μ)I
                </div>

                <div className="math-line">
                  dR/dt = γI
                </div>

                <div className="math-line">
                  dD/dt = μI
                </div>

                <p className="equation-foot">
                  β is the transmission coefficient, σ is the
                  exposed-to-infectious transition rate, γ is the
                  recovery rate, and μ is the disease-death rate.
                  N is the population used in the simulation.
                </p>
              </article>
            </div>

            {/* Simulation controls */}

            <article className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <h3>Numerical ODE simulation</h3>

                  <p>
                    Python · SciPy solve_ivp · RK45 · 180 days
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={runSimulation}
                  disabled={simulationLoading}
                >
                  <FlaskConical size={17} />

                  {simulationLoading
                    ? 'Running simulation…'
                    : simulation
                      ? 'Run again'
                      : 'Run simulation'}
                </button>
              </div>

              {simulationError && (
                <div className="notice">
                  <CircleAlert size={18} />

                  <div>
                    <b>Simulation failed</b>

                    <p>{simulationError}</p>

                    <p>
                      Check the deployed API and Vercel function
                      logs, then try again.
                    </p>
                  </div>
                </div>
              )}

              {!simulation && !simulationError && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <FlaskConical size={25} />
                  </div>

                  <h3>Ready to run the simulation</h3>

                  <p>
                    Click “Run simulation” to retrieve the numerical
                    solution from your deployed Python API.
                  </p>
                </div>
              )}

              {simulation && (
                <>
                  <div className="notice">
                    <Activity size={18} />

                    <div>
                      <b>
                        {simulation.model_type ||
                          'Illustrative SEIRD simulation'}
                      </b>

                      <p>
                        {simulation.warning ||
                          'Illustrative output only. Parameters have not been calibrated to the dataset.'}
                      </p>

                      <p>
                        Simulation duration:{' '}
                        {simulation.chartRows.length - 1} days.
                      </p>
                    </div>
                  </div>

                  <section className="stats-grid">
                    <StatCard
                      label="Final susceptible"
                      value={fmt(
                        simulation.chartRows.at(-1)?.susceptible
                      )}
                      note="End of simulation"
                      icon={Activity}
                      accent="blue"
                    />

                    <StatCard
                      label="Final exposed"
                      value={fmt(
                        simulation.chartRows.at(-1)?.exposed
                      )}
                      note="End of simulation"
                      icon={CalendarDays}
                      accent="violet"
                    />

                    <StatCard
                      label="Final infectious"
                      value={fmt(
                        simulation.chartRows.at(-1)?.infectious
                      )}
                      note="End of simulation"
                      icon={CircleAlert}
                      accent="red"
                    />

                    <StatCard
                      label="Cumulative model deaths"
                      value={fmt(
                        simulation.chartRows.at(-1)?.deaths
                      )}
                      note="End of simulation"
                      icon={ShieldCheck}
                      accent="green"
                    />
                  </section>

                  <article className="panel chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>SEIRD population trajectories</h3>

                        <p>
                          Modelled compartments over time
                        </p>
                      </div>

                      <span className="chart-badge">
                        NUMERICAL SIMULATION
                      </span>
                    </div>

                    <div className="chart-wrap">
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <LineChart
                          data={simulation.chartRows}
                          margin={{
                            top: 10,
                            right: 15,
                            left: 10,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid
                            stroke="#29313b"
                            strokeDasharray="3 5"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="day"
                            type="number"
                            domain={[0, 'dataMax']}
                            tick={{
                              fill: '#8d9aaa',
                              fontSize: 11,
                            }}
                            axisLine={false}
                            tickLine={false}
                            label={{
                              value: 'Time (days)',
                              position: 'insideBottom',
                              offset: -2,
                              fill: '#8d9aaa',
                            }}
                          />

                          <YAxis
                            tick={{
                              fill: '#8d9aaa',
                              fontSize: 11,
                            }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) =>
                              value >= 1000
                                ? `${(value / 1000).toFixed(1)}k`
                                : value
                            }
                          />

                          <Tooltip
                            contentStyle={{
                              background: '#171d25',
                              border: '1px solid #303b47',
                              borderRadius: 10,
                              color: '#edf3f7',
                            }}
                            labelFormatter={(day) =>
                              `Day ${day}`
                            }
                            formatter={(value) => fmt(value)}
                          />

                          <Legend />

                          <Line
                            type="monotone"
                            dataKey="susceptible"
                            name="Susceptible (S)"
                            stroke="#48c6cf"
                            strokeWidth={2}
                            dot={false}
                          />

                          <Line
                            type="monotone"
                            dataKey="exposed"
                            name="Exposed (E)"
                            stroke="#9d8cff"
                            strokeWidth={2}
                            dot={false}
                          />

                          <Line
                            type="monotone"
                            dataKey="infectious"
                            name="Infectious (I)"
                            stroke="#ff7187"
                            strokeWidth={2}
                            dot={false}
                          />

                          <Line
                            type="monotone"
                            dataKey="recovered"
                            name="Recovered (R)"
                            stroke="#55c99a"
                            strokeWidth={2}
                            dot={false}
                          />

                          <Line
                            type="monotone"
                            dataKey="deaths"
                            name="Deaths (D)"
                            stroke="#f0ad4e"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>

                  <article className="panel table-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Simulation results</h3>

                        <p>
                          First and last numerical solution
                          records
                        </p>
                      </div>
                    </div>

                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Susceptible</th>
                            <th>Exposed</th>
                            <th>Infectious</th>
                            <th>Recovered</th>
                            <th>Deaths</th>
                          </tr>
                        </thead>

                        <tbody>
                          {[
                            simulation.chartRows[0],
                            simulation.chartRows.at(-1),
                          ]
                            .filter(Boolean)
                            .map((row, index) => (
                              <tr
                                key={`${row.day}-${index}`}
                              >
                                <td>{row.day}</td>

                                <td>{fmt(row.susceptible)}</td>

                                <td>{fmt(row.exposed)}</td>

                                <td>{fmt(row.infectious)}</td>

                                <td>{fmt(row.recovered)}</td>

                                <td>{fmt(row.deaths)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </>
              )}
            </article>
          </div>
        )}

        {/* ================= PINN WORKSPACE ================= */}

        {page === 'pinn' && (
          <div className="content-page">
            <SectionTitle
              eyebrow="PHYSICS-INFORMED LEARNING"
              title="PINN workspace"
              text="The PINN will be developed after the mathematical model, parameter assumptions, and observation mapping are defined."
            />

            <div className="pinn-banner">
              <div className="pinn-symbol">
                <GitBranch size={30} />
              </div>

              <div>
                <span className="eyebrow">
                  NEXT RESEARCH MILESTONE
                </span>

                <h2>
                  Combine data fit with equation consistency
                </h2>

                <p>
                  A Physics-Informed Neural Network can combine
                  agreement with observations and consistency with
                  governing differential equations. This does not
                  automatically guarantee accurate forecasts.
                </p>
              </div>
            </div>

            <div className="loss-grid">
              <article className="loss-card">
                <span>01 · DATA LOSS</span>

                <h3>Match observations</h3>

                <p>
                  Measures the mismatch between model outputs and
                  selected observations using a clearly defined
                  mapping between reported cases and model
                  compartments.
                </p>
              </article>

              <article className="loss-card">
                <span>02 · PHYSICS LOSS</span>

                <h3>Respect the ODEs</h3>

                <p>
                  Penalizes residuals when predicted states and
                  their time derivatives fail to satisfy the
                  selected differential equations.
                </p>
              </article>

              <article className="loss-card loss-total">
                <span>COMBINED OBJECTIVE</span>

                <div className="math-line">
                  L = L<sub>data</sub> + λL<sub>physics</sub>
                </div>

                <p>
                  The parameter λ balances the data and physics
                  losses and must be selected and evaluated
                  carefully.
                </p>
              </article>
            </div>

            <EmptyState
              icon={Microscope}
              title="PINN not trained for Ebola yet"
              text="The simulation API is not a trained PINN. Training and validation will be a separate implementation phase."
            />
          </div>
        )}
    {page === 'map' && (
      <div className="content-page">
        <SectionTitle
          eyebrow="GLOBAL OUTBREAK SURVEILLANCE"
          title="Outbreak Intelligence Map"
          text="Explore historical outbreak locations and available outbreak information."
        />
        <StreamSelectorBar
          streamMode={streamMode}
          setStreamMode={setStreamMode}
          lastSync={lastSurveillanceSync}
          surveillanceData={surveillanceData}
        />
        <OutbreakMap records={activeChartRows} streamMode={streamMode} />
      </div>
    )}
    {page === 'surveillance' && (
      <div className="content-page">
        <SectionTitle
          eyebrow="REAL-TIME EPIDEMIOLOGY & DATA FEEDS"
          title="Live Outbreak Surveillance & APIs"
          text="Live programmatic integration with the United Nations OCHA Humanitarian Data Exchange (HDX) API, global disease alert systems, and comparative strain mechanics."
        />
        <LiveSurveillance />
      </div>
    )}
        <footer className="footer">
          <span>
            OUTBREAK INTELLIGENCE · MATHEMATICAL MODELLING PROJECT
          </span>

          <span>
            Research prototype · Not for clinical or public-health
            decision-making
          </span>
        </footer>
      </main>
    </div>
  );
}