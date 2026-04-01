import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, Legend } from "recharts";

const SAMPLE_RATE = 60;
const WINDOW_SIZE = 200;
const DEFAULT_THRESHOLD = 2.8;

function generateSignal(t, hasAnomaly = false, anomalyPos = -1) {
  const base = Math.sin(2 * Math.PI * 0.05 * t) + 0.4 * Math.sin(2 * Math.PI * 0.12 * t);
  const noise = (Math.random() - 0.5) * 0.3;
  let spike = 0;
  if (hasAnomaly && Math.abs(t - anomalyPos) < 3) {
    spike = (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 1.5);
  }
  return base + noise + spike;
}

function detectAndRecover(data, threshold, recoveryEnabled) {
  if (data.length < 20) return data;
  const windowSize = 30;
  return data.map((point, i) => {
    const start = Math.max(0, i - windowSize);
    const window = data.slice(start, i + 1).map(p => p.value);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const std = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length) || 0.001;
    const zScore = Math.abs((point.value - mean) / std);
    const isAnomaly = zScore > threshold;

    // Recovery: replace anomalous value with predicted clean value (local mean)
    const recoveredValue = isAnomaly && recoveryEnabled ? mean : point.value;

    return {
      ...point,
      zScore,
      reconError: Math.abs(point.value - mean),
      isAnomaly,
      mean,
      recoveredValue,
      wasRecovered: isAnomaly && recoveryEnabled
    };
  });
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  .app {
    min-height: 100vh;
    background: #050a12;
    color: #00ff88;
    font-family: 'Share Tech Mono', monospace;
    padding: 20px;
    position: relative;
    overflow: hidden;
  }
  .app::before {
    content: '';
    position: fixed;
    inset: 0;
    background: 
      repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,255,136,0.015) 40px, rgba(0,255,136,0.015) 41px),
      repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,255,136,0.015) 40px, rgba(0,255,136,0.015) 41px);
    pointer-events: none;
    z-index: 0;
  }
  .app > * { position: relative; z-index: 1; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0,255,136,0.2);
  }
  .title-block h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #00ff88;
    text-shadow: 0 0 20px rgba(0,255,136,0.6);
  }
  .title-block p {
    font-size: 10px;
    color: rgba(0,255,136,0.4);
    letter-spacing: 3px;
    margin-top: 4px;
  }
  .status-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .status-pill {
    padding: 4px 12px;
    border-radius: 2px;
    font-size: 10px;
    letter-spacing: 2px;
    border: 1px solid;
  }
  .status-pill.active { border-color: #00ff88; color: #00ff88; background: rgba(0,255,136,0.08); animation: pulse-border 2s infinite; }
  .status-pill.anomaly { border-color: #ff3355; color: #ff3355; background: rgba(255,51,85,0.08); animation: pulse-red 0.5s infinite; }
  .status-pill.recovered { border-color: #00aaff; color: #00aaff; background: rgba(0,170,255,0.08); animation: pulse-blue 1s infinite; }
  .status-pill.clear { border-color: rgba(0,255,136,0.3); color: rgba(0,255,136,0.4); }

  @keyframes pulse-border { 0%,100%{box-shadow:0 0 0 0 rgba(0,255,136,0.3)} 50%{box-shadow:0 0 8px 2px rgba(0,255,136,0.2)} }
  @keyframes pulse-red { 0%,100%{box-shadow:0 0 8px rgba(255,51,85,0.5)} 50%{box-shadow:0 0 20px rgba(255,51,85,0.8)} }
  @keyframes pulse-blue { 0%,100%{box-shadow:0 0 8px rgba(0,170,255,0.5)} 50%{box-shadow:0 0 16px rgba(0,170,255,0.7)} }

  .main-grid { display: grid; grid-template-columns: 1fr 260px; gap: 16px; }
  .panel {
    background: rgba(0,255,136,0.03);
    border: 1px solid rgba(0,255,136,0.15);
    border-radius: 4px;
    padding: 16px;
  }
  .panel-label {
    font-size: 9px;
    letter-spacing: 3px;
    color: rgba(0,255,136,0.4);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-label::after { content:''; flex:1; height:1px; background:rgba(0,255,136,0.1); }
  .chart-wrapper { height: 200px; margin-bottom: 16px; }
  .chart-wrapper-sm { height: 120px; }

  .stats-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .stat-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(0,255,136,0.1); border-radius: 2px; padding: 12px; }
  .stat-label { font-size: 9px; color: rgba(0,255,136,0.4); letter-spacing: 2px; margin-bottom: 6px; }
  .stat-value { font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 700; color: #00ff88; }
  .stat-value.danger { color: #ff3355; text-shadow: 0 0 10px rgba(255,51,85,0.5); }
  .stat-value.warning { color: #ffaa00; }
  .stat-value.info { color: #00aaff; text-shadow: 0 0 10px rgba(0,170,255,0.5); }
  .stat-bar-track { height: 3px; background: rgba(0,255,136,0.1); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .stat-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }

  .controls { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .btn { padding: 10px 14px; border: 1px solid; border-radius: 2px; font-family: 'Share Tech Mono', monospace; font-size: 11px; letter-spacing: 2px; cursor: pointer; transition: all 0.15s; text-transform: uppercase; }
  .btn-primary { border-color: #00ff88; color: #00ff88; background: rgba(0,255,136,0.05); }
  .btn-primary:hover { background: rgba(0,255,136,0.15); box-shadow: 0 0 12px rgba(0,255,136,0.3); }
  .btn-danger { border-color: #ff3355; color: #ff3355; background: rgba(255,51,85,0.05); }
  .btn-danger:hover { background: rgba(255,51,85,0.15); box-shadow: 0 0 12px rgba(255,51,85,0.3); }
  .btn-secondary { border-color: rgba(0,255,136,0.25); color: rgba(0,255,136,0.5); background: transparent; }
  .btn-secondary:hover { border-color: rgba(0,255,136,0.5); color: rgba(0,255,136,0.8); }
  .btn-recovery-on { border-color: #00aaff; color: #00aaff; background: rgba(0,170,255,0.1); box-shadow: 0 0 10px rgba(0,170,255,0.2); }
  .btn-recovery-on:hover { background: rgba(0,170,255,0.2); }
  .btn-recovery-off { border-color: rgba(0,170,255,0.3); color: rgba(0,170,255,0.4); background: transparent; }
  .btn-recovery-off:hover { border-color: rgba(0,170,255,0.6); color: rgba(0,170,255,0.7); }

  .log-box { background: rgba(0,0,0,0.4); border: 1px solid rgba(0,255,136,0.1); border-radius: 2px; padding: 10px; height: 110px; overflow-y: auto; font-size: 10px; line-height: 1.8; }
  .log-box::-webkit-scrollbar { width: 3px; }
  .log-box::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); }
  .log-entry { color: rgba(0,255,136,0.5); }
  .log-entry.alert { color: #ff3355; }
  .log-entry.warn { color: #ffaa00; }
  .log-entry.recovery { color: #00aaff; }

  .threshold-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .threshold-label { font-size: 9px; color: rgba(0,255,136,0.4); letter-spacing: 1px; white-space: nowrap; }
  input[type="range"] { flex: 1; accent-color: #00ff88; cursor: pointer; }
  .threshold-val { font-size: 11px; color: #ffaa00; min-width: 28px; text-align: right; }

  .legend-row { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 9px; color: rgba(0,255,136,0.5); letter-spacing: 1px; }
  .legend-dot { width: 20px; height: 2px; border-radius: 2px; }

  .recovery-banner {
    background: rgba(0,170,255,0.05);
    border: 1px solid rgba(0,170,255,0.2);
    border-radius: 2px;
    padding: 8px 12px;
    font-size: 9px;
    color: rgba(0,170,255,0.7);
    letter-spacing: 1px;
    margin-bottom: 12px;
    line-height: 1.7;
  }

  .scan-line { position: fixed; top:0; left:0; right:0; height:2px; background: linear-gradient(90deg,transparent,rgba(0,255,136,0.15),transparent); animation: scan 4s linear infinite; pointer-events:none; z-index:100; }
  @keyframes scan { 0%{top:0} 100%{top:100vh} }
  .anomaly-count-badge { display:inline-block; background:rgba(255,51,85,0.15); border:1px solid rgba(255,51,85,0.4); color:#ff3355; border-radius:2px; padding:2px 8px; font-size:10px; letter-spacing:1px; margin-left:8px; }
  .recovery-count-badge { display:inline-block; background:rgba(0,170,255,0.15); border:1px solid rgba(0,170,255,0.4); color:#00aaff; border-radius:2px; padding:2px 8px; font-size:10px; letter-spacing:1px; margin-left:4px; }
`;

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: '#050a12', border: '1px solid rgba(0,255,136,0.3)', padding: '8px 12px', fontSize: 11, fontFamily: 'Share Tech Mono' }}>
      <div style={{ color: d?.isAnomaly ? '#ff3355' : '#00ff88' }}>RAW: {d?.value?.toFixed(3)}</div>
      {d?.wasRecovered && <div style={{ color: '#00aaff' }}>RECOVERED: {d?.recoveredValue?.toFixed(3)}</div>}
      {d?.zScore != null && <div style={{ color: '#ffaa00' }}>Z: {d.zScore.toFixed(2)}</div>}
      {d?.isAnomaly && !d?.wasRecovered && <div style={{ color: '#ff3355' }}>⚠ ANOMALY</div>}
      {d?.wasRecovered && <div style={{ color: '#00aaff' }}>✓ RECOVERED</div>}
    </div>
  );
};

export default function App() {
  const [data, setData] = useState([]);
  const [running, setRunning] = useState(true);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [logs, setLogs] = useState([{ msg: "SYSTEM INIT — monitoring active", type: "normal" }]);
  const [totalAnomalies, setTotalAnomalies] = useState(0);
  const [totalRecovered, setTotalRecovered] = useState(0);
  const tRef = useRef(0);
  const anomalyScheduled = useRef(-999);
  const intervalRef = useRef(null);
  const prevRecovery = useRef(false);

  const addLog = useCallback((msg, type = "normal") => {
    setLogs(prev => [...prev.slice(-40), { msg, type }]);
  }, []);

  // Log when recovery mode changes
  useEffect(() => {
    if (prevRecovery.current !== recoveryEnabled) {
      if (recoveryEnabled) addLog("AUTO-RECOVERY ENABLED — anomalies will be corrected", "recovery");
      else addLog("AUTO-RECOVERY DISABLED — detection only mode", "warn");
      prevRecovery.current = recoveryEnabled;
    }
  }, [recoveryEnabled, addLog]);

  const tick = useCallback(() => {
    tRef.current += 1;
    const t = tRef.current;
    const hasAnomaly = anomalyScheduled.current > 0;
    const val = generateSignal(t, hasAnomaly, anomalyScheduled.current);
    if (hasAnomaly) anomalyScheduled.current -= 1;

    setData(prev => {
      const raw = [...prev, { t, value: val }].slice(-WINDOW_SIZE);
      const processed = detectAndRecover(raw, threshold, recoveryEnabled);
      const last = processed[processed.length - 1];

      if (last?.isAnomaly) {
        setTotalAnomalies(c => c + 1);
        if (recoveryEnabled) {
          setTotalRecovered(c => c + 1);
          addLog(`T=${t} ANOMALY DETECTED → RECOVERED (Z=${last.zScore.toFixed(2)})`, "recovery");
        } else {
          addLog(`T=${t} ANOMALY DETECTED — Z=${last.zScore.toFixed(2)}`, "alert");
        }
      }
      return processed;
    });
  }, [threshold, recoveryEnabled, addLog]);

  useEffect(() => {
    if (running) intervalRef.current = setInterval(tick, 1000 / SAMPLE_RATE);
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  const injectAnomaly = () => {
    anomalyScheduled.current = 8;
    addLog(`T=${tRef.current} Manual anomaly injected`, "warn");
  };

  const reset = () => {
    setData([]);
    setTotalAnomalies(0);
    setTotalRecovered(0);
    tRef.current = 0;
    setLogs([{ msg: "SYSTEM RESET — baseline cleared", type: "normal" }]);
  };

  const lastPoint = data[data.length - 1];
  const anomalyNow = lastPoint?.isAnomaly;
  const recoveredNow = anomalyNow && recoveryEnabled;
  const anomalyRate = data.length > 0 ? (data.filter(d => d.isAnomaly).length / data.length * 100) : 0;
  const recoveryRate = totalAnomalies > 0 ? (totalRecovered / totalAnomalies * 100) : 0;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="scan-line" />
        <div className="header">
          <div className="title-block">
            <h1>RF ANOMALY DETECTOR</h1>
            <p>SIGNAL INTELLIGENCE + RECOVERY SYSTEM — ECE SIDE PROJECT v2.0</p>
          </div>
          <div className="status-row">
            <div className={`status-pill ${running ? 'active' : 'clear'}`}>{running ? '● LIVE' : '■ PAUSED'}</div>
            <div className={`status-pill ${recoveredNow ? 'recovered' : anomalyNow ? 'anomaly' : 'clear'}`}>
              {recoveredNow ? '✓ RECOVERED' : anomalyNow ? '⚠ ANOMALY' : '✓ NOMINAL'}
            </div>
            <div className={`status-pill ${recoveryEnabled ? 'recovered' : 'clear'}`}>
              {recoveryEnabled ? '🔧 AUTO-RECOVER ON' : '🔧 DETECT ONLY'}
            </div>
          </div>
        </div>

        <div className="main-grid">
          <div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-label">
                SIGNAL WAVEFORM
                {totalAnomalies > 0 && <span className="anomaly-count-badge">{totalAnomalies} ANOMALIES</span>}
                {totalRecovered > 0 && <span className="recovery-count-badge">{totalRecovered} RECOVERED</span>}
              </div>

              {recoveryEnabled && (
                <div className="legend-row">
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#00ff88' }} />RAW SIGNAL</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#00aaff' }} />RECOVERED SIGNAL</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#ff3355', borderRadius: '50%', width: 8, height: 8 }} />ANOMALY POINT</div>
                </div>
              )}

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis domain={[-4.5, 4.5]} tick={{ fill: 'rgba(0,255,136,0.3)', fontSize: 9 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(0,255,136,0.1)" />
                    {/* Raw signal */}
                    <Line type="monotone" dataKey="value" stroke="#00ff88" strokeWidth={recoveryEnabled ? 1 : 1.5}
                      strokeOpacity={recoveryEnabled ? 0.35 : 1}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (!payload.isAnomaly) return null;
                        return <circle key={`a-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#ff3355" stroke="none" opacity={0.9} />;
                      }}
                      isAnimationActive={false} />
                    {/* Recovered signal — only shown when recovery is on */}
                    {recoveryEnabled && (
                      <Line type="monotone" dataKey="recoveredValue" stroke="#00aaff" strokeWidth={2}
                        dot={false} isAnimationActive={false} />
                    )}
                    <Line type="monotone" dataKey="mean" stroke="rgba(0,255,136,0.15)" strokeWidth={1} dot={false} isAnimationActive={false} strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="panel-label">Z-SCORE (RECONSTRUCTION ERROR)</div>
              <div className="chart-wrapper-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={{ fill: 'rgba(0,255,136,0.3)', fontSize: 9 }} domain={[0, 'auto']} />
                    <ReferenceLine y={threshold} stroke="rgba(255,51,85,0.4)" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="zScore" stroke="#ffaa00" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="threshold-row">
                <span className="threshold-label">THRESHOLD</span>
                <input type="range" min="1.5" max="5" step="0.1" value={threshold} onChange={e => setThreshold(parseFloat(e.target.value))} />
                <span className="threshold-val">{threshold.toFixed(1)}σ</span>
              </div>
            </div>

            <div className="panel">
              <div className="panel-label">EVENT LOG</div>
              <div className="log-box">
                {[...logs].reverse().map((l, i) => (
                  <div key={i} className={`log-entry ${l.type}`}>&gt; {l.msg}</div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel">
              <div className="panel-label">METRICS</div>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-label">CURRENT VALUE</div>
                  <div className={`stat-value ${anomalyNow && !recoveryEnabled ? 'danger' : recoveredNow ? 'info' : ''}`}>
                    {lastPoint ? (lastPoint.value >= 0 ? '+' : '') + lastPoint.value.toFixed(3) : '—'}
                  </div>
                  {recoveredNow && (
                    <div style={{ fontSize: 10, color: '#00aaff', marginTop: 4 }}>
                      RECOVERED → {lastPoint?.recoveredValue?.toFixed(3)}
                    </div>
                  )}
                </div>
                <div className="stat-box">
                  <div className="stat-label">Z-SCORE</div>
                  <div className={`stat-value ${lastPoint?.zScore > threshold ? 'danger' : lastPoint?.zScore > threshold * 0.7 ? 'warning' : ''}`}>
                    {lastPoint?.zScore?.toFixed(2) ?? '—'}
                  </div>
                  <div className="stat-bar-track">
                    <div className="stat-bar-fill" style={{ width: `${Math.min(100, ((lastPoint?.zScore || 0) / 5) * 100)}%`, background: (lastPoint?.zScore || 0) > threshold ? '#ff3355' : '#00ff88' }} />
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">ANOMALY RATE</div>
                  <div className={`stat-value ${anomalyRate > 10 ? 'danger' : anomalyRate > 5 ? 'warning' : ''}`}>
                    {anomalyRate.toFixed(1)}%
                  </div>
                </div>
                {recoveryEnabled && (
                  <div className="stat-box">
                    <div className="stat-label">RECOVERY RATE</div>
                    <div className="stat-value info">{recoveryRate.toFixed(0)}%</div>
                    <div className="stat-bar-track">
                      <div className="stat-bar-fill" style={{ width: `${recoveryRate}%`, background: '#00aaff' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-label">CONTROLS</div>
              <div className="controls">
                <button className={`btn ${running ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setRunning(r => !r)}>
                  {running ? '■ PAUSE' : '▶ RESUME'}
                </button>
                <button className="btn btn-danger" onClick={injectAnomaly}>⚡ INJECT ANOMALY</button>
                <button
                  className={`btn ${recoveryEnabled ? 'btn-recovery-on' : 'btn-recovery-off'}`}
                  onClick={() => setRecoveryEnabled(r => !r)}>
                  {recoveryEnabled ? '🔧 RECOVERY: ON' : '🔧 RECOVERY: OFF'}
                </button>
                <button className="btn btn-secondary" onClick={reset}>↺ RESET</button>
              </div>
            </div>

            <div className="panel" style={{ fontSize: 9, color: 'rgba(0,255,136,0.3)', lineHeight: 2, letterSpacing: 1 }}>
              <div className="panel-label">HOW RECOVERY WORKS</div>
              <div style={{ color: 'rgba(0,255,136,0.4)' }}>
                When an anomaly is detected, the corrupted signal value is replaced with the predicted clean value (local mean).
              </div>
              <br />
              <div>RAW SIGNAL → Z-SCORE CHECK → ANOMALY? → REPLACE WITH MEAN → CLEAN OUTPUT</div>
              <br />
              <div style={{ color: 'rgba(0,170,255,0.5)', marginTop: 4 }}>v2.0 — Detection + Recovery</div>
              <div style={{ color: 'rgba(0,255,136,0.3)' }}>IEEE Hackathon 2026 — AMD Artix-7</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
