const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'booking-bot.log');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // 로그 파일 기록 실패는 무시하고 콘솔 출력만 유지
  }
}

async function notify(config, message) {
  log(message);
  if (!config.webhookUrl) return;
  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch (err) {
    log(`웹훅 알림 전송 실패: ${err.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomIntervalSec(min, max) {
  if (min >= max) return min;
  return Math.floor(min + Math.random() * (max - min));
}

async function fillIfPresent(page, selector, value, label) {
  if (!selector || value === undefined || value === '') return true;
  const el = await page.$(selector);
  if (!el) {
    log(`[경고] 셀렉터를 찾을 수 없습니다: ${label} (${selector}) — selectors.js 확인 필요`);
    return false;
  }
  await el.fill(String(value));
  return true;
}

async function matchesOutcome(page, matcher) {
  if (!matcher) return false;
  if (matcher.selector) {
    const el = await page.$(matcher.selector);
    if (!el) return false;
    if (matcher.text) {
      // innerText: 실제로 화면에 렌더링된 텍스트만 본다. textContent를 쓰면 <script> 소스 코드에
      // 같은 문구가 들어있을 때(예: 성공/실패 메시지 문자열 리터럴) 오탐이 발생할 수 있다.
      const content = (await el.innerText().catch(() => '')) || '';
      return content.includes(matcher.text);
    }
    return true;
  }
  if (matcher.text) {
    const body = (await page.innerText('body').catch(() => '')) || '';
    return body.includes(matcher.text);
  }
  return false;
}

async function waitForOutcome(page, outcome, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await matchesOutcome(page, outcome.success)) return 'success';
    if (await matchesOutcome(page, outcome.noSlot)) return 'no_slot';
    if (await matchesOutcome(page, outcome.formError)) return 'form_error';
    await sleep(400);
  }
  return 'unknown';
}

async function attemptBooking(page, config, selectors) {
  await page.goto(config.bookingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const { form } = selectors;
  let allFilled = true;
  allFilled = (await fillIfPresent(page, form.name, config.customerName, '이름')) && allFilled;
  allFilled = (await fillIfPresent(page, form.phone, config.customerPhone, '연락처')) && allFilled;
  allFilled = (await fillIfPresent(page, form.carNumber, config.carNumber, '차량번호')) && allFilled;
  allFilled = (await fillIfPresent(page, form.date, config.desiredDate, '날짜')) && allFilled;
  if (config.desiredTime) {
    allFilled = (await fillIfPresent(page, form.time, config.desiredTime, '시간')) && allFilled;
  }

  if (!allFilled) {
    return { status: 'unknown', detail: '입력 필드 중 일부를 찾지 못했습니다.' };
  }

  const submitBtn = await page.$(form.submit);
  if (!submitBtn) {
    return { status: 'unknown', detail: `제출 버튼을 찾을 수 없습니다 (${form.submit})` };
  }
  await submitBtn.click();

  const status = await waitForOutcome(page, selectors.outcome, selectors.resultTimeoutMs);
  return { status };
}

async function runUntilSuccess(config, selectors = require('./selectors')) {
  const browser = await chromium.launch({
    headless: config.headless,
    executablePath: config.executablePath,
  });

  let attempt = 0;
  let unknownStreak = 0;
  const startedAt = Date.now();

  log(`예약 재시도 시작 — ${config.bookingUrl}`);
  log(
    `재시도 간격: ${config.retryMinSec}~${config.retryMaxSec}초, ` +
      `최대 시도: ${config.maxAttempts ?? '무제한'}, ` +
      `최대 실행시간: ${config.maxRuntimeMinutes ? config.maxRuntimeMinutes + '분' : '무제한'}`
  );

  try {
    for (;;) {
      attempt += 1;

      if (config.maxAttempts && attempt > config.maxAttempts) {
        await notify(config, `⏹ 최대 시도 횟수(${config.maxAttempts}회)에 도달하여 중단합니다.`);
        return { status: 'stopped_max_attempts', attempts: attempt - 1 };
      }
      const elapsedMin = (Date.now() - startedAt) / 60000;
      if (config.maxRuntimeMinutes && elapsedMin > config.maxRuntimeMinutes) {
        await notify(config, `⏹ 최대 실행 시간(${config.maxRuntimeMinutes}분)에 도달하여 중단합니다.`);
        return { status: 'stopped_max_runtime', attempts: attempt - 1 };
      }

      const context = await browser.newContext();
      const page = await context.newPage();

      let outcome;
      try {
        outcome = await attemptBooking(page, config, selectors);
      } catch (err) {
        outcome = { status: 'error', detail: err.message };
      }

      log(`시도 #${attempt}: ${outcome.status}${outcome.detail ? ' — ' + outcome.detail : ''}`);

      if (outcome.status === 'success') {
        const shotPath = path.join(LOG_DIR, `success-${Date.now()}.png`);
        try {
          await page.screenshot({ path: shotPath, fullPage: true });
        } catch {
          // 스크린샷 실패는 무시 (예약 성공 자체는 이미 확정된 상태)
        }
        await notify(config, `✅ 예약 성공! (총 ${attempt}회 시도). 스크린샷: ${shotPath}`);
        await context.close();
        return { status: 'success', attempts: attempt };
      }

      if (outcome.status === 'unknown' || outcome.status === 'error') {
        unknownStreak += 1;
        if (unknownStreak >= 3) {
          await notify(
            config,
            '⚠️ 페이지 상태를 3회 연속 인식하지 못해 중단합니다. selectors.js 설정이 실제 페이지와 맞는지 확인해주세요.'
          );
          await context.close();
          return { status: 'stopped_unknown', attempts: attempt };
        }
      } else {
        unknownStreak = 0;
      }

      await context.close();

      const waitSec = randomIntervalSec(config.retryMinSec, config.retryMaxSec);
      log(`${waitSec}초 후 재시도합니다... (다음 시도 #${attempt + 1})`);
      await sleep(waitSec * 1000);
    }
  } finally {
    await browser.close();
  }
}

module.exports = { runUntilSuccess, attemptBooking, log, notify };
