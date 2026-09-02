function toInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function loadConfig(env, overrides = {}) {
  const config = {
    bookingUrl: env.BOOKING_URL || 'https://valet.amanopark.co.kr/booking',
    customerName: env.CUSTOMER_NAME || '',
    customerPhone: env.CUSTOMER_PHONE || '',
    carNumber: env.CAR_NUMBER || '',
    desiredDate: env.DESIRED_DATE || '',
    desiredTime: env.DESIRED_TIME || '',
    retryMinSec: toInt(env.RETRY_MIN_INTERVAL_SEC) ?? 40,
    retryMaxSec: toInt(env.RETRY_MAX_INTERVAL_SEC) ?? 70,
    maxAttempts: toInt(env.MAX_ATTEMPTS),
    maxRuntimeMinutes: toInt(env.MAX_RUNTIME_MINUTES),
    headless: (env.HEADLESS ?? 'true') !== 'false',
    webhookUrl: env.WEBHOOK_URL || '',
    executablePath: env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    ...overrides,
  };

  if (config.retryMinSec > config.retryMaxSec) {
    throw new Error('RETRY_MIN_INTERVAL_SEC은 RETRY_MAX_INTERVAL_SEC보다 클 수 없습니다.');
  }

  const required = ['customerName', 'customerPhone', 'carNumber', 'desiredDate'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `.env 파일에 다음 값을 채워주세요: ${missing.join(', ')} (.env.example 참고)`
    );
  }

  return config;
}

module.exports = { loadConfig };
