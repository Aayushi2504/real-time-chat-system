export type MessageCursor = { createdAt: Date; id: string };

export function encodeMessageCursor(c: MessageCursor): string {
  return Buffer.from(
    JSON.stringify({ t: c.createdAt.toISOString(), id: c.id }),
    'utf-8',
  ).toString('base64url');
}

export function decodeMessageCursor(raw: string): MessageCursor {
  const j = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as {
    t: string;
    id: string;
  };
  return { createdAt: new Date(j.t), id: j.id };
}
