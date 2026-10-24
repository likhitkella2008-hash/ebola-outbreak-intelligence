from http.server import BaseHTTPRequestHandler
import json
import urllib.request
import urllib.error
import csv
import io
from datetime import datetime, timezone

UPSTREAM_CASES_URL = (
    "https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main/data/"
    "insp_sitrep/processed/insp_sitrep__national_cumulative_confirmed_cases__daily.csv"
)

UPSTREAM_DEATHS_URL = (
    "https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main/data/"
    "insp_sitrep/processed/insp_sitrep__national_cumulative_confirmed_deaths__daily.csv"
)

HDX_CATALOG_URL = (
    "https://data.humdata.org/dataset/republique-democratique-du-congo-cas-et-deces-d-ebola"
)

# In-memory server-side cache for Vercel lambda instances
_CACHE = {
    "timestamp": None,
    "payload": None
}
CACHE_TTL_SECONDS = 3600  # 1 hour server cache


def fetch_and_parse_feed():
    now_utc = datetime.now(timezone.utc)
    
    # Check in-memory cache
    if _CACHE["payload"] and _CACHE["timestamp"]:
        age = (now_utc - _CACHE["timestamp"]).total_seconds()
        if age < CACHE_TTL_SECONDS:
            return _CACHE["payload"]

    headers = {"User-Agent": "Ebola-Outbreak-Intelligence/1.0 (Research Surveillance Client)"}
    
    # Fetch cases
    req_c = urllib.request.Request(UPSTREAM_CASES_URL, headers=headers)
    with urllib.request.urlopen(req_c, timeout=8) as res_c:
        cases_text = res_c.read().decode("utf-8")
    
    # Fetch deaths
    req_d = urllib.request.Request(UPSTREAM_DEATHS_URL, headers=headers)
    with urllib.request.urlopen(req_d, timeout=8) as res_d:
        deaths_text = res_d.read().decode("utf-8")

    cases_reader = csv.DictReader(io.StringIO(cases_text))
    deaths_reader = csv.DictReader(io.StringIO(deaths_text))

    deaths_map = {}
    for r in deaths_reader:
        d = r.get("date", "").strip()
        val = r.get("national_cumulative_confirmed_deaths", "").strip()
        if d and val:
            try:
                deaths_map[d] = int(val)
            except ValueError:
                pass

    observations = []
    prev_cases = None
    prev_deaths = None

    for r in cases_reader:
        d = r.get("date", "").strip()
        c_val = r.get("national_cumulative_confirmed_cases", "").strip()
        if not d or not c_val:
            continue
        try:
            cases = int(c_val)
        except ValueError:
            continue

        deaths = deaths_map.get(d)
        cfr = round((deaths / cases * 100), 2) if (deaths is not None and cases > 0) else None

        new_cases = (cases - prev_cases) if (prev_cases is not None) else None
        new_deaths = (deaths - prev_deaths) if (deaths is not None and prev_deaths is not None) else None

        observations.append({
            "date": d,
            "cumulative_confirmed_cases": cases,
            "cumulative_confirmed_deaths": deaths,
            "calculated_cfr_percent": cfr,
            "daily_new_confirmed_cases": new_cases,
            "daily_new_confirmed_deaths": new_deaths
        })

        prev_cases = cases
        if deaths is not None:
            prev_deaths = deaths

    if not observations:
        raise RuntimeError("No observation records parsed from upstream feeds.")

    latest = observations[-1]

    payload = {
        "success": True,
        "source_name": "INRB-UMIE & UN OCHA HDX Consolidated Surveillance Feed",
        "source_url": HDX_CATALOG_URL,
        "upstream_cases_url": UPSTREAM_CASES_URL,
        "upstream_deaths_url": UPSTREAM_DEATHS_URL,
        "outbreak_context": "Bundibugyo virus disease (BDBV) Epidemiological Monitoring",
        "geographic_location": "Democratic Republic of the Congo (National & Subnational Health Zones)",
        "case_classification": "confirmed (laboratory/clinical)",
        "count_type": "cumulative",
        "fetched_at": now_utc.isoformat(),
        "data_classification": "OFFICIAL_SURVEILLANCE_BULLETIN",
        "is_realtime_streaming": False,
        "status_notice": (
            "Official periodic surveillance bulletin published by INRB-UMIE and catalogued "
            "on UN OCHA Humanitarian Data Exchange. Not an automated real-time streaming ticker."
        ),
        "latest_observation": {
            "date": latest["date"],
            "cumulative_confirmed_cases": latest["cumulative_confirmed_cases"],
            "cumulative_confirmed_deaths": latest["cumulative_confirmed_deaths"],
            "calculated_cfr_percent": latest["calculated_cfr_percent"],
            "status_label": f"Latest Available Official Report ({latest['date']})"
        },
        "baseline_comparison": {
            "historical_dataset_end_date": "2026-08-16",
            "historical_dataset_cases": 5021,
            "historical_dataset_deaths": 2378,
            "additional_cases_since_baseline": latest["cumulative_confirmed_cases"] - 5021,
            "additional_deaths_since_baseline": (latest["cumulative_confirmed_deaths"] - 2378) if latest["cumulative_confirmed_deaths"] else None
        },
        "total_reporting_dates": len(observations),
        "earliest_date": observations[0]["date"],
        "latest_date": latest["date"],
        "time_series": observations
    }

    _CACHE["payload"] = payload
    _CACHE["timestamp"] = now_utc
    return payload


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        try:
            payload = fetch_and_parse_feed()
            body = json.dumps(payload, indent=2).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
            self.send_header("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200")
            self.end_headers()
            self.wfile.write(body)

        except Exception as error:
            err_payload = {
                "success": False,
                "error": str(error),
                "message": "Unable to retrieve upstream surveillance feed.",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            body = json.dumps(err_payload).encode("utf-8")

            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()
