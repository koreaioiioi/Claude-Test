const http = require('http');

const PAGE_HTML = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>가짜 예약 페이지 (테스트용)</title></head>
<body>
  <h1>발레파킹 예약 (mock)</h1>
  <form id="booking-form">
    <input id="name" name="name" placeholder="이름" />
    <input id="phone" name="phone" placeholder="연락처" />
    <input id="carNumber" name="carNumber" placeholder="차량번호" />
    <input id="date" name="date" placeholder="날짜" />
    <input id="time" name="time" placeholder="시간" />
    <button type="submit">예약하기</button>
  </form>
  <div id="result"></div>
  <script>
    document.getElementById('booking-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch('/api/book', { method: 'POST' });
      const data = await res.json();
      const el = document.getElementById('result');
      if (data.ok) {
        el.className = 'result-success';
        el.textContent = '예약이 완료되었습니다.';
      } else {
        el.className = 'result-fail';
        el.textContent = '죄송합니다. 마감되었습니다. 다시 시도해주세요.';
      }
    });
  </script>
</body>
</html>`;

function startMockServer({ succeedOnAttempt = 3, port = 0 } = {}) {
  let attempts = 0;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(PAGE_HTML);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/book') {
      attempts += 1;
      const ok = attempts >= succeedOnAttempt;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok, attempts }));
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: boundPort } = server.address();
      resolve({
        url: `http://127.0.0.1:${boundPort}/`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { startMockServer };

if (require.main === module) {
  startMockServer({ succeedOnAttempt: 3 }).then(({ url }) => {
    console.log(`mock booking site running at ${url} (3번째 시도부터 성공 처리)`);
  });
}
