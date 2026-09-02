// 실제 사이트에 접속하지 않고, 로컬 가짜 예약 페이지로 재시도 로직을 확인하는 데모입니다.
// 사용법: npm run demo
const { startMockServer } = require('./mock/server');
const { runUntilSuccess } = require('./bot');

(async () => {
  const mock = await startMockServer({ succeedOnAttempt: 3 });
  console.log(`[demo] 가짜 예약 사이트: ${mock.url} (3번째 시도부터 성공)`);

  const result = await runUntilSuccess({
    bookingUrl: mock.url,
    customerName: '홍길동',
    customerPhone: '010-0000-0000',
    carNumber: '12가3456',
    desiredDate: '2026-09-10',
    desiredTime: '14:00',
    retryMinSec: 1,
    retryMaxSec: 2,
    maxAttempts: 10,
    maxRuntimeMinutes: null,
    headless: true,
    webhookUrl: '',
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
  });

  console.log('[demo] 결과:', result);
  await mock.close();
  process.exit(result.status === 'success' ? 0 : 1);
})();
