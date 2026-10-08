import { useEffect, useRef, useState } from "react";

// ============================================================
// Field metadata: how to label + render each timeline key.
// Anything not listed here falls back to a generic bar gauge
// (or a badge if the value is a string).
// ============================================================

const FIELD_META = {
  conn_queue_pct: { label: "Connection queue", suffix: "%", max: 100 },
  cpu_pct: { label: "CPU load", suffix: "%", max: 100 },
  legit_requests_served_pct: {
    label: "Legit requests served",
    suffix: "%",
    max: 100,
    invert: true
  },
  ports_scanned: { label: "Ports scanned", suffix: "", max: 1024 },
  failed_logins: { label: "Failed logins", suffix: "", max: 25 },
  access_level: { label: "Access level", badge: true },
  privilege: { label: "Privilege level", badge: true },
  shells_spawned: { label: "Shells spawned", suffix: "", max: 3 },
  files_written: { label: "Files written", suffix: "", max: 7 }
};

function badgeClass(value) {
  const normalized = String(value).toLowerCase();

  if (normalized === "root") {
    return "sandbox-badge sandbox-badge-root";
  }

  if (normalized === "user") {
    return "sandbox-badge sandbox-badge-user";
  }

  return "sandbox-badge sandbox-badge-none";
}

function GaugeRow({ fieldKey, value }) {
  const meta = FIELD_META[fieldKey] || {
    label: fieldKey.replace(/_/g, " "),
    suffix: "",
    max: 100
  };

  if (meta.badge) {
    return (
      <div className="sandbox-gauge-row" style={{ alignItems: "center" }}>
        <span className="sandbox-gauge-label">{meta.label}</span>
        <span className={badgeClass(value)}>{String(value)}</span>
      </div>
    );
  }

  const numericValue = Number(value) || 0;

  const pct = Math.min(
    Math.max((numericValue / (meta.max || 100)) * 100, 0),
    100
  );

  const displayPct = meta.invert ? 100 - pct : pct;

  return (
    <div>
      <div className="sandbox-gauge-row">
        <span className="sandbox-gauge-label">{meta.label}</span>
        <span className="sandbox-gauge-value">
          {numericValue}
          {meta.suffix}
        </span>
      </div>

      <div className="sandbox-bar-track">
        <div
          className="sandbox-bar-fill"
          style={{ width: `${displayPct}%` }}
        />
      </div>
    </div>
  );
}

export default function SandboxWidget({ data, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);

  const timerRef = useRef(null);

  const timeline = data?.timeline || [];

  useEffect(() => {
    setStepIndex(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (timeline.length <= 1) {
      return undefined;
    }

    let current = 0;

    timerRef.current = setInterval(() => {
      current += 1;

      if (current >= timeline.length) {
        clearInterval(timerRef.current);
        return;
      }

      setStepIndex(current);
    }, 700);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function replay() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setStepIndex(0);

    let current = 0;

    timerRef.current = setInterval(() => {
      current += 1;

      if (current >= timeline.length) {
        clearInterval(timerRef.current);
        return;
      }

      setStepIndex(current);
    }, 700);
  }

  if (!data || timeline.length === 0) {
    return null;
  }

  const currentFrame = timeline[stepIndex];

  const gaugeFields = Object.keys(currentFrame).filter(
    (key) => key !== "t"
  );

  return (
    <div className="sandbox-widget">
      <div className="sandbox-header">
        <span
          className={`sandbox-category sandbox-category-${data.category}`}
        >
          {data.category}
        </span>

        <span className="sandbox-title">
          {data.attack_name
            ? data.attack_name.toUpperCase()
            : data.label}
        </span>
      </div>

      <p className="sandbox-caption">{data.caption}</p>

      {data.driver_features?.length > 0 && (
        <div className="sandbox-driver-features">
          Key ML features: {data.driver_features.join(", ")}
        </div>
      )}

      <div className="sandbox-gauges">
        {gaugeFields.map((key) => (
          <GaugeRow key={key} fieldKey={key} value={currentFrame[key]} />
        ))}
      </div>

      <div className="sandbox-footer">
        <span>
          Step {stepIndex + 1} of {timeline.length}
          {data.threat_id ? ` · Alert #${data.threat_id}` : ""}
        </span>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="sandbox-replay" onClick={replay}>
            ↺ Replay
          </button>

          {onClose && (
            <button className="sandbox-replay" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
