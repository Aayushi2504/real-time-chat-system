#!/usr/bin/env node
/**
 * Socket.IO concurrency probe (100+ connections).
 * Run from /backend after `npm install`:
 *   SOCKET_URL=http://localhost:4000 TOKEN=<jwt> node scripts/load-test-socket.mjs 120
 */
import { io as ioc } from 'socket.io-client';

const url = process.env.SOCKET_URL || 'http://localhost:4000';
const token = process.env.TOKEN;
const n = parseInt(process.argv[2] || '50', 10);

if (!token) {
  console.error('Set TOKEN env to a valid JWT');
  process.exit(1);
}

let connected = 0;
const sockets = [];

for (let i = 0; i < n; i++) {
  const s = ioc(url, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
  });
  sockets.push(s);
  s.on('connect', () => {
    connected++;
    if (connected === n) {
      console.log(`All ${n} sockets connected`);
    }
  });
  s.on('connect_error', (e) => console.error('connect_error', e.message));
}

function shutdown() {
  for (const s of sockets) {
    s.disconnect();
  }
  process.exit(0);
}

setTimeout(() => {
  console.log(`Connected: ${sockets.filter((s) => s.connected).length}/${n}`);
  shutdown();
}, 8000);

process.on('SIGINT', shutdown);
