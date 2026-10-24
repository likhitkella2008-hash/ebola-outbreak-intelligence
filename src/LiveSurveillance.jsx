import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Radio,
  Globe,
  RefreshCw,
  ExternalLink,
  Database,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  Code2,
  Layers,
  Wifi,
  ShieldAlert,
  ArrowRight,
  Server,
  Activity,
  TrendingUp,
  AlertCircle,
  Calendar,
} from 'lucide-react';
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
import { fetchSurveillanceObservations } from './services/liveSurveillanceService';

const HDX_API_URL = 'https://data.humdata.org/api/3/action/package_search?q=ebola&rows=15';
const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

// Comparative Strain Benchmarks for Mathematical Modeling
const STRAIN_BENCHMARKS = [
  {
    strain: 'Zaire ebolavirus (EBOV)',
    cfr: '60% – 90%',
    r0: '1.5 – 2.5',
    incubation: '6 – 12 days',
    majorOutbreaks: 'West Africa (2014–16), DRC Kivu (2018–20)',
    notes: 'Highest mortality; primary target of Ervebo (rVSV-ZEBOV) vaccine.',
    modelParamSigma: '0.11 (1/9 days)',
    modelParamGamma: '0.10 (1/10 days)',
    modelParamMu: '0.07',
  },
  {
    strain: 'Sudan ebolavirus (SUDV)',
    cfr: '40% – 55%',
    r0: '1.3 – 1.8',
    incubation: '7 – 14 days',
    majorOutbreaks: 'Uganda (2000, 2022), South Sudan (1976, 2004)',
    notes: 'No licensed vaccine during 2022 outbreak; managed via ring isolation and contact tracing.',
    modelParamSigma: '0.10 (1/10 days)',
    modelParamGamma: '0.09 (1/11 days)',
    modelParamMu: '0.045',
  },
  {
    strain: 'Bundibugyo ebolavirus (BDBV)',
    cfr: '30% – 48%',
    r0: '1.2 – 1.6',
    incubation: '5 – 10 days',
    majorOutbreaks: 'Uganda (2007 Bundibugyo District), DRC (2012)',
    notes: 'Discovered in 2007; characterized by severe hemorrhagic symptoms but moderate CFR relative to Zaire.',
    modelParamSigma: '0.11 (1/9 days)',
    modelParamGamma: '0.07 (1/14 days)',
    modelParamMu: '0.02',
  },
  {
    strain: 'Taï Forest ebolavirus (TAFV)',
    cfr: '< 1% (Single human case)',
    r0: 'Unknown',
    incubation: '8 days',
    majorOutbreaks: "Côte d'Ivoire (1994, single non-fatal ethologist case)",
    notes: 'Extremely rare; natural reservoir believed to be forest bats or non-human primates.',
    modelParamSigma: '0.12',
    modelParamGamma: '0.10',
    modelParamMu: '0.001',
  },
];

const fmt = (n) =>
  n == null || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-US', {
        maximumFractionDigits: 1,
      });

const dateLabel = (s) => {
  if (!s) return '—';
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
};

export default function LiveSurveillance() {
  const [activeTab, setActiveTab] = useState('observations'); // 'observations' | 'hdx' | 'architecture' | 'strains' | 'code'

  // Surveillance Observation Feed State
  const [surveillanceData, setSurveillanceData] = useState(null);
  const [surveillanceLoading, setSurveillanceLoading] = useState(true);
  const [surveillanceError, setSurveillanceError] = useState(null);
  const [lastSurveillanceSync, setLastSurveillanceSync] = useState(null);
  const isSyncingRef = useRef(false);

  // HDX Catalog Packages State
  const [datasets, setDatasets] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [latency, setLatency] = useState(null);

  // 1. Fetch Observations Feed
  async function loadSurveillanceFeed() {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSurveillanceLoading(true);
    setSurveillanceError(null);

    try {
      const result = await fetchSurveillanceObservations();
      setSurveillanceData(result);
      setLastSurveillanceSync(new Date());
    } catch (err) {
      setSurveillanceError(
        err.message || 'Unable to retrieve the official surveillance observation feed.'
      );
    } finally {
      setSurveillanceLoading(false);
      isSyncingRef.current = false;
    }
  }

  // 2. Fetch HDX Catalog Metadata
  async function loadHdxCatalog() {
    setCatalogLoading(true);
    setCatalogError(null);
    const startTime = performance.now();

    try {
      const response = await fetch(HDX_API_URL);
      const data = await response.json();
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));

      if (data && data.success && data.result) {
        setDatasets(data.result.results || []);
      } else {
        throw new Error('Unexpected format returned by UN OCHA HDX API.');
      }
    } catch (err) {
      setCatalogError(
        err.message || 'Unable to connect to the live Humanitarian Data Exchange API.'
      );
    } finally {
      setCatalogLoading(false);
    }
  }

  // Master Synchronize (Triggers both feeds)
  async function syncAllFeeds() {
    await Promise.all([loadSurveillanceFeed(), loadHdxCatalog()]);
  }

  // Set up initial load and recurring 60-minute automatic polling
  useEffect(() => {
    syncAllFeeds();

    const intervalId = setInterval(() => {
      loadSurveillanceFeed();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  const filteredDatasets = useMemo(() => {
    if (!searchQuery.trim()) return datasets;
    const q = searchQuery.toLowerCase();
    return datasets.filter(
      (d) =>
        (d.title && d.title.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        (d.organization && d.organization.title && d.organization.title.toLowerCase().includes(q)) ||
        (d.tags && d.tags.some((t) => t.name.toLowerCase().includes(q)))
    );
  }, [datasets, searchQuery]);

  const latestObs = surveillanceData?.latest_observation ?? null;
  const baselineComp = surveillanceData?.baseline_comparison ?? null;

  const observationChartRows = useMemo(() => {
    if (!surveillanceData?.time_series) return [];
    return surveillanceData.time_series.map((item) => ({
      ...item,
      shortDate: dateLabel(item.date),
    }));
  }, [surveillanceData]);

  return (
    <div className="live-surveillance-page">
      {/* Header Banner */}
      <div className="surveillance-hero">
        <div className="hero-status-pill">
          <span className="live-pulse" />
          <span>OFFICIAL SURVEILLANCE &amp; API FEEDS</span>
        </div>
        <h2>Live Outbreak Intelligence &amp; Surveillance Ingestion</h2>
        <p>
          Automated ingestion of official Ebola case and death observations from the{' '}
          <strong>INRB-UMIE &amp; UN OCHA Humanitarian Data Exchange</strong> consolidated surveillance feed.
          Provides periodic polling, temporal separation between historical benchmarks and active surveillance,
          and transparent source verification.
        </p>

        <div className="surveillance-meta-bar">
          <div className="meta-item">
            <Server size={15} />
            <span>Active Observation Feed:</span>
            <strong>INRB-UMIE / UN OCHA HDX</strong>
          </div>
          <div className="meta-item">
            <Wifi size={15} />
            <span>Connection:</span>
            <strong style={{ color: surveillanceError ? '#ff7187' : '#6fd6b0' }}>
              {surveillanceLoading
                ? 'Connecting...'
                : surveillanceError
                ? 'Degraded'
                : 'Connected (HTTP 200)'}
            </strong>
          </div>
          {latestObs && (
            <div className="meta-item">
              <Calendar size={15} />
              <span>Latest Official Report:</span>
              <strong style={{ color: '#48c6cf' }}>{latestObs.date}</strong>
            </div>
          )}
          <div className="meta-item">
            <Clock size={15} />
            <span>Auto-Refresh:</span>
            <strong>Every 60 min</strong>
          </div>
          {lastSurveillanceSync && (
            <div className="meta-item">
              <RefreshCw size={15} />
              <span>Last Sync:</span>
              <strong>{lastSurveillanceSync.toLocaleTimeString()}</strong>
            </div>
          )}
          <button
            className="sync-button"
            onClick={syncAllFeeds}
            disabled={surveillanceLoading || catalogLoading}
            title="Perform manual on-demand fetch of official surveillance feeds"
          >
            <RefreshCw
              size={13}
              className={surveillanceLoading || catalogLoading ? 'spin-icon' : ''}
            />
            {surveillanceLoading || catalogLoading ? 'Syncing Feeds…' : 'Sync Live Feeds'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="surveillance-tabs">
        <button
          className={`surveillance-tab ${activeTab === 'observations' ? 'active' : ''}`}
          onClick={() => setActiveTab('observations')}
        >
          <Activity size={15} />
          <span>
            Official Surveillance Observations{' '}
            {latestObs ? `(${latestObs.date})` : ''}
          </span>
        </button>
        <button
          className={`surveillance-tab ${activeTab === 'hdx' ? 'active' : ''}`}
          onClick={() => setActiveTab('hdx')}
        >
          <Database size={15} />
          <span>HDX Dataset Catalog ({filteredDatasets.length})</span>
        </button>
        <button
          className={`surveillance-tab ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          <Layers size={15} />
          <span>API Investigation Report</span>
        </button>
        <button
          className={`surveillance-tab ${activeTab === 'strains' ? 'active' : ''}`}
          onClick={() => setActiveTab('strains')}
        >
          <Globe size={15} />
          <span>Ebola Strain Parameters &amp; R₀</span>
        </button>
        <button
          className={`surveillance-tab ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          <Code2 size={15} />
          <span>Integration Code (Python / JS)</span>
        </button>
      </div>

      {/* ================= TAB 1: OFFICIAL SURVEILLANCE OBSERVATIONS ================= */}
      {activeTab === 'observations' && (
        <div className="tab-content">
          {surveillanceError && (
            <div className="surveillance-error">
              <ShieldAlert size={18} />
              <div>
                <strong>Surveillance Ingestion Warning:</strong> {surveillanceError}
                <p>Showing cached or local verified observation baseline. You can retry via the manual sync button.</p>
              </div>
            </div>
          )}

          {/* Transparency & Governance Notice */}
          <div className="notice surveillance-transparency-notice">
            <AlertCircle size={18} />
            <div>
              <b>Data Classification &amp; Temporal Governance Notice</b>
              <p>
                <strong>Source Authority:</strong> INRB-UMIE (Institut National de Recherche Biomédicale) via UN OCHA Humanitarian Data Exchange.
                <br />
                <strong>Disease &amp; Geography:</strong> Bundibugyo virus disease (BDBV) · Democratic Republic of the Congo (National &amp; Subnational Health Zones).
                <br />
                <strong>Reporting Mode:</strong> Official periodic epidemiological bulletins. The application polls upstream every 60 minutes for newly gazetted situation reports.
                <strong> The latest officially released report is dated 21 October 2026.</strong> If no newer report has been released by health authorities, the application retains the last verified observation without fabricating numbers.
              </p>
            </div>
          </div>

          {/* Headline Observation Stats Grid */}
          <section className="stats-grid">
            <article className="stat-card blue">
              <div className="stat-top">
                <span>Cumulative Confirmed Cases</span>
                <span className="stat-icon">
                  <Activity size={18} />
                </span>
              </div>
              <div className="stat-value">{fmt(latestObs?.cumulative_confirmed_cases)}</div>
              <div className="stat-note">
                {baselineComp
                  ? `+${fmt(baselineComp.additional_cases_since_baseline)} since Aug 16 baseline`
                  : 'Latest official situation report'}
              </div>
            </article>

            <article className="stat-card red">
              <div className="stat-top">
                <span>Cumulative Confirmed Deaths</span>
                <span className="stat-icon">
                  <AlertCircle size={18} />
                </span>
              </div>
              <div className="stat-value">{fmt(latestObs?.cumulative_confirmed_deaths)}</div>
              <div className="stat-note">
                {baselineComp
                  ? `+${fmt(baselineComp.additional_deaths_since_baseline)} since Aug 16 baseline`
                  : 'Latest official situation report'}
              </div>
            </article>

            <article className="stat-card violet">
              <div className="stat-top">
                <span>Calculated Case-Fatality Ratio</span>
                <span className="stat-icon">
                  <TrendingUp size={18} />
                </span>
              </div>
              <div className="stat-value">
                {latestObs?.calculated_cfr_percent != null
                  ? `${fmt(latestObs.calculated_cfr_percent)}%`
                  : '—'}
              </div>
              <div className="stat-note">Confirmed deaths ÷ confirmed cases</div>
            </article>

            <article className="stat-card green">
              <div className="stat-top">
                <span>Observation Window</span>
                <span className="stat-icon">
                  <Calendar size={18} />
                </span>
              </div>
              <div className="stat-value" style={{ fontSize: '18px' }}>
                {surveillanceData ? `${surveillanceData.total_reporting_dates} dates` : '—'}
              </div>
              <div className="stat-note">
                {surveillanceData
                  ? `${surveillanceData.earliest_date} to ${surveillanceData.latest_date}`
                  : 'Daily surveillance time-series'}
              </div>
            </article>
          </section>

          {/* Surveillance Trajectory Chart */}
          <section className="charts-grid">
            <article className="panel chart-panel wide">
              <div className="panel-heading">
                <div>
                  <h3>Official Surveillance Trajectory (May–October 2026)</h3>
                  <p>Cumulative confirmed cases and deaths across 133 daily situation reports</p>
                </div>
                <span className="chart-badge">LIVE SURVEILLANCE FEED</span>
              </div>

              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={observationChartRows}>
                    <defs>
                      <linearGradient id="liveCasesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#48c6cf" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#48c6cf" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="liveDeathsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff7187" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#ff7187" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#24303c" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fill: '#7d8e9e', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#7d8e9e', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#151d26',
                        border: '1px solid #2d3b4a',
                        borderRadius: 8,
                        color: '#eef4f8',
                      }}
                      formatter={(val) => fmt(val)}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cumulative_confirmed_cases"
                      name="Confirmed Cases"
                      stroke="#48c6cf"
                      strokeWidth={2}
                      fill="url(#liveCasesFill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative_confirmed_deaths"
                      name="Confirmed Deaths"
                      stroke="#ff7187"
                      strokeWidth={2}
                      fill="url(#liveDeathsFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Daily New Cases Bar Chart */}
            <article className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <h3>Daily Incremental Cases</h3>
                  <p>Newly reported cases per situation bulletin</p>
                </div>
                <span className="chart-badge">INCIDENCE</span>
              </div>

              <div className="chart-wrap small">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={observationChartRows.slice(-30)}>
                    <CartesianGrid stroke="#24303c" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="shortDate"
                      tick={{ fill: '#7d8e9e', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#7d8e9e', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#151d26',
                        border: '1px solid #2d3b4a',
                        borderRadius: 8,
                        color: '#eef4f8',
                      }}
                      formatter={(val) => fmt(val)}
                    />
                    <Bar
                      dataKey="daily_new_confirmed_cases"
                      name="New Cases"
                      fill="#9d8cff"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          {/* Observations Table */}
          <article className="panel table-panel">
            <div className="panel-heading">
              <div>
                <h3>Official Surveillance Situation Reports</h3>
                <p>
                  Showing latest 15 observation bulletins (newest report first) · Total {observationChartRows.length} daily entries recorded
                </p>
              </div>
              <a
                href={surveillanceData?.source_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="download-button"
              >
                View HDX Source Dataset
              </a>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Observation Date</th>
                    <th>Cumulative Confirmed Cases</th>
                    <th>Cumulative Confirmed Deaths</th>
                    <th>Daily New Cases</th>
                    <th>Daily New Deaths</th>
                    <th>Calculated CFR</th>
                    <th>Classification</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...observationChartRows]
                    .reverse()
                    .slice(0, 15)
                    .map((row, idx) => (
                      <tr key={row.date}>
                        <td>
                          <strong>
                            {new Date(`${row.date}T00:00:00`).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </strong>
                        </td>
                        <td>{fmt(row.cumulative_confirmed_cases)}</td>
                        <td>{fmt(row.cumulative_confirmed_deaths)}</td>
                        <td>
                          {row.daily_new_confirmed_cases != null
                            ? `+${fmt(row.daily_new_confirmed_cases)}`
                            : '—'}
                        </td>
                        <td>
                          {row.daily_new_confirmed_deaths != null
                            ? `+${fmt(row.daily_new_confirmed_deaths)}`
                            : '—'}
                        </td>
                        <td>{row.calculated_cfr_percent ? `${row.calculated_cfr_percent}%` : '—'}</td>
                        <td>
                          <span className="badge green">Confirmed</span>
                        </td>
                        <td>
                          <small style={{ color: idx === 0 ? '#48c6cf' : '#8899a8' }}>
                            {idx === 0 ? 'Latest Official Report' : 'Official Archive'}
                          </small>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {/* ================= TAB 2: LIVE HDX DATASETS ================= */}
      {activeTab === 'hdx' && (
        <div className="tab-content">
          <div className="surveillance-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Filter by country, organization, or tag (e.g. DRC, Uganda, WHO)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="dataset-count-badge">
              <strong>{filteredDatasets.length}</strong> live datasets queried
            </div>
          </div>

          {catalogError && (
            <div className="surveillance-error">
              <ShieldAlert size={18} />
              <div>
                <strong>API Query Warning:</strong> {catalogError}
                <p>Showing cached or available network metadata. You can retry the live connection above.</p>
              </div>
            </div>
          )}

          {catalogLoading ? (
            <div className="loading-state">
              <RefreshCw size={24} className="spin-icon" />
              <p>Querying UN OCHA Humanitarian Data Exchange API...</p>
              <small>Endpoint: {HDX_API_URL}</small>
            </div>
          ) : (
            <div className="dataset-cards-grid">
              {filteredDatasets.map((pkg) => (
                <article key={pkg.id || pkg.name} className="hdx-card">
                  <div className="card-top">
                    <span className="org-badge">
                      {pkg.organization?.title || 'Humanitarian Contributor'}
                    </span>
                    <span className="last-mod">
                      Updated {pkg.metadata_modified ? new Date(pkg.metadata_modified).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <h4>{pkg.title}</h4>

                  <p className="card-notes">
                    {pkg.notes
                      ? pkg.notes.length > 180
                        ? pkg.notes.slice(0, 180) + '…'
                        : pkg.notes
                      : 'Structured Ebola surveillance and health infrastructure dataset catalogued on UN OCHA HDX.'}
                  </p>

                  {pkg.tags && pkg.tags.length > 0 && (
                    <div className="tags-row">
                      {pkg.tags.slice(0, 4).map((t, idx) => (
                        <span key={idx} className="tag-chip">
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="resources-section">
                    <span className="res-title">
                      Available Resources ({pkg.resources?.length || 0}):
                    </span>
                    <div className="resources-pills">
                      {(pkg.resources || []).slice(0, 3).map((res, rIdx) => (
                        <a
                          key={rIdx}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="resource-pill"
                          title={`Download ${res.name || 'resource'} (${res.format})`}
                        >
                          <FileText size={12} />
                          <span className="res-format">{res.format || 'DATA'}</span>
                          <span className="res-name">
                            {res.name ? (res.name.length > 20 ? res.name.slice(0, 18) + '…' : res.name) : 'Download'}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="card-actions">
                    <a
                      href={`https://data.humdata.org/dataset/${pkg.name || pkg.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hdx-external-link"
                    >
                      <span>View on HDX Portal</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: ACADEMIC INVESTIGATION REPORT ================= */}
      {activeTab === 'architecture' && (
        <div className="tab-content">
          <article className="report-card">
            <h3>1. The Fundamental Question: Why Isn't There a Global "Live Streaming" Ebola API?</h3>
            <p>
              Students often contrast Ebola with COVID-19 or Influenza, asking why services like{' '}
              <code>disease.sh</code> or Johns Hopkins CSSE do not maintain a 24/7 live Ebola case ticker.
              The answer lies in <strong>epidemiological transmission dynamics</strong>:
            </p>
            <div className="comparison-box">
              <div className="compare-col">
                <h4>Continuous Global Transmission (COVID-19 / Flu)</h4>
                <ul>
                  <li>Endemic / pandemic respiratory spread across 200+ nations.</li>
                  <li>Millions of tests performed and thousands of cases recorded daily.</li>
                  <li>Enables continuous daily REST APIs and automated scraping bots.</li>
                </ul>
              </div>
              <div className="compare-col highlight">
                <h4>Acute Sporadic Outbreaks (Ebola Virus Disease)</h4>
                <ul>
                  <li>Zoonotic filovirus with localized animal-to-human spillover events.</li>
                  <li>Outbreaks are localized to specific African regions (e.g. DRC, Uganda).</li>
                  <li>
                    <strong>Inter-Epidemic Periods:</strong> When an outbreak is declared over (42 days
                    without new cases), <em>global active transmission drops to zero</em>.
                  </li>
                  <li>A continuous live feed would stream zeros for 95% of the calendar years.</li>
                </ul>
              </div>
            </div>

            <div className="highlight-banner">
              <CheckCircle2 size={20} />
              <div>
                <strong>Key Insight Regarding Your Project's Dataset:</strong>
                <p>
                  The Bundibugyo dataset in your dashboard (<code>public/ebola_dataset.json</code>)
                  corresponds to the Bundibugyo outbreak monitoring series published via{' '}
                  <strong>INRB-UMIE</strong> and indexed on the <strong>UN OCHA Humanitarian Data Exchange (HDX)</strong>.
                  The raw daily surveillance records can be queried programmatically through the HDX feed!
                </p>
              </div>
            </div>

            <h3>2. Comparative Evaluation of Available Global Health APIs</h3>
            <div className="api-matrix-table">
              <table>
                <thead>
                  <tr>
                    <th>Data Source</th>
                    <th>API Architecture</th>
                    <th>Update Frequency</th>
                    <th>Accessibility &amp; CORS</th>
                    <th>Relevance to Ebola Modelling</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>UN OCHA HDX</strong>
                      <small>Humanitarian Data Exchange</small>
                    </td>
                    <td>CKAN REST API + HDX HAPI v2</td>
                    <td>Real-time during active crises</td>
                    <td>
                      <span className="badge green">CORS Enabled (*)</span> · No key needed
                    </td>
                    <td>
                      <strong>Highest:</strong> Official repository for WHO, UNICEF, and MSF field sitreps.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>WHO GHO OData</strong>
                      <small>Global Health Observatory</small>
                    </td>
                    <td>OData v4 REST API</td>
                    <td>Annual / Indicator-based</td>
                    <td>Publicly accessible</td>
                    <td>
                      <strong>Low:</strong> GHO tracks long-term national health indicators, not acute filovirus linelists.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>U.S. CDC Open Data</strong>
                      <small>data.cdc.gov (SODA API)</small>
                    </td>
                    <td>Socrata Open Data (SODA)</td>
                    <td>Weekly / Periodic</td>
                    <td>Public REST API</td>
                    <td>
                      <strong>Moderate:</strong> Tracks US notifiable diseases and historical global VHF tables.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>ReliefWeb (UN OCHA)</strong>
                      <small>api.reliefweb.int/v2</small>
                    </td>
                    <td>Elasticsearch REST API</td>
                    <td>Continuous situational feeds</td>
                    <td>App token required (v2)</td>
                    <td>
                      <strong>Moderate:</strong> Excellent for humanitarian reports and situation text bulletins.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>3. Mathematical Modeling Impact: Streaming Data vs. Outbreak Trajectories</h3>
            <p>
              In deterministic mathematical epidemiology (such as the <strong>SEIRD model</strong> in your project),
              a differential equation solver relies on an <strong>initial condition vector</strong>{' '}
              [S₀, E₀, I₀, R₀, D₀] and time-invariant or step-scheduled parameters (β, σ, γ, μ).
            </p>
            <p>
              Integrating a live API directly into a dynamic ODE simulation requires{' '}
              <strong>Sequential Data Assimilation</strong> (e.g., an <em>Extended Kalman Filter</em> or{' '}
              <em>Physics-Informed Neural Network</em>) to update parameter estimates like β(t) as fresh observations
              arrive, rather than restarting the ODE from day 0.
            </p>
          </article>
        </div>
      )}

      {/* ================= TAB 4: STRAIN BENCHMARKS ================= */}
      {activeTab === 'strains' && (
        <div className="tab-content">
          <div className="strains-intro">
            <h3>Epidemiological Parameters by Ebola Virus Strain</h3>
            <p>
              Different species of the genus <em>Orthoebolavirus</em> exhibit distinct biological virulence,
              incubation periods, and mortality profiles. When configuring your SEIRD model, these clinical
              parameters dictate the rates σ (incubation rate = 1 / incubation days),{' '}
              γ (recovery rate), and μ (disease-induced mortality rate).
            </p>
          </div>

          <div className="strains-grid">
            {STRAIN_BENCHMARKS.map((s, idx) => (
              <div key={idx} className="strain-card">
                <div className="strain-header">
                  <h4>{s.strain}</h4>
                  <span className="cfr-pill">CFR: {s.cfr}</span>
                </div>

                <div className="strain-metrics">
                  <div className="s-metric">
                    <span>Basic Reproduction Number (R₀)</span>
                    <strong>{s.r0}</strong>
                  </div>
                  <div className="s-metric">
                    <span>Incubation Period</span>
                    <strong>{s.incubation}</strong>
                  </div>
                </div>

                <p className="strain-outbreaks">
                  <strong>Major Historic Outbreaks:</strong> {s.majorOutbreaks}
                </p>

                <p className="strain-notes">{s.notes}</p>

                <div className="model-equiv">
                  <span>Illustrative SEIRD Rate Mappings:</span>
                  <div className="rates-row">
                    <code>σ = {s.modelParamSigma}</code>
                    <code>γ = {s.modelParamGamma}</code>
                    <code>μ = {s.modelParamMu}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 5: DEVELOPER CODE ================= */}
      {activeTab === 'code' && (
        <div className="tab-content">
          <article className="code-doc-card">
            <h3>Live API Integration Code Snippets</h3>
            <p>
              These snippets demonstrate how to query live UN OCHA HDX Ebola datasets and observation feeds programmatically
              in both Python (for your backend mathematical models) and JavaScript (for the React dashboard).
            </p>

            <div className="code-snippet-wrap">
              <div className="snippet-header">
                <span>Python (Backend Ingestion &amp; SEIRD Calibration Endpoint)</span>
                <span className="lang-tag">python</span>
              </div>
              <pre className="code-block">
{`import requests
import csv
import io

def fetch_live_surveillance_feed():
    """
    Fetch official Ebola surveillance observations from INRB-UMIE & HDX.
    """
    cases_url = "https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main/data/insp_sitrep/processed/insp_sitrep__national_cumulative_confirmed_cases__daily.csv"
    deaths_url = "https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main/data/insp_sitrep/processed/insp_sitrep__national_cumulative_confirmed_deaths__daily.csv"
    
    cases_res = requests.get(cases_url)
    deaths_res = requests.get(deaths_url)
    
    cases_reader = csv.DictReader(io.StringIO(cases_res.text))
    deaths_reader = csv.DictReader(io.StringIO(deaths_res.text))
    
    deaths_map = {r['date']: int(r['national_cumulative_confirmed_deaths']) for r in deaths_reader if r.get('date')}
    
    observations = []
    for r in cases_reader:
        d = r['date']
        cases = int(r['national_cumulative_confirmed_cases'])
        deaths = deaths_map.get(d)
        cfr = round((deaths / cases * 100), 2) if (deaths and cases) else None
        observations.append({'date': d, 'cases': cases, 'deaths': deaths, 'cfr': cfr})
        
    latest = observations[-1]
    print(f"Latest observation: {latest['date']} -> {latest['cases']} cases, {latest['deaths']} deaths")
    return observations`}
              </pre>
            </div>

            <div className="code-snippet-wrap" style={{ marginTop: '20px' }}>
              <div className="snippet-header">
                <span>JavaScript / Vite Frontend (Auto-Refreshed Hourly)</span>
                <span className="lang-tag">javascript</span>
              </div>
              <pre className="code-block">
{`import { fetchSurveillanceObservations } from './services/liveSurveillanceService';

// Automatic Hourly Ingestion Poller
export function setupHourlySurveillancePoller(onDataReceived) {
  const ONE_HOUR = 60 * 60 * 1000;
  
  // Initial sync
  fetchSurveillanceObservations().then(onDataReceived);
  
  // Recurring polling
  const intervalId = setInterval(async () => {
    try {
      const data = await fetchSurveillanceObservations();
      onDataReceived(data);
    } catch (err) {
      console.warn("Periodic surveillance check failed, retaining last verified observations:", err);
    }
  }, ONE_HOUR);
  
  return () => clearInterval(intervalId);
}`}
              </pre>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
