import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const OUTBREAK_LOCATION = {
  country: "Uganda",
  region: "Bundibugyo",
  disease: "Bundibugyo virus disease",
  lat: 0.71,
  lng: 30.06,
};

function MapFocus({ location }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([location.lat, location.lng], 5, {
      duration: 1,
    });
  }, [location, map]);

  return null;
}

function formatNumber(value) {
  return value == null ? "N/A" : Number(value).toLocaleString();
}

export default function OutbreakMap({ records: externalRecords, streamMode = 'historical' }) {
  const [localRecords, setLocalRecords] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(!externalRecords || externalRecords.length === 0);
  const [error, setError] = useState("");

  const records = externalRecords && externalRecords.length > 0 ? externalRecords : localRecords;

  useEffect(() => {
    if (externalRecords && externalRecords.length > 0) {
      setSelectedIndex(externalRecords.length - 1);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDataset() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/ebola_dataset.json");

        if (!response.ok) {
          throw new Error(
            `Could not load dataset (HTTP ${response.status}).`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("The dataset is empty or has an invalid format.");
        }

        const sortedData = [...data].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );

        if (!cancelled) {
          setLocalRecords(sortedData);
          setSelectedIndex(sortedData.length - 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load the dataset.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDataset();

    return () => {
      cancelled = true;
    };
  }, [externalRecords]);

  const selected = records[selectedIndex] ?? null;

  const summary = useMemo(() => {
    if (!records.length) {
      return {
        cases: 0,
        deaths: 0,
        weeklyCases: 0,
        weeklyDeaths: 0,
        cfr: null,
      };
    }

    const latest = records[records.length - 1];

    return {
      cases: latest.cumulative_confirmed_cases,
      deaths: latest.cumulative_confirmed_deaths,
      weeklyCases: latest.weekly_new_confirmed_cases,
      weeklyDeaths: latest.weekly_new_confirmed_deaths,
      cfr: latest.calculated_cfr_percent,
    };
  }, [records]);

  if (loading) {
    return (
      <div className="outbreak-map-page">
        <h1>Outbreak Intelligence Map</h1>
        <p>Loading your historical dataset...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="outbreak-map-page">
        <h1>Outbreak Intelligence Map</h1>

        <div className="map-disclaimer">
          <strong>Dataset loading failed</strong>
          <p>{error}</p>
          <p>
            Check that ebola_dataset.json is inside the public folder
            of your Vite project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="outbreak-map-page">
      <div className="outbreak-map-heading">
        <div>
          <span className="eyebrow">
            GEOSPATIAL INTELLIGENCE · {streamMode === 'historical' ? 'HISTORICAL BENCHMARK' : 'OFFICIAL SURVEILLANCE FEED'}
          </span>
          <h1>Outbreak Intelligence Map</h1>
          <p>
            {streamMode === 'historical'
              ? 'Explore the reported weekly outbreak statistics and their historical progression.'
              : 'Explore official surveillance situation reports across the monitored outbreak region.'}
          </p>
        </div>

        <span className="map-status">
          {records.length} {streamMode === 'historical' ? 'WEEKLY RECORDS' : 'DAILY REPORTS'}
        </span>
      </div>

      <div className="outbreak-summary-grid">
        <div className="outbreak-stat-card">
          <span>Cumulative confirmed cases</span>
          <strong>{formatNumber(summary.cases)}</strong>
        </div>

        <div className="outbreak-stat-card">
          <span>Cumulative confirmed deaths</span>
          <strong>{formatNumber(summary.deaths)}</strong>
        </div>

        <div className="outbreak-stat-card">
          <span>Latest weekly new cases</span>
          <strong>{formatNumber(summary.weeklyCases)}</strong>
        </div>

        <div className="outbreak-stat-card">
          <span>Calculated CFR</span>
          <strong>
            {summary.cfr == null
              ? "N/A"
              : `${Number(summary.cfr).toFixed(2)}%`}
          </strong>
        </div>
      </div>

      <div className="map-layout">
        <aside className="map-sidebar">
          <label htmlFor="outbreak-week">Select reporting date</label>

          <select
            id="outbreak-week"
            value={selectedIndex}
            onChange={(event) =>
              setSelectedIndex(Number(event.target.value))
            }
          >
            {records.map((record, index) => (
              <option key={record.date} value={index}>
                {record.date}
              </option>
            ))}
          </select>

          <h3>Selected report</h3>

          {selected && (
            <div className="map-report-details">
              <p>
                <span>Report number</span>
                <strong>{selected.report_number}</strong>
              </p>

              <p>
                <span>Cumulative cases</span>
                <strong>
                  {formatNumber(selected.cumulative_confirmed_cases)}
                </strong>
              </p>

              <p>
                <span>Cumulative deaths</span>
                <strong>
                  {formatNumber(selected.cumulative_confirmed_deaths)}
                </strong>
              </p>

              <p>
                <span>Weekly new cases</span>
                <strong>
                  {formatNumber(selected.weekly_new_confirmed_cases)}
                </strong>
              </p>

              <p>
                <span>Weekly new deaths</span>
                <strong>
                  {formatNumber(selected.weekly_new_confirmed_deaths)}
                </strong>
              </p>

              <p>
                <span>Reported CFR</span>
                <strong>
                  {selected.reported_cfr_percent == null
                    ? "N/A"
                    : `${selected.reported_cfr_percent}%`}
                </strong>
              </p>

              <p>
                <span>Case growth</span>
                <strong>
                  {selected.case_growth_percent == null
                    ? "N/A"
                    : `${selected.case_growth_percent}%`}
                </strong>
              </p>
            </div>
          )}

          <div className="map-disclaimer">
            <strong>Data limitation</strong>
            <p>
              These statistics are weekly totals from the supplied
              dataset. They are not district-level case counts.
              The source records require independent verification.
            </p>
          </div>
        </aside>

        <div className="map-main">
          <MapContainer
            center={[
              OUTBREAK_LOCATION.lat,
              OUTBREAK_LOCATION.lng,
            ]}
            zoom={5}
            scrollWheelZoom
            className="leaflet-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapFocus location={OUTBREAK_LOCATION} />

            <CircleMarker
              center={[
                OUTBREAK_LOCATION.lat,
                OUTBREAK_LOCATION.lng,
              ]}
              radius={12}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#48c6cf",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{OUTBREAK_LOCATION.region}, Uganda</strong>
                <br />
                Bundibugyo virus disease
                <br />
                Select a reporting date in the sidebar to inspect
                the corresponding weekly totals.
              </Popup>
            </CircleMarker>
          </MapContainer>

          <div className="map-detail-panel">
            <span className="eyebrow">OUTBREAK REPORT</span>

            <h2>
              {OUTBREAK_LOCATION.region}, {OUTBREAK_LOCATION.country}
            </h2>

            <p>
              Selected reporting date:{" "}
              <strong>{selected?.date ?? "N/A"}</strong>
            </p>

            <div className="map-detail-grid">
              <div>
                <span>Cumulative cases</span>
                <strong>
                  {formatNumber(selected?.cumulative_confirmed_cases)}
                </strong>
              </div>

              <div>
                <span>Cumulative deaths</span>
                <strong>
                  {formatNumber(selected?.cumulative_confirmed_deaths)}
                </strong>
              </div>

              <div>
                <span>Weekly new cases</span>
                <strong>
                  {formatNumber(selected?.weekly_new_confirmed_cases)}
                </strong>
              </div>

              <div>
                <span>Weekly new deaths</span>
                <strong>
                  {formatNumber(selected?.weekly_new_confirmed_deaths)}
                </strong>
              </div>
            </div>

            <p className="map-source">
              Dataset source field:{" "}
              {selected?.source ?? "Not supplied"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}