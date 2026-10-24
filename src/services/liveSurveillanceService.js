/**
 * Live Surveillance Service
 * 
 * Fetches and synchronizes official Ebola case and death observations from the
 * INRB-UMIE & UN OCHA HDX surveillance feed.
 * 
 * In Vercel production: Uses the cached /api/surveillance serverless endpoint.
 * In local Vite dev / standalone: Transparently falls back to direct client-side
 * retrieval from the raw verified CDN with identical data normalization.
 */

const UPSTREAM_CASES_URL =
  'https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main/data/insp_sitrep/processed/insp_sitrep__national_cumulative_confirmed_cases__daily.csv';

const UPSTREAM_DEATHS_URL =
  'https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main/data/insp_sitrep/processed/insp_sitrep__national_cumulative_confirmed_deaths__daily.csv';

const HDX_DATASET_URL =
  'https://data.humdata.org/dataset/republique-democratique-du-congo-cas-et-deces-d-ebola';

function parseSimpleCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

export async function fetchDirectFromCdn() {
  const [casesRes, deathsRes] = await Promise.all([
    fetch(UPSTREAM_CASES_URL, { headers: { Accept: 'text/plain' } }),
    fetch(UPSTREAM_DEATHS_URL, { headers: { Accept: 'text/plain' } }),
  ]);

  if (!casesRes.ok || !deathsRes.ok) {
    throw new Error(
      `Upstream surveillance feed unavailable (HTTP ${casesRes.status}/${deathsRes.status})`
    );
  }

  const [casesText, deathsText] = await Promise.all([
    casesRes.text(),
    deathsRes.text(),
  ]);

  const casesRows = parseSimpleCsv(casesText);
  const deathsRows = parseSimpleCsv(deathsText);

  const deathsMap = new Map();
  for (const r of deathsRows) {
    const d = r.date;
    const v = Number(r.national_cumulative_confirmed_deaths);
    if (d && Number.isFinite(v)) {
      deathsMap.set(d, v);
    }
  }

  const observations = [];
  let prevCases = null;
  let prevDeaths = null;

  for (const r of casesRows) {
    const d = r.date;
    const cases = Number(r.national_cumulative_confirmed_cases);
    if (!d || !Number.isFinite(cases)) continue;

    const deaths = deathsMap.has(d) ? deathsMap.get(d) : null;
    const cfr =
      deaths != null && cases > 0
        ? Number(((deaths / cases) * 100).toFixed(2))
        : null;

    const newCases = prevCases != null ? Math.max(cases - prevCases, 0) : null;
    const newDeaths =
      deaths != null && prevDeaths != null
        ? Math.max(deaths - prevDeaths, 0)
        : null;

    observations.append
      ? observations.append
      : observations.push({
          date: d,
          cumulative_confirmed_cases: cases,
          cumulative_confirmed_deaths: deaths,
          calculated_cfr_percent: cfr,
          daily_new_confirmed_cases: newCases,
          daily_new_confirmed_deaths: newDeaths,
        });

    prevCases = cases;
    if (deaths != null) prevDeaths = deaths;
  }

  if (observations.length === 0) {
    throw new Error('No observation records found in upstream feed.');
  }

  const latest = observations[observations.length - 1];

  return {
    success: true,
    source_name: 'INRB-UMIE & UN OCHA HDX Consolidated Surveillance Feed',
    source_url: HDX_DATASET_URL,
    upstream_cases_url: UPSTREAM_CASES_URL,
    upstream_deaths_url: UPSTREAM_DEATHS_URL,
    outbreak_context: 'Bundibugyo virus disease (BDBV) Field Surveillance',
    geographic_location: 'Democratic Republic of the Congo (National & Cross-Border Health Zones)',
    case_classification: 'confirmed (laboratory/clinical)',
    count_type: 'cumulative',
    fetched_at: new Date().toISOString(),
    data_classification: 'OFFICIAL_SURVEILLANCE_BULLETIN',
    is_realtime_streaming: false,
    status_notice:
      'Official periodic surveillance bulletin published by INRB-UMIE and catalogued on UN OCHA HDX. Not an automated real-time streaming ticker.',
    latest_observation: {
      date: latest.date,
      cumulative_confirmed_cases: latest.cumulative_confirmed_cases,
      cumulative_confirmed_deaths: latest.cumulative_confirmed_deaths,
      calculated_cfr_percent: latest.calculated_cfr_percent,
      status_label: `Latest Available Official Report (${latest.date})`,
    },
    baseline_comparison: {
      historical_dataset_end_date: '2026-08-16',
      historical_dataset_cases: 5021,
      historical_dataset_deaths: 2378,
      additional_cases_since_baseline:
        latest.cumulative_confirmed_cases - 5021,
      additional_deaths_since_baseline:
        latest.cumulative_confirmed_deaths != null
          ? latest.cumulative_confirmed_deaths - 2378
          : null,
    },
    total_reporting_dates: observations.length,
    earliest_date: observations[0].date,
    latest_date: latest.date,
    time_series: observations,
  };
}

export async function fetchSurveillanceObservations() {
  // First attempt: Vercel serverless Python endpoint
  try {
    const res = await fetch('/api/surveillance', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.latest_observation) {
        return json;
      }
    }
  } catch (err) {
    // If running in local Vite development without Vercel CLI server, proceed to direct fallback
  }

  // Fallback: Direct client-side retrieval from upstream CDN
  return await fetchDirectFromCdn();
}
