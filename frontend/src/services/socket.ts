import { io, Socket } from 'socket.io-client';

const url =
  import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.length > 0
    ? import.meta.env.VITE_SOCKET_URL
    : undefined;

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  disconnectSocket();
  socket = io(url || window.location.origin, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
