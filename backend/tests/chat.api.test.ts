import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import { QueueJobStatus } from '@prisma/client';
import { processClaimedJob, claimNextJob } from '../src/modules/worker/jobProcessor';
import { JOB_TYPES } from '../src/modules/queue/queue.types';

const app = createApp();

describe('Chat API integration', () => {
  const emailA = `a_${Date.now()}@t.com`;
  const emailB = `b_${Date.now()}@t.com`;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;
  let convId: string | undefined;

  beforeAll(async () => {
    const hash = await bcrypt.hash('Password123!', 10);
    const ua = await prisma.user.create({
      data: { email: emailA, name: 'UserA', passwordHash: hash },
    });
    const ub = await prisma.user.create({
      data: { email: emailB, name: 'UserB', passwordHash: hash },
    });
    userAId = ua.id;
    userBId = ub.id;
  });

  afterAll(async () => {
    if (convId) {
      await prisma.message.deleteMany({ where: { conversationId: convId } });
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: convId } });
      await prisma.directConversationKey.deleteMany({ where: { conversationId: convId } });
      await prisma.conversation.delete({ where: { id: convId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  it('registers and logs in', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: `x_${Date.now()}@t.com`,
      name: 'X',
      password: 'Password123!',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);
    expect(reg.body.data.token).toBeDefined();

    const login = await request(app).post('/api/auth/login').send({
      email: emailA,
      password: 'Password123!',
    });
    expect(login.status).toBe(200);
    tokenA = login.body.data.token;

    const loginB = await request(app).post('/api/auth/login').send({
      email: emailB,
      password: 'Password123!',
    });
    tokenB = loginB.body.data.token;
  });

  it('protects /api/auth/me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('creates direct conversation', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'DIRECT', participantId: userBId });
    expect(res.status).toBe(201);
    convId = res.body.data.id;
    expect(convId).toBeDefined();
  });

  it('sends messages and paginates', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ conversationId: convId, content: `msg ${i}` });
      expect(res.status).toBe(201);
    }
    const page1 = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ limit: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.data.messages.length).toBe(2);
    expect(page1.body.data.hasMore).toBe(true);
    const cursor = page1.body.data.nextCursor;
    const page2 = await request(app)
      .get(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ limit: 10, cursor });
    expect(page2.body.data.messages.length).toBeGreaterThan(0);
  });
});

describe('Queue worker DLQ', () => {
  it('retries and moves to DLQ on forced failure', async () => {
    const u = await prisma.user.create({
      data: {
        email: `dlq_${Date.now()}@t.com`,
        name: 'DLQ',
        passwordHash: await bcrypt.hash('x', 10),
      },
    });
    const n = await prisma.notification.create({
      data: {
        userId: u.id,
        type: 'NEW_MESSAGE',
        title: 't',
        body: 'b',
        status: 'PENDING',
      },
    });
    const job = await prisma.queueJob.create({
      data: {
        type: JOB_TYPES.PROCESS_NOTIFICATION,
        payload: { notificationId: n.id, forceFail: true },
        status: QueueJobStatus.PENDING,
        maxRetries: 1,
        availableAt: new Date(),
      },
    });

    const claimed1 = await claimNextJob();
    expect(claimed1?.id).toBe(job.id);
    await processClaimedJob(claimed1!);
    let state = await prisma.queueJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(state.status).toBe(QueueJobStatus.PENDING);
    expect(state.retryCount).toBe(1);

    await prisma.queueJob.update({
      where: { id: job.id },
      data: { availableAt: new Date(Date.now() - 1000) },
    });
    const claimed2 = await claimNextJob();
    expect(claimed2?.id).toBe(job.id);
    await processClaimedJob(claimed2!);
    state = await prisma.queueJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(state.status).toBe(QueueJobStatus.FAILED);
    const dlq = await prisma.deadLetterJob.findFirst({
      where: { originalJobId: job.id },
    });
    expect(dlq).toBeTruthy();

    await prisma.deadLetterJob.deleteMany({ where: { originalJobId: job.id } });
    await prisma.queueJob.deleteMany({ where: { id: job.id } });
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }, 60_000);
});
