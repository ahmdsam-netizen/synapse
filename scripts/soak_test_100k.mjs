/**
 * Synapse 100k Soak & Load Test Runner
 *
 * Simulates real user traffic sending 100,000 requests over 1 hour (or configurable
 * duration and count) across heterogeneous API endpoints and real-time Socket.IO chat.
 *
 * Usage:
 *   node soak_test_100k.mjs
 *
 * Fast Dry-Run (e.g. 500 requests in 15 seconds):
 *   TOTAL_REQUESTS=500 DURATION_SEC=15 node soak_test_100k.mjs
 *
 * Full 1-Hour Soak Test (100k requests over 3600 seconds):
 *   TOTAL_REQUESTS=100000 DURATION_SEC=3600 node soak_test_100k.mjs
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Resolve project root and imports
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Dynamic module imports matching project layout
let io;
let jwt;

try {
  const socketModule = await import(path.join(rootDir, 'client/node_modules/socket.io-client/build/esm/index.js'));
  io = socketModule.io;
} catch {
  try {
    const socketModule = await import('socket.io-client');
    io = socketModule.io;
  } catch (err) {
    console.warn('[Warning] socket.io-client not loaded; WebSocket chat tests will be simulated or skipped.');
  }
}

try {
  const jwtModule = await import(path.join(rootDir, 'gateway/node_modules/jsonwebtoken/index.js'));
  jwt = jwtModule.default || jwtModule;
} catch {
  try {
    const jwtModule = await import('jsonwebtoken');
    jwt = jwtModule.default || jwtModule;
  } catch (err) {
    console.warn('[Warning] jsonwebtoken not loaded.');
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3001';
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '100000', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '3600', 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '30', 10);
const REPORT_FILE = process.env.REPORT_FILE || path.join(__dirname, 'soak_test_report.json');

// User Authentication Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-characters-dev-key';
const USER_ID = process.env.USER_ID || '34b6dc5b-5ed7-47f8-b6aa-9d895956ef53';
const USER_EMAIL = process.env.USER_EMAIL || 'alex@iitb.ac.in';
const USER_COLLEGE_ID = process.env.USER_COLLEGE_ID || '11111111-1111-1111-1111-111111111111';
const TEST_GROUP_ID = process.env.GROUP_ID || '410755c0-5cc5-4a8e-868d-17519d1f09e4';

// Rate pacing math
const TARGET_RPS = TOTAL_REQUESTS / DURATION_SEC;
const INTERVAL_MS = 1000 / TARGET_RPS;

// Generate valid JWT token for the authenticated user session
let authToken = '';
if (jwt) {
  authToken = jwt.sign(
    {
      id: USER_ID,
      email: USER_EMAIL,
      collegeId: USER_COLLEGE_ID,
      name: 'Alex Sharma'
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}

// HTTP Connection Pooling Agent
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: MAX_CONCURRENCY * 2,
  maxFreeSockets: MAX_CONCURRENCY,
  timeout: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: MAX_CONCURRENCY * 2,
  maxFreeSockets: MAX_CONCURRENCY,
  timeout: 30000
});

// ---------------------------------------------------------------------------
// Workload Endpoints Definition with Probability Weights
// ---------------------------------------------------------------------------
const ENDPOINTS = [
  {
    name: 'Gateway Health',
    type: 'http',
    method: 'GET',
    path: '/api/health',
    auth: false,
    weight: 5
  },
  {
    name: 'Chat Node Health',
    type: 'http',
    method: 'GET',
    path: '/api/chat/health',
    auth: false,
    weight: 5
  },
  {
    name: 'Current User Profile',
    type: 'http',
    method: 'GET',
    path: '/api/users/me',
    auth: true,
    weight: 15
  },
  {
    name: 'Taxonomy Skills Search',
    type: 'http',
    method: 'GET',
    path: '/api/users/skills?query=React',
    auth: true,
    weight: 10
  },
  {
    name: 'Vector Similarity Recommendations',
    type: 'http',
    method: 'GET',
    path: '/api/recommendations/similarity?limit=15',
    auth: true,
    weight: 15
  },
  {
    name: 'Peer Connections Graph',
    type: 'http',
    method: 'GET',
    path: '/api/connections',
    auth: true,
    weight: 10
  },
  {
    name: 'Active Groups Listing',
    type: 'http',
    method: 'GET',
    path: '/api/groups',
    auth: true,
    weight: 10
  },
  {
    name: 'Collaboration Boards',
    type: 'http',
    method: 'GET',
    path: '/api/boards',
    auth: true,
    weight: 10
  },
  {
    name: 'Full-Text Search',
    type: 'http',
    method: 'GET',
    path: '/api/search?q=machine+learning',
    auth: true,
    weight: 10
  },
  {
    name: 'Chat Message History (REST)',
    type: 'http',
    method: 'GET',
    path: `/api/chat/groups/${TEST_GROUP_ID}/messages?limit=25`,
    auth: true,
    weight: 5
  },
  {
    name: 'Real-Time WebSocket Message Emit',
    type: 'socket_message',
    weight: 5
  }
];

// Build weighted selector table
const WEIGHTED_ENDPOINTS = [];
for (const ep of ENDPOINTS) {
  for (let i = 0; i < ep.weight; i++) {
    WEIGHTED_ENDPOINTS.push(ep);
  }
}

// ---------------------------------------------------------------------------
// Telemetry & Metrics Aggregator
// ---------------------------------------------------------------------------
class MetricsCollector {
  constructor() {
    this.totalSent = 0;
    this.totalCompleted = 0;
    this.totalSuccess = 0;
    this.totalErrors = 0;
    this.statusCodes = {};
    this.errorTypes = {};
    this.latencies = []; // Array of response times (ms)
    this.endpointStats = {};

    for (const ep of ENDPOINTS) {
      this.endpointStats[ep.name] = {
        sent: 0,
        success: 0,
        errors: 0,
        latencies: []
      };
    }

    this.wsConnected = false;
    this.wsRoundTrips = [];
    this.startTime = Date.now();
  }

  record(name, latency, success, statusCode = null, errorMsg = null) {
    this.totalCompleted++;
    this.latencies.push(latency);

    const ep = this.endpointStats[name] || { sent: 0, success: 0, errors: 0, latencies: [] };
    ep.latencies.push(latency);

    if (success) {
      this.totalSuccess++;
      ep.success++;
    } else {
      this.totalErrors++;
      ep.errors++;
      const errKey = errorMsg || `HTTP_${statusCode || 'UNKNOWN'}`;
      this.errorTypes[errKey] = (this.errorTypes[errKey] || 0) + 1;
    }

    if (statusCode) {
      this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;
    }
  }

  calcPercentiles(arr) {
    if (!arr || arr.length === 0) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const getP = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    return {
      min: Math.round(sorted[0]),
      p50: Math.round(getP(50)),
      p90: Math.round(getP(90)),
      p95: Math.round(getP(95)),
      p99: Math.round(getP(99)),
      max: Math.round(sorted[sorted.length - 1]),
      avg: Math.round(sum / sorted.length)
    };
  }

  getSnapshot() {
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const currentRps = elapsedSec > 0 ? (this.totalCompleted / elapsedSec).toFixed(1) : 0;
    const overallPerc = this.calcPercentiles(this.latencies);

    return {
      elapsedSec: Math.round(elapsedSec),
      currentRps,
      totalSent: this.totalSent,
      totalCompleted: this.totalCompleted,
      totalSuccess: this.totalSuccess,
      totalErrors: this.totalErrors,
      errorRate: this.totalCompleted > 0 ? ((this.totalErrors / this.totalCompleted) * 100).toFixed(2) + '%' : '0.00%',
      overallPerc,
      statusCodes: { ...this.statusCodes },
      errorTypes: { ...this.errorTypes }
    };
  }
}

const metrics = new MetricsCollector();

// ---------------------------------------------------------------------------
// Docker Resource Monitor (Baseline & Drift)
// ---------------------------------------------------------------------------
const getDockerStats = () => {
  try {
    const raw = execSync(
      'docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"',
      { stdio: ['pipe', 'pipe', 'ignore'] }
    ).toString();
    const lines = raw.trim().split('\n').filter(Boolean);
    const result = {};
    for (const l of lines) {
      const [name, cpu, mem] = l.split('\t');
      if (name && (name.includes('synapse-') || name.includes('gateway') || name.includes('chat') || name.includes('core'))) {
        result[name] = { cpu: cpu.trim(), mem: mem.trim() };
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// WebSocket Client Setup (Real-Time Chat & Pub/Sub)
// ---------------------------------------------------------------------------
let chatSocket = null;
let socketConnected = false;

const initWebSocket = () => {
  if (!io) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      chatSocket = io(TARGET_URL, {
        auth: { token: authToken },
        query: { userId: USER_ID, token: authToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      chatSocket.on('connect', () => {
        socketConnected = true;
        metrics.wsConnected = true;
        // Join test group room
        chatSocket.emit('join_group', { groupId: TEST_GROUP_ID }, (ack) => {
          resolve(true);
        });
      });

      chatSocket.on('connect_error', (err) => {
        metrics.record('WebSocket Connection', 0, false, null, `WS_CONN_ERR: ${err.message}`);
        resolve(false);
      });

      chatSocket.on('disconnect', () => {
        socketConnected = false;
      });

      // Listen for message echo / roundtrip
      chatSocket.on('new_message', (msg) => {
        if (msg?.content?.startsWith('SOAK_PROBE:')) {
          const sentAt = parseInt(msg.content.split(':')[1], 10);
          if (!isNaN(sentAt)) {
            const rtt = Date.now() - sentAt;
            metrics.wsRoundTrips.push(rtt);
          }
        }
      });
    } catch (err) {
      resolve(false);
    }
  });
};

// ---------------------------------------------------------------------------
// Request Dispatcher: HTTP vs WebSocket
// ---------------------------------------------------------------------------
const sendHttpRequest = async (endpoint) => {
  const url = `${TARGET_URL}${endpoint.path}`;
  const headers = {
    'Accept': 'application/json',
    'Connection': 'keep-alive'
  };

  if (endpoint.auth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: endpoint.method,
      headers,
      agent: url.startsWith('https') ? httpsAgent : httpAgent,
      signal: AbortSignal.timeout(15000)
    });

    const latency = Date.now() - start;
    const isSuccess = res.status >= 200 && res.status < 400;

    // Read small portion or drain stream
    await res.arrayBuffer().catch(() => {});

    metrics.record(endpoint.name, latency, isSuccess, res.status);
  } catch (err) {
    const latency = Date.now() - start;
    metrics.record(endpoint.name, latency, false, null, err.name === 'TimeoutError' ? 'TIMEOUT' : err.code || err.message);
  }
};

const sendWebSocketMessage = async () => {
  if (!chatSocket || !socketConnected) {
    metrics.record('Real-Time WebSocket Message Emit', 0, false, null, 'WS_NOT_CONNECTED');
    return;
  }

  const start = Date.now();
  const probeContent = `SOAK_PROBE:${start}:${Math.random().toString(36).substring(7)}`;

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const latency = Date.now() - start;
        metrics.record('Real-Time WebSocket Message Emit', latency, false, null, 'WS_ACK_TIMEOUT');
        resolve();
      }
    }, 5000);

    chatSocket.emit('send_message', { groupId: TEST_GROUP_ID, content: probeContent }, (ack) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        const isSuccess = ack && ack.success === true;
        metrics.record(
          'Real-Time WebSocket Message Emit',
          latency,
          isSuccess,
          isSuccess ? 200 : 400,
          isSuccess ? null : ack?.error || 'WS_ACK_REJECTED'
        );
        resolve();
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Real-Time Progress Dashboard
// ---------------------------------------------------------------------------
const renderDashboard = () => {
  const snap = metrics.getSnapshot();
  const pct = Math.min(100, ((snap.totalCompleted / TOTAL_REQUESTS) * 100)).toFixed(1);
  const remainingSec = Math.max(0, Math.round(DURATION_SEC - snap.elapsedSec));
  const minLeft = Math.floor(remainingSec / 60);
  const secLeft = remainingSec % 60;

  console.clear();
  console.log('================================================================================');
  console.log('                 SYNAPSE 100,000 REQUESTS SOAK TEST DASHBOARD                  ');
  console.log('================================================================================');
  console.log(`Target Gateway   : ${TARGET_URL}`);
  console.log(`Simulated User   : ${USER_EMAIL} (${USER_ID})`);
  console.log(`Progress         : ${snap.totalCompleted.toLocaleString()} / ${TOTAL_REQUESTS.toLocaleString()} requests [${pct}%]`);
  console.log(`Elapsed Time     : ${Math.floor(snap.elapsedSec / 60)}m ${snap.elapsedSec % 60}s | Remaining: ${minLeft}m ${secLeft}s`);
  console.log(`Throughput       : ${snap.currentRps} req/sec (Target: ~${TARGET_RPS.toFixed(1)} req/sec)`);
  console.log(`Success / Errors : ${snap.totalSuccess.toLocaleString()} OK | ${snap.totalErrors.toLocaleString()} Errors (${snap.errorRate})`);
  console.log(`WebSocket Status : ${socketConnected ? 'Connected & Joined' : 'Disconnected / Degraded'}`);
  console.log('--------------------------------------------------------------------------------');
  console.log('Latency Percentiles (Aggregated):');
  console.log(`  Min: ${snap.overallPerc.min}ms | p50: ${snap.overallPerc.p50}ms | p90: ${snap.overallPerc.p90}ms | p95: ${snap.overallPerc.p95}ms | p99: ${snap.overallPerc.p99}ms | Max: ${snap.overallPerc.max}ms`);
  console.log('--------------------------------------------------------------------------------');
  console.log('Top Endpoints Distribution:');

  const epEntries = Object.entries(metrics.endpointStats);
  for (const [name, stats] of epEntries) {
    const epPerc = metrics.calcPercentiles(stats.latencies);
    const errCount = stats.errors > 0 ? `(${stats.errors} err)` : '';
    console.log(
      `  ${name.padEnd(35)}: ${stats.latencies.length.toString().padStart(6)} reqs | p50: ${epPerc.p50.toString().padStart(4)}ms | p95: ${epPerc.p95.toString().padStart(4)}ms ${errCount}`
    );
  }

  if (Object.keys(snap.errorTypes).length > 0) {
    console.log('--------------------------------------------------------------------------------');
    console.log('Observed Errors Breakdown:');
    for (const [code, count] of Object.entries(snap.errorTypes).slice(0, 5)) {
      console.log(`  ${code.padEnd(30)}: ${count} occurrences`);
    }
  }

  const dockerStats = getDockerStats();
  if (dockerStats) {
    console.log('--------------------------------------------------------------------------------');
    console.log('Docker Container Resource Drift:');
    for (const [cName, s] of Object.entries(dockerStats)) {
      console.log(`  ${cName.padEnd(25)}: CPU ${s.cpu.padEnd(8)} | RAM ${s.mem}`);
    }
  }

  console.log('================================================================================');
  console.log('Press [Ctrl+C] at any time to abort early and write the comprehensive summary report.\n');
};

// ---------------------------------------------------------------------------
// Final Report Export
// ---------------------------------------------------------------------------
const exportFinalReport = (reason = 'COMPLETED') => {
  const snap = metrics.getSnapshot();
  const report = {
    testStatus: reason,
    timestamp: new Date().toISOString(),
    config: {
      targetUrl: TARGET_URL,
      totalRequestsPlanned: TOTAL_REQUESTS,
      durationTargetSec: DURATION_SEC,
      actualDurationSec: snap.elapsedSec,
      targetRps: TARGET_RPS,
      actualRps: parseFloat(snap.currentRps),
      user: USER_EMAIL
    },
    metricsSummary: {
      totalSent: snap.totalSent,
      totalCompleted: snap.totalCompleted,
      totalSuccess: snap.totalSuccess,
      totalErrors: snap.totalErrors,
      errorRate: snap.errorRate,
      statusCodes: snap.statusCodes,
      errorTypes: snap.errorTypes
    },
    latencyOverallMs: snap.overallPerc,
    endpoints: {},
    webSocketRoundTripsMs: metrics.calcPercentiles(metrics.wsRoundTrips),
    dockerResourceSnapshot: getDockerStats()
  };

  for (const [name, stats] of Object.entries(metrics.endpointStats)) {
    report.endpoints[name] = {
      totalRequests: stats.latencies.length,
      successCount: stats.success,
      errorCount: stats.errors,
      latency: metrics.calcPercentiles(stats.latencies)
    };
  }

  try {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`\n[Report Generated] Full JSON analysis written to: ${REPORT_FILE}`);
  } catch (err) {
    console.error(`Failed to write report file: ${err.message}`);
  }

  return report;
};

// ---------------------------------------------------------------------------
// Main Orchestration Loop
// ---------------------------------------------------------------------------
let isShuttingDown = false;

const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[${signal}] Stopping test runner, generating final audit report...`);
  if (chatSocket) chatSocket.disconnect();
  exportFinalReport(`ABORTED_${signal}`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main() {
  console.log('================================================================================');
  console.log('                   SYNAPSE 100k MULTI-ENDPOINT SOAK TEST                        ');
  console.log('================================================================================');
  console.log(`Target Gateway : ${TARGET_URL}`);
  console.log(`Planned Load   : ${TOTAL_REQUESTS.toLocaleString()} requests over ${DURATION_SEC} seconds (${(DURATION_SEC / 60).toFixed(0)} min)`);
  console.log(`Average Pacing : ~${TARGET_RPS.toFixed(2)} req/sec (~1 request every ${INTERVAL_MS.toFixed(1)}ms)`);
  console.log(`Simulated User : ${USER_EMAIL} (Token: ${authToken ? 'Signed' : 'Anonymous'})`);
  console.log(`Concurrencies  : Dynamic pool up to ${MAX_CONCURRENCY} active requests`);
  console.log('--------------------------------------------------------------------------------\n');

  console.log('[1/2] Connecting WebSocket client for real-time chat testing...');
  const wsReady = await initWebSocket();
  console.log(`      WebSocket Status: ${wsReady ? 'Connected and joined group' : 'Unavailable (HTTP will continue)'}\n`);

  console.log('[2/2] Starting request generator loop...\n');

  let activeInFlight = 0;
  const dashboardInterval = setInterval(renderDashboard, 3000);

  const startTime = Date.now();
  const targetEndTime = startTime + (DURATION_SEC * 1000);

  while (metrics.totalSent < TOTAL_REQUESTS && Date.now() < targetEndTime && !isShuttingDown) {
    // Check concurrency throttle
    if (activeInFlight >= MAX_CONCURRENCY) {
      await new Promise((r) => setTimeout(r, 5));
      continue;
    }

    // Pick random weighted endpoint
    const endpoint = WEIGHTED_ENDPOINTS[Math.floor(Math.random() * WEIGHTED_ENDPOINTS.length)];

    metrics.totalSent++;
    activeInFlight++;

    // Fire request asynchronously without blocking the loop
    (async () => {
      try {
        if (endpoint.type === 'socket_message') {
          await sendWebSocketMessage();
        } else {
          await sendHttpRequest(endpoint);
        }
      } finally {
        activeInFlight--;
      }
    })();

    // Precision pacing to sustain desired requests/second
    const expectedElapsed = (metrics.totalSent / TARGET_RPS) * 1000;
    const actualElapsed = Date.now() - startTime;
    const delay = expectedElapsed - actualElapsed;

    if (delay > 0) {
      await new Promise((r) => setTimeout(r, Math.min(delay, 100)));
    }
  }

  // Wait for all in-flight requests to complete
  while (activeInFlight > 0) {
    await new Promise((r) => setTimeout(r, 50));
  }

  clearInterval(dashboardInterval);
  renderDashboard();

  if (chatSocket) chatSocket.disconnect();

  console.log('\n================================================================================');
  console.log('                          SOAK TEST RUN FINISHED                                ');
  console.log('================================================================================');
  exportFinalReport('COMPLETED');
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
