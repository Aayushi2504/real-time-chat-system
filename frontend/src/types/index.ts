export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
};

export type Conversation = {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string | null;
  title: string;
  updatedAt: string;
  unreadCount: number;
  participants: Array<{
    userId: string;
    role: string;
    user: User;
  }>;
  latestMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    sender: { id: string; name: string };
  } | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  status: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  sender: User;
};

export type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  status: string;
  readAt?: string | null;
  createdAt: string;
};
