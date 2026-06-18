/**
 * Real-infrastructure integration test: publishes an event onto a REAL Redis
 * Stream and asserts the consumer group delivers it. Runs only when
 * INTEGRATION=1 and a real REDIS_URL is provided (CI integration job), so the
 * async messaging path is exercised end-to-end rather than mocked.
 */
const RUN = process.env.INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('eventStream over real Redis', () => {
  let publishEvent;
  let startConsumer;
  let closeRedis;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    ({ publishEvent, startConsumer } = require('../../src/events/eventStream'));
    ({ closeRedis } = require('../../src/config/redis'));
  });

  afterAll(async () => {
    if (closeRedis) await closeRedis();
  });

  test('a published task.created event is consumed', async () => {
    const received = [];
    const consumer = await startConsumer(async (e) => {
      received.push(e);
    }, { consumerName: 'test-consumer' });

    const payload = { id: 'itest-1', status: 'PENDING', user_id: 'u-itest' };
    await publishEvent('task.created', payload, { actorId: 'u-itest', requestId: 'req-itest' });

    // Poll for delivery (consumer BLOCKs up to 5s per read).
    const deadline = Date.now() + 8000;
    while (received.length === 0 && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }
    consumer.stop();

    expect(received.length).toBeGreaterThan(0);
    const evt = received.find((e) => e.payload && e.payload.id === 'itest-1');
    expect(evt).toBeTruthy();
    expect(evt.type).toBe('task.created');
    expect(evt.requestId).toBe('req-itest');
  }, 15000);
});
