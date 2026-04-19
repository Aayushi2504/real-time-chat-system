import { PrismaClient, ConversationType, ParticipantRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('Password123!', 10);
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: pass,
    },
  });
  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob',
      passwordHash: pass,
    },
  });
  const carol = await prisma.user.upsert({
    where: { email: 'carol@example.com' },
    update: {},
    create: {
      email: 'carol@example.com',
      name: 'Carol',
      passwordHash: pass,
    },
  });

  const low = alice.id < bob.id ? alice.id : bob.id;
  const high = alice.id < bob.id ? bob.id : alice.id;
  const existing = await prisma.directConversationKey.findUnique({
    where: { userIdLow_userIdHigh: { userIdLow: low, userIdHigh: high } },
  });
  if (!existing) {
    const conv = await prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        createdBy: alice.id,
        participants: {
          create: [
            { userId: alice.id, role: ParticipantRole.MEMBER },
            { userId: bob.id, role: ParticipantRole.MEMBER },
          ],
        },
        directKey: {
          create: { userIdLow: low, userIdHigh: high },
        },
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: alice.id,
        content: 'Welcome to the demo chat. Try logging in as alice@example.com / Password123!',
      },
    });
  }

  const groupExists = await prisma.conversation.findFirst({
    where: { type: ConversationType.GROUP, name: 'Engineering' },
  });
  if (!groupExists) {
    await prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        name: 'Engineering',
        createdBy: alice.id,
        participants: {
          create: [
            { userId: alice.id, role: ParticipantRole.ADMIN },
            { userId: bob.id, role: ParticipantRole.MEMBER },
            { userId: carol.id, role: ParticipantRole.MEMBER },
          ],
        },
      },
    });
  }

  console.log('Seed complete. Demo users: alice@example.com, bob@example.com, carol@example.com — password: Password123!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
