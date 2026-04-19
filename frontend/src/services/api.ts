import axios from 'axios';
import type { ApiResponse, Conversation, Message, NotificationRow, User } from '../types';

const baseURL =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.length > 0
    ? import.meta.env.VITE_API_URL
    : '';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('chat_token', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem('chat_token');
  }
}

const stored = localStorage.getItem('chat_token');
if (stored) {
  api.defaults.headers.common.Authorization = `Bearer ${stored}`;
}

export async function register(body: { email: string; name: string; password: string }) {
  const { data } = await api.post<ApiResponse<{ user: User; token: string }>>(
    '/api/auth/register',
    body,
  );
  return data.data;
}

export async function login(body: { email: string; password: string }) {
  const { data } = await api.post<ApiResponse<{ user: User; token: string }>>(
    '/api/auth/login',
    body,
  );
  return data.data;
}

export async function fetchMe() {
  const { data } = await api.get<ApiResponse<User>>('/api/auth/me');
  return data.data;
}

export async function searchUsers(q: string) {
  const { data } = await api.get<ApiResponse<User[]>>('/api/users/search', { params: { q } });
  return data.data;
}

export async function listUsers() {
  const { data } = await api.get<ApiResponse<User[]>>('/api/users');
  return data.data;
}

export async function listConversations() {
  const { data } = await api.get<ApiResponse<Conversation[]>>('/api/conversations');
  return data.data;
}

export async function createDirect(participantId: string) {
  const { data } = await api.post<ApiResponse<Conversation>>('/api/conversations', {
    type: 'DIRECT',
    participantId,
  });
  return data.data;
}

export async function createGroup(name: string, participantIds: string[]) {
  const { data } = await api.post<ApiResponse<Conversation>>('/api/conversations', {
    type: 'GROUP',
    name,
    participantIds,
  });
  return data.data;
}

export async function fetchMessages(conversationId: string, cursor?: string, limit = 40) {
  const { data } = await api.get<
    ApiResponse<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>
  >(`/api/conversations/${conversationId}/messages`, { params: { cursor, limit } });
  return data.data;
}

export async function sendMessage(conversationId: string, content: string) {
  const { data } = await api.post<ApiResponse<Message>>('/api/messages', {
    conversationId,
    content,
  });
  return data.data;
}

export async function markMessageRead(messageId: string) {
  await api.patch(`/api/messages/${messageId}/read`);
}

export async function markMessageDelivered(messageId: string) {
  await api.patch(`/api/messages/${messageId}/delivered`);
}

export async function listNotifications() {
  const { data } = await api.get<ApiResponse<NotificationRow[]>>('/api/notifications');
  return data.data;
}

export async function markNotificationRead(id: string) {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function enqueueTestFailure() {
  const { data } = await api.post<ApiResponse<{ notificationId: string; jobId: string }>>(
    '/api/notifications/test-failure',
    { forceFail: true },
  );
  return data.data;
}
