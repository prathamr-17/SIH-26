import { useEffect, useMemo, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

import SandboxWidget from "./SandboxWidget";

import "./App.css";


const API_URL = "http://127.0.0.1:8000";


function App() {

  // ========================================================
  // LOGIN STATE
  // ========================================================

  const [loggedIn, setLoggedIn] = useState(
    Boolean(
      localStorage.getItem("network_ai_token")
    )
  );

  const [loginUsername, setLoginUsername] =
    useState("");

  const [loginPassword, setLoginPassword] =
    useState("");

  const [loginError, setLoginError] =
    useState("");

  const [loginLoading, setLoginLoading] =
    useState(false);


  // ========================================================
  // PAGE STATE
  // ========================================================

  const [page, setPage] =
    useState("network");


  // ========================================================
  // NETWORK DATA
  // ========================================================

  const [predictions, setPredictions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  // ========================================================
  // REPLAY STATE
  // ========================================================

  const [replayStatus, setReplayStatus] =
    useState({
      running: false,
      current_record: 0,
      total_records: 0,
      generated_count: 0,
      progress: 0,
      remaining: 0,
      last_event: null,
      feed_type: "SIMULATED LIVE FEED",
      source: "NSL-KDD KDDTrain+.txt"
    });

  const [replayError, setReplayError] =
    useState("");

  const [selectedAlertId, setSelectedAlertId] =
    useState(null);


  // ========================================================
  // AI STATE
  // ========================================================

  const [question, setQuestion] = useState(
    "Why was this traffic classified as an attack?"
  );

  const [aiResult, setAiResult] =
    useState(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiError, setAiError] =
    useState("");


  // ========================================================
  // SANDBOX STATE (standalone, not tied to chat)
  // ========================================================

  const [sandboxLoading, setSandboxLoading] =
    useState(false);


  // ========================================================
  // LOGIN
  // ========================================================

  async function handleLogin() {

    if (
      !loginUsername.trim() ||
      !loginPassword.trim()
    ) {

      setLoginError(
        "Please enter username and password."
      );

      return;
    }

    try {

      setLoginLoading(true);
      setLoginError("");

      const response = await fetch(
        `${API_URL}/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            username:
              loginUsername.trim(),

            password:
              loginPassword
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Login failed."
        );
      }

      localStorage.setItem(
        "network_ai_token",
        data.token
      );

      setLoggedIn(true);

      setPage("network");

      setLoginPassword("");

    } catch (err) {

      console.error(err);

      setLoginError(
        err.message ||
        "Unable to login."
      );

    } finally {

      setLoginLoading(false);

    }
  }


  // ========================================================
  // LOGOUT
  // ========================================================

  async function handleLogout() {

    const token =
      localStorage.getItem(
        "network_ai_token"
      );

    try {

      if (token) {

        await fetch(
          `${API_URL}/logout`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      }

    } catch (err) {

      console.error(
        "Logout error:",
        err
      );

    } finally {

      localStorage.removeItem(
        "network_ai_token"
      );

      setLoggedIn(false);

      setPage("network");

      setPredictions([]);

      setAiResult(null);

    }
  }


  // ========================================================
  // LOAD NETWORK PREDICTIONS
  // ========================================================

  useEffect(() => {

    async function loadPredictions() {

      if (!loggedIn) {

        setLoading(false);

        return;
      }

      try {

        setLoading(true);
        setError("");

        const token =
          localStorage.getItem(
            "network_ai_token"
          );

        if (!token) {

          setLoggedIn(false);

          return;
        }

        const response = await fetch(
          `${API_URL}/predictions`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );


        if (response.status === 401) {

          localStorage.removeItem(
            "network_ai_token"
          );

          setLoggedIn(false);

          return;
        }


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.detail ||
            `Backend returned ${response.status}`
          );
        }


        if (!Array.isArray(data)) {

          throw new Error(
            "Invalid prediction data."
          );
        }


        setPredictions(data);

      } catch (err) {

        console.error(err);

        setError(
          err.message ||
          "Unable to load network predictions."
        );

      } finally {

        setLoading(false);

      }

    }


    loadPredictions();

  }, [loggedIn]);


  // ========================================================
  // REPLAY ENGINE
  // ========================================================

  async function getReplayStatus() {

    const token =
      localStorage.getItem(
        "network_ai_token"
      );

    if (!token) {
      return null;
    }

    try {

      const response = await fetch(
        `${API_URL}/replay/status`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

      if (response.status === 401) {

        localStorage.removeItem(
          "network_ai_token"
        );

        setLoggedIn(false);

        return null;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to read replay status."
        );
      }

      setReplayStatus(data);
      setReplayError("");

      return data;

    } catch (err) {

      console.error(err);

      setReplayError(
        err.message ||
        "Unable to read replay status."
      );

      return null;
    }
  }


  async function replayRequest(
    endpoint
  ) {

    const token =
      localStorage.getItem(
        "network_ai_token"
      );

    if (!token) {

      setLoggedIn(false);

      return null;
    }

    try {

      const response =
        await fetch(
          `${API_URL}${endpoint}`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      if (response.status === 401) {

        localStorage.removeItem(
          "network_ai_token"
        );

        setLoggedIn(false);

        return null;
      }

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
          `Replay request failed (${response.status})`
        );
      }

      if (data && data.total_records !== undefined) {
        setReplayStatus(data);
      }

      setReplayError("");

      return data;

    } catch (err) {

      console.error(err);

      setReplayError(
        err.message ||
        "Replay request failed."
      );

      return null;
    }
  }


  async function getNextReplayEvent() {

    const token =
      localStorage.getItem(
        "network_ai_token"
      );

    if (!token) {

      setLoggedIn(false);

      return null;
    }

    try {

      const response =
        await fetch(
          `${API_URL}/replay/next`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      if (response.status === 401) {

        localStorage.removeItem(
          "network_ai_token"
        );

        setLoggedIn(false);

        return null;
      }

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Unable to generate replay event."
        );
      }

      if (data.replay) {
        setReplayStatus(
          data.replay
        );
      }

      if (data.event) {

        const event =
          data.event;

        setPredictions(
          current => {

            const withoutDuplicate =
              current.filter(
                item =>
                  item.id !== event.id
              );

            return [
              event,
              ...withoutDuplicate
            ].slice(0, 100);
          }
        );

        setSelectedAlertId(
          event.id
        );

        return event;
      }

      return null;

    } catch (err) {

      console.error(err);

      setReplayError(
        err.message ||
        "Unable to generate replay event."
      );

      return null;
    }
  }


  async function startReplay() {

    setReplayError("");

    const result =
      await replayRequest(
        "/replay/start"
      );

    if (!result) {
      return;
    }

    setPredictions([]);

    setSelectedAlertId(null);

    setAiResult(null);

    await getNextReplayEvent();
  }


  async function pauseReplay() {

    await replayRequest(
      "/replay/pause"
    );
  }


  async function resetReplay() {

    const result =
      await replayRequest(
        "/replay/reset"
      );

    if (!result) {
      return;
    }

    setPredictions([]);

    setSelectedAlertId(null);

    setAiResult(null);

    setReplayStatus(
      result
    );
  }


  useEffect(() => {

    if (!loggedIn) {
      return undefined;
    }

    getReplayStatus();

    return undefined;

  }, [loggedIn]);


  useEffect(() => {

    if (
      !loggedIn ||
      !replayStatus.running
    ) {
      return undefined;
    }

    const interval =
      setInterval(() => {

        getNextReplayEvent();

      }, 2500);

    return () => {
      clearInterval(interval);
    };

  }, [
    loggedIn,
    replayStatus.running
  ]);


  // ========================================================
  // CHRONOLOGICAL DATA
  // ========================================================

  const chronologicalPredictions =
    useMemo(
      () =>
        [...predictions].reverse(),
      [predictions]
    );


  // ========================================================
  // COUNTS
  // ========================================================

  const totalRecords =
    predictions.length;


  const attackCount =
    predictions.filter(
      item =>
        String(
          item.prediction || ""
        ).toLowerCase() === "attack"
    ).length;


  const normalCount =
    predictions.filter(
      item =>
        String(
          item.prediction || ""
        ).toLowerCase() === "normal"
    ).length;


  // ========================================================
  // LATEST RECORD
  // ========================================================

  const latestPrediction =
    predictions.length > 0
      ? predictions[0]
      : null;


  const latestConfidence =
    latestPrediction
      ? Number(
          latestPrediction.confidence
        ) || 0
      : 0;


  const latestIsAttack =
    latestPrediction &&
    String(
      latestPrediction.prediction || ""
    ).toLowerCase() === "attack";


  const threatScore =
    latestPrediction
      ? latestIsAttack
        ? latestConfidence
        : 100 - latestConfidence
      : 0;


  // ========================================================
  // CHART DATA
  // ========================================================

  const chartData =
    chronologicalPredictions.map(
      (item, index) => ({
        name: index + 1,

        confidence:
          Number(
            item.confidence
          ) || 0
      })
    );


  const distributionData = [
    {
      name: "Attack",
      value: attackCount
    },

    {
      name: "Normal",
      value: normalCount
    }
  ];


  // ========================================================
  // AI ANALYSIS (chat flow)
  //
  // The backend inspects the question for a sandbox intent
  // ("simulate 4821", "sandbox DoS", ...) first. If it finds
  // one, it returns { type: "sandbox", data }. Otherwise it
  // returns the normal { type: "text", ... } explanation.
  // ========================================================

  async function analyzeQuestion() {

    if (!question.trim()) {

      setAiError(
        "Please enter a question."
      );

      return;
    }


    try {

      setAiLoading(true);
      setAiError("");
      setAiResult(null);


      const token =
        localStorage.getItem(
          "network_ai_token"
        );


      if (!token) {

        setLoggedIn(false);

        return;
      }


      const response = await fetch(
        `${API_URL}/ai/analyze`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({
            question:
              question.trim(),

            record_id:
              selectedAlertId
          })
        }
      );


      const data =
        await response.json();


      if (response.status === 401) {

        localStorage.removeItem(
          "network_ai_token"
        );

        setLoggedIn(false);

        return;
      }


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "AI analysis failed."
        );
      }


      setAiResult(data);

    } catch (err) {

      console.error(err);

      setAiError(
        err.message ||
        "Unable to generate AI explanation."
      );

    } finally {

      setAiLoading(false);

    }
  }


  // ========================================================
  // SANDBOX (standalone flow)
  //
  // Calls GET /api/sandbox/{target} directly, bypassing the
  // AI question box entirely. Used by the quick-launch buttons
  // on the AI page.
  // ========================================================

  async function runSandbox(target) {

    try {

      setSandboxLoading(true);
      setAiError("");
      setAiResult(null);

      const token =
        localStorage.getItem(
          "network_ai_token"
        );

      if (!token) {

        setLoggedIn(false);

        return;
      }

      const response = await fetch(
        `${API_URL}/api/sandbox/${encodeURIComponent(target)}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {

        localStorage.removeItem(
          "network_ai_token"
        );

        setLoggedIn(false);

        return;
      }

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Unable to build sandbox simulation."
        );
      }

      setAiResult({
        type: "sandbox",
        data
      });

    } catch (err) {

      console.error(err);

      setAiError(
        err.message ||
        "Unable to build sandbox simulation."
      );

    } finally {

      setSandboxLoading(false);

    }
  }


  // ========================================================
  // LOGIN PAGE
  // ========================================================

  if (!loggedIn) {

    return (

      <div className="login-page">

        <div className="login-background-grid"></div>


        <div className="login-card">

          <div className="login-brand">

            <div className="login-logo">
              NT
            </div>

            <div>

              <div className="brand-name">
                NETWORK THREAT
              </div>

              <div className="brand-subtitle">
                INTELLIGENCE PLATFORM
              </div>

            </div>

          </div>


          <div className="login-heading">

            <h1>
              Secure Access
            </h1>

            <p>
              Sign in to the AI Network Threat
              Forecasting System
            </p>

          </div>


          <div className="login-status">

            <span className="status-dot"></span>

            LOCAL SYSTEM

          </div>


          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleLogin();
            }}
          >

            <label>
              USERNAME
            </label>

            <input
              type="text"
              value={loginUsername}
              onChange={(event) =>
                setLoginUsername(
                  event.target.value
                )
              }
              placeholder="Enter username"
              autoComplete="username"
            />


            <label>
              PASSWORD
            </label>

            <input
              type="password"
              value={loginPassword}
              onChange={(event) =>
                setLoginPassword(
                  event.target.value
                )
              }
              placeholder="Enter password"
              autoComplete="current-password"
            />


            {loginError && (

              <div className="login-error">
                {loginError}
              </div>

            )}


            <button
              type="submit"
              className="login-button"
              disabled={loginLoading}
            >

              <span>

                {loginLoading
                  ? "AUTHENTICATING..."
                  : "SIGN IN"}

              </span>

              <span className="login-arrow">
                →
              </span>

            </button>

          </form>


          <div className="login-demo-info">

            <div className="demo-label">
              DEMO ACCESS
            </div>

            <div className="demo-credentials">
              <span>
                Username: <strong>admin</strong>
              </span>

              <span>
                Password: <strong>admin123</strong>
              </span>
            </div>

          </div>


          <div className="login-footer">

            <span>
              AI-powered network security
            </span>

            <span>
              •
            </span>

            <span>
              Local deployment
            </span>

          </div>

        </div>

      </div>

    );
  }


  // ========================================================
  // SIDEBAR
  // ========================================================

  function Sidebar() {

    return (

      <aside className="sidebar">

        <div className="sidebar-top">

          <div className="logo">
            NT
          </div>

        </div>


        <div className="sidebar-navigation">


          <button
            className={
              `sidebar-item ${
                page === "network"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("network")
            }
          >

            <div className="sidebar-icon">
              ◉
            </div>

            <span>
              Network
            </span>

          </button>


          <button
            className={
              `sidebar-item ${
                page === "ai"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("ai")
            }
          >

            <div className="sidebar-icon">
              ◈
            </div>

            <span>
              AI Analyst
            </span>

          </button>


          <button
            className={
              `sidebar-item ${
                page === "threats"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("threats")
            }
          >

            <div className="sidebar-icon">
              ⚠
            </div>

            <span>
              Threats
            </span>

          </button>


          <button
            className={
              `sidebar-item ${
                page === "settings"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("settings")
            }
          >

            <div className="sidebar-icon">
              ⚙
            </div>

            <span>
              Settings
            </span>

          </button>

        </div>


        <div className="sidebar-bottom">

          <button
            className="sidebar-item logout-item"
            onClick={
              handleLogout
            }
          >

            <div className="sidebar-icon">
              ⇥
            </div>

            <span>
              Logout
            </span>

          </button>

        </div>

      </aside>

    );
  }


  // ========================================================
  // HEADER
  // ========================================================

  function Header() {

    let title =
      "AI Network Threat Forecasting";

    let subtitle =
      "Network Monitoring Dashboard";


    if (page === "ai") {

      title =
        "AI Security Analyst";

      subtitle =
        "Local AI-powered threat explanation";

    }


    if (page === "threats") {

      title =
        "Threat Intelligence";

      subtitle =
        "Detected network threats and alerts";

    }


    if (page === "settings") {

      title =
        "System Settings";

      subtitle =
        "Application configuration and status";

    }


    return (

      <header className="header">


        <div>

          <div className="header-breadcrumb">
            SECURITY OPERATIONS CENTER
          </div>

          <h1>
            {title}
          </h1>

          <p>
            {subtitle}
          </p>

        </div>


        <div className="header-right">

          <div className="live">

            <span className="live-dot"></span>

            SIMULATED LIVE FEED

          </div>


          <div className="header-user">

            <span className="user-status"></span>

            admin

          </div>

        </div>

      </header>

    );
  }


  // ========================================================
  // NETWORK DASHBOARD
  // ========================================================

  function NetworkDashboard() {

    return (

      <>

        <section className="replay-panel panel">

          <div className="replay-header">

            <div>

              <div className="replay-title-row">

                <h3>
                  Historical Threat Replay
                </h3>

                <span
                  className={
                    replayStatus.running
                      ? "replay-state running"
                      : "replay-state"
                  }
                >
                  {replayStatus.running
                    ? "REPLAYING"
                    : "PAUSED"}
                </span>

              </div>

              <p className="panel-description">
                NSL-KDD records are processed one event at a time as a simulated live SOC feed.
              </p>

            </div>

            <div className="replay-source">
              SIMULATED LIVE FEED
            </div>

          </div>


          <div className="replay-controls">

            <button
              className="replay-button primary"
              onClick={startReplay}
              disabled={
                replayStatus.running
              }
            >
              ▶ START REPLAY
            </button>

            <button
              className="replay-button"
              onClick={pauseReplay}
              disabled={
                !replayStatus.running
              }
            >
              ❚❚ PAUSE
            </button>

            <button
              className="replay-button"
              onClick={getNextReplayEvent}
              disabled={
                !replayStatus.running
              }
            >
              STEP EVENT
            </button>

            <button
              className="replay-button reset"
              onClick={resetReplay}
            >
              ↺ RESET
            </button>

          </div>


          <div className="replay-info-grid">

            <div>
              <span>RECORD</span>

              <strong>
                {replayStatus.current_record || 0}
                {" / "}
                {replayStatus.total_records || 0}
              </strong>
            </div>

            <div>
              <span>PROCESSED</span>

              <strong>
                {replayStatus.generated_count || 0}
              </strong>
            </div>

            <div>
              <span>REMAINING</span>

              <strong>
                {replayStatus.remaining || 0}
              </strong>
            </div>

            <div>
              <span>PROGRESS</span>

              <strong>
                {Number(
                  replayStatus.progress || 0
                ).toFixed(2)}%
              </strong>
            </div>

          </div>


          <div className="replay-progress-track">

            <div
              className="replay-progress-fill"
              style={{
                width:
                  `${Math.min(
                    Math.max(
                      Number(
                        replayStatus.progress || 0
                      ),
                      0
                    ),
                    100
                  )}%`
              }}
            />

          </div>


          {replayError && (
            <div className="replay-error">
              {replayError}
            </div>
          )}

        </section>


        {error && (

          <div className="api-error">

            <strong>
              Backend Error
            </strong>

            <span>
              {error}
            </span>

          </div>

        )}


        <section className="kpi-container">


          <div className="card">

            <p>
              CURRENT THREAT SCORE
            </p>

            <div className="kpi-number-row">

              <h2
                className={
                  threatScore >= 70
                    ? "red"
                    : threatScore >= 40
                    ? "yellow"
                    : "green"
                }
              >

                {Math.round(
                  threatScore
                )}

              </h2>

              <span className="score-total">
                / 100
              </span>

            </div>

            <span>
              Based on latest ML prediction
            </span>

          </div>


          <div className="card">

            <p>
              TOTAL RECORDS
            </p>

            <h2>
              {totalRecords}
            </h2>

            <span>
              Historical traffic records
            </span>

          </div>


          <div className="card">

            <p>
              ATTACKS DETECTED
            </p>

            <h2 className="red">
              {attackCount}
            </h2>

            <span>
              Classified as attack
            </span>

          </div>


          <div className="card">

            <p>
              NORMAL TRAFFIC
            </p>

            <h2 className="green">
              {normalCount}
            </h2>

            <span>
              Classified as normal
            </span>

          </div>

        </section>


        <section className="panel-grid">


          <div className="panel">

            <div className="panel-header">

              <div>

                <h3>
                  Network Activity
                </h3>

                <p className="panel-description">
                  ML confidence across processed records
                </p>

              </div>

              <span>
                MODEL CONFIDENCE
              </span>

            </div>


            <div className="chart-container">

              {loading ? (

                <div className="chart-message">
                  Loading network data...
                </div>

              ) : chartData.length === 0 ? (

                <div className="chart-message">
                  No prediction data.
                </div>

              ) : (

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <LineChart
                    data={chartData}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#252a31"
                    />

                    <XAxis
                      dataKey="name"
                      stroke="#687382"
                      tickLine={false}
                    />

                    <YAxis
                      domain={[0, 100]}
                      stroke="#687382"
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#171c22",

                        border:
                          "1px solid #303740",

                        borderRadius:
                          "6px"
                      }}
                      labelStyle={{
                        color: "#9ba5b1"
                      }}
                      formatter={(value) => [
                        `${value}%`,
                        "Confidence"
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{
                        r: 5
                      }}
                    />

                  </LineChart>

                </ResponsiveContainer>

              )}

            </div>

          </div>


          <div className="panel">

            <div className="panel-header">

              <div>

                <h3>
                  Attack Distribution
                </h3>

                <p className="panel-description">
                  Current prediction breakdown
                </p>

              </div>

              <span>
                DATASET
              </span>

            </div>


            <div className="distribution-chart">

              {totalRecords === 0 ? (

                <div className="chart-message">
                  No data available.
                </div>

              ) : (

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <PieChart>

                    <Pie
                      data={
                        distributionData
                      }
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={78}
                      innerRadius={46}
                      paddingAngle={3}
                    >

                      <Cell
                        fill="#ef4444"
                      />

                      <Cell
                        fill="#22c55e"
                      />

                    </Pie>


                    <Tooltip
                      contentStyle={{
                        background:
                          "#171c22",

                        border:
                          "1px solid #303740",

                        borderRadius:
                          "6px"
                      }}
                    />


                    <Legend
                      verticalAlign="bottom"
                    />

                  </PieChart>

                </ResponsiveContainer>

              )}

            </div>

          </div>


          <div className="panel">

            <div className="panel-header">

              <div>

                <h3>
                  Threat Summary
                </h3>

                <p className="panel-description">
                  Current network state
                </p>

              </div>

            </div>


            <div className="summary">


              <div className="summary-row">

                <span>
                  Attack Records
                </span>

                <strong className="red">
                  {attackCount}
                </strong>

              </div>


              <div className="summary-row">

                <span>
                  Normal Records
                </span>

                <strong className="green">
                  {normalCount}
                </strong>

              </div>


              <div className="summary-row">

                <span>
                  Current Threat Score
                </span>

                <strong
                  className={
                    threatScore >= 70
                      ? "red"
                      : threatScore >= 40
                      ? "yellow"
                      : "green"
                  }
                >
                  {Math.round(
                    threatScore
                  )}
                </strong>

              </div>


              <div className="summary-row">

                <span>
                  Latest Prediction
                </span>

                <strong>
                  {latestPrediction
                    ? String(
                        latestPrediction.prediction
                      ).toUpperCase()
                    : "NO DATA"}
                </strong>

              </div>

            </div>

          </div>


          <div className="panel table-panel">

            <div className="panel-header">

              <div>

                <h3>
                  Recent Threat Alerts
                </h3>

                <p className="panel-description">
                  Predictions generated by the ML model
                </p>

              </div>

              <span>
                {totalRecords} RECORDS
              </span>

            </div>


            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>

                    <th>
                      ID
                    </th>

                    <th>
                      Timestamp
                    </th>

                    <th>
                      Prediction
                    </th>

                    <th>
                      Confidence
                    </th>

                    <th>
                      Severity
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {predictions.map(
                    (item, index) => {

                      const prediction =
                        String(
                          item.prediction ||
                          "unknown"
                        ).toLowerCase();


                      const confidence =
                        Number(
                          item.confidence
                        ) || 0;


                      const severity =
                        item.severity ||
                        (
                          prediction ===
                          "attack"

                            ? confidence >= 95
                              ? "CRITICAL"

                              : confidence >= 80
                              ? "HIGH"

                              : confidence >= 60
                              ? "MEDIUM"

                              : "LOW"

                            : "LOW"
                        );


                      return (

                        <tr
                          key={
                            item.id ??
                            index
                          }
                          className={
                            selectedAlertId === item.id
                              ? "clickable-row selected-alert"
                              : "clickable-row"
                          }
                          onClick={() =>
                            setSelectedAlertId(
                              item.id
                            )
                          }
                        >

                          <td>
                            #{item.id ??
                              index + 1}
                          </td>

                          <td>
                            {item.timestamp ??
                              "—"}
                          </td>

                          <td>

                            <span
                              className={
                                prediction ===
                                "attack"

                                  ? "badge attack"

                                  : prediction ===
                                    "normal"

                                  ? "badge normal"

                                  : "badge unknown"
                              }
                            >
                              {prediction.toUpperCase()}
                            </span>

                          </td>

                          <td>
                            {confidence}%
                          </td>

                          <td>

                            <span
                              className={
                                `severity ${
                                  severity ===
                                  "CRITICAL"

                                    ? "critical"

                                    : severity ===
                                      "HIGH"

                                    ? "high"

                                    : severity ===
                                      "MEDIUM"

                                    ? "medium"

                                    : "low"
                                }`
                              }
                            >
                              {severity}
                            </span>

                          </td>

                        </tr>

                      );

                    }
                  )}

                </tbody>

              </table>

            </div>

          </div>

        </section>

      </>

    );
  }


  // ========================================================
  // THREATS PAGE
  // ========================================================

  function ThreatsPage() {

    const attackRecords =
      predictions.filter(
        item =>
          String(
            item.prediction ||
            ""
          ).toLowerCase() ===
          "attack"
      );


    const criticalCount =
      attackRecords.filter(
        item =>
          String(
            item.severity ||
            ""
          ).toUpperCase() ===
          "CRITICAL"
      ).length;


    const highCount =
      attackRecords.filter(
        item =>
          String(
            item.severity ||
            ""
          ).toUpperCase() ===
          "HIGH"
      ).length;


    return (

      <section className="threats-page">


        <div className="kpi-container">


          <div className="card">

            <p>
              TOTAL THREATS
            </p>

            <h2 className="red">
              {attackRecords.length}
            </h2>

            <span>
              Detected attack records
            </span>

          </div>


          <div className="card">

            <p>
              CRITICAL
            </p>

            <h2 className="red">
              {criticalCount}
            </h2>

            <span>
              Highest severity
            </span>

          </div>


          <div className="card">

            <p>
              HIGH
            </p>

            <h2 className="yellow">
              {highCount}
            </h2>

            <span>
              High severity alerts
            </span>

          </div>


          <div className="card">

            <p>
              ATTACK RATE
            </p>

            <h2>
              {totalRecords > 0
                ? Math.round(
                    (
                      attackRecords.length /
                      totalRecords
                    ) * 100
                  )
                : 0}
              %
            </h2>

            <span>
              Of displayed records
            </span>

          </div>

        </div>


        <div className="panel table-panel">

          <div className="panel-header">

            <div>

              <h3>
                Threat Alerts
              </h3>

              <p className="panel-description">
                Attack predictions generated by the ML model
              </p>

            </div>

            <span>
              {attackRecords.length} THREATS
            </span>

          </div>


          <div className="table-wrapper">

            {attackRecords.length === 0 ? (

              <div className="chart-message">
                No attack records detected.
              </div>

            ) : (

              <table>

                <thead>

                  <tr>

                    <th>
                      ID
                    </th>

                    <th>
                      Timestamp
                    </th>

                    <th>
                      Prediction
                    </th>

                    <th>
                      Confidence
                    </th>

                    <th>
                      Severity
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {attackRecords.map(
                    (item, index) => {

                      const confidence =
                        Number(
                          item.confidence
                        ) || 0;


                      const severity =
                        item.severity ||
                        (
                          confidence >= 95
                            ? "CRITICAL"
                            : confidence >= 80
                            ? "HIGH"
                            : confidence >= 60
                            ? "MEDIUM"
                            : "LOW"
                        );


                      return (

                        <tr
                          key={
                            item.id ??
                            index
                          }
                          className={
                            selectedAlertId === item.id
                              ? "clickable-row selected-alert"
                              : "clickable-row"
                          }
                          onClick={() =>
                            setSelectedAlertId(
                              item.id
                            )
                          }
                        >

                          <td>
                            #{item.id ??
                              index + 1}
                          </td>

                          <td>
                            {item.timestamp ??
                              "—"}
                          </td>

                          <td>

                            <span className="badge attack">
                              ATTACK
                            </span>

                          </td>

                          <td>
                            {confidence}%
                          </td>

                          <td>

                            <span
                              className={
                                `severity ${
                                  severity ===
                                  "CRITICAL"

                                    ? "critical"

                                    : severity ===
                                      "HIGH"

                                    ? "high"

                                    : severity ===
                                      "MEDIUM"

                                    ? "medium"

                                    : "low"
                                }`
                              }
                            >
                              {severity}
                            </span>

                          </td>

                        </tr>

                      );

                    }
                  )}

                </tbody>

              </table>

            )}

          </div>

        </div>

      </section>

    );
  }


  // ========================================================
  // SETTINGS PAGE
  // ========================================================

  function SettingsPage() {

    return (

      <section className="settings-page">


        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                System Configuration
              </h3>

              <p className="panel-description">
                Current project software and AI configuration
              </p>

            </div>

            <span>
              LOCAL SYSTEM
            </span>

          </div>


          <div className="settings-list">


            <div className="setting-row">

              <div>

                <strong>
                  Backend Status
                </strong>

                <span>
                  FastAPI local server
                </span>

              </div>

              <span className="status-online">
                ONLINE
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Backend URL
                </strong>

                <span>
                  http://127.0.0.1:8000
                </span>

              </div>

              <span className="setting-value">
                LOCAL
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Machine Learning Model
                </strong>

                <span>
                  Random Forest Classifier
                </span>

              </div>

              <span className="status-online">
                ACTIVE
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Explainability
                </strong>

                <span>
                  SHAP TreeExplainer
                </span>

              </div>

              <span className="status-online">
                ACTIVE
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Local Language Model
                </strong>

                <span>
                  Qwen2.5-0.5B-Instruct
                </span>

              </div>

              <span className="setting-value">
                LOCAL
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Dataset
                </strong>

                <span>
                  NSL-KDD / KDDTrain+.txt
                </span>

              </div>

              <span className="setting-value">
                LOADED
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Feed Mode
                </strong>

                <span>
                  Historical dataset replay
                </span>

              </div>

              <span className="setting-value">
                SIMULATED
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Sandbox Simulation
                </strong>

                <span>
                  Category-driven effect timeline (no live attack traffic)
                </span>

              </div>

              <span className="setting-value">
                SIMULATED
              </span>

            </div>


            <div className="setting-row">

              <div>

                <strong>
                  Authentication
                </strong>

                <span>
                  Local session authentication
                </span>

              </div>

              <span className="status-online">
                ACTIVE
              </span>

            </div>

          </div>

        </div>


        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                Security Information
              </h3>

              <p className="panel-description">
                Important operating information
              </p>

            </div>

          </div>


          <div className="settings-info">

            <p>
              This application uses historical NSL-KDD
              records as a simulated live feed.
            </p>

            <p>
              Random Forest performs the threat
              classification. SHAP provides feature
              explanation.
            </p>

            <p>
              Qwen is used only to explain the ML result
              and does not replace the ML detector.
            </p>

            <p>
              The sandbox simulates what an unmitigated
              attack category typically looks like; it does
              not generate or replay real attack traffic.
            </p>

            <p>
              Authentication is designed for this local
              project/demo and is not production-grade.
            </p>

          </div>

        </div>


        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                Current Account
              </h3>

              <p className="panel-description">
                Local authenticated session
              </p>

            </div>

          </div>


          <div className="settings-account">

            <div>

              <span>
                USER
              </span>

              <strong>
                admin
              </strong>

            </div>


            <button
              className="logout-button"
              onClick={
                handleLogout
              }
            >
              LOGOUT
            </button>

          </div>

        </div>

      </section>

    );
  }


  // ========================================================
  // AI DASHBOARD
  // ========================================================

  function AIDashboard() {

    const isSandboxResult =
      aiResult &&
      aiResult.type === "sandbox";

    return (

      <section className="ai-page">


        <div className="ai-intro panel">

          <div className="panel-header">

            <div>

              <h3>
                AI Security Analyst
              </h3>

              <p className="panel-description">
                Ask questions about the current machine-learning assessment,
                or type "simulate DoS" / "simulate {'{alert id}'}" to see an
                attack sandbox
              </p>

            </div>

            <span>
              LOCAL QWEN
            </span>

          </div>


          <div className="ai-input-area">

            {selectedAlertId && (
              <div className="selected-alert-banner">

                <strong>
                  ALERT #{selectedAlertId} SELECTED
                </strong>

                <span>
                  AI analysis will use this exact ML record.
                </span>

              </div>
            )}

            <div className="question-label">
              SECURITY QUESTION
            </div>


            <textarea
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              placeholder="Ask a security question..."
              rows={5}
            />


            <div className="question-hints">

              <button
                onClick={() =>
                  setQuestion(
                    "Why was this traffic classified as an attack?"
                  )
                }
              >
                Why was this an attack?
              </button>


              <button
                onClick={() =>
                  setQuestion(
                    "What features contributed to this prediction?"
                  )
                }
              >
                What features contributed?
              </button>


              <button
                onClick={() =>
                  setQuestion(
                    "What should the network administrator do next?"
                  )
                }
              >
                What should I do next?
              </button>


              <button
                onClick={() =>
                  setQuestion(
                    selectedAlertId
                      ? `simulate ${selectedAlertId}`
                      : "simulate DoS"
                  )
                }
              >
                Simulate this threat
              </button>

            </div>


            <button
              className="analyze-button"
              onClick={
                analyzeQuestion
              }
              disabled={aiLoading}
            >

              {aiLoading
                ? "ANALYZING..."
                : "ANALYZE THREAT"}

            </button>

          </div>


          {aiError && (

            <div className="ai-error">
              {aiError}
            </div>

          )}

        </div>


        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                Attack Sandbox
              </h3>

              <p className="panel-description">
                Standalone simulation, independent of the question box above
              </p>

            </div>

            <span>
              SIMULATED
            </span>

          </div>


          <div
            className="question-hints"
            style={{ padding: "13px 15px" }}
          >

            {["DoS", "Probe", "R2L", "U2R"].map((category) => (

              <button
                key={category}
                onClick={() =>
                  runSandbox(category)
                }
                disabled={sandboxLoading}
              >
                Simulate {category}
              </button>

            ))}

            {selectedAlertId && (

              <button
                onClick={() =>
                  runSandbox(selectedAlertId)
                }
                disabled={sandboxLoading}
              >
                Simulate alert #{selectedAlertId}
              </button>

            )}

          </div>

        </div>


        {isSandboxResult && (

          <SandboxWidget
            data={aiResult.data}
            onClose={() => setAiResult(null)}
          />

        )}


        {aiResult && !isSandboxResult && (

          <div className="ai-result-grid">


            <div className="panel">

              <div className="panel-header">

                <h3>
                  ML Assessment
                </h3>

                <span>
                  SOURCE OF TRUTH
                </span>

              </div>


              <div className="ai-metrics">


                <div>

                  <span>
                    PREDICTION
                  </span>

                  <strong
                    className={
                      aiResult.prediction ===
                      "attack"
                        ? "red"
                        : "green"
                    }
                  >
                    {String(
                      aiResult.prediction
                    ).toUpperCase()}
                  </strong>

                </div>


                <div>

                  <span>
                    CONFIDENCE
                  </span>

                  <strong>
                    {aiResult.confidence}%
                  </strong>

                </div>


                <div>

                  <span>
                    ATTACK PROBABILITY
                  </span>

                  <strong>
                    {aiResult.attack_probability}%
                  </strong>

                </div>


                <div>

                  <span>
                    SEVERITY
                  </span>

                  <strong
                    className={
                      aiResult.severity ===
                      "CRITICAL"
                        ? "red"
                        : aiResult.severity ===
                          "HIGH"
                        ? "yellow"
                        : aiResult.severity ===
                          "MEDIUM"
                        ? "yellow"
                        : "green"
                    }
                  >
                    {aiResult.severity}
                  </strong>

                </div>

              </div>

            </div>


            <div className="panel">

              <div className="panel-header">

                <h3>
                  Top Contributing Features
                </h3>

                <span>
                  SHAP
                </span>

              </div>


              <div className="feature-list">

                {Object.entries(
                  aiResult.top_features ||
                  {}
                ).length === 0 ? (

                  <div className="empty-feature">
                    No attack features were returned.
                  </div>

                ) : (

                  Object.entries(
                    aiResult.top_features
                  ).map(
                    ([name, value]) => (

                      <div
                        className="feature-row"
                        key={name}
                      >

                        <span>
                          {name}
                        </span>

                        <strong>
                          {String(value)}
                        </strong>

                      </div>

                    )
                  )

                )}

              </div>

            </div>


            <div className="panel ai-answer-panel">

              <div className="panel-header">

                <div>

                  <h3>
                    AI Explanation
                  </h3>

                  <p className="panel-description">
                    Generated locally by Qwen
                  </p>

                </div>

                <span>
                  QWEN
                </span>

              </div>


              <div className="ai-answer">

                {aiResult.answer}

              </div>

            </div>


            <div className="panel action-panel">

              <div className="panel-header">

                <h3>
                  Recommended Action
                </h3>

              </div>


              <div className="action-content">

                {aiResult.prediction ===
                "attack"

                  ? "Investigate the flagged traffic and review the reported contributing features before taking containment or blocking action."

                  : "Continue monitoring the traffic. The current ML result does not indicate an attack."}

              </div>

            </div>


          </div>

        )}

      </section>

    );
  }


  // ========================================================
  // MAIN APPLICATION
  // ========================================================

  return (

    <div className="dashboard">

      <Sidebar />


      <main className="main">

        <Header />


        {page === "network" && (
          <NetworkDashboard />
        )}


        {page === "ai" && (
          <AIDashboard />
        )}


        {page === "threats" && (
          <ThreatsPage />
        )}


        {page === "settings" && (
          <SettingsPage />
        )}

      </main>

    </div>

  );
}


export default App;
