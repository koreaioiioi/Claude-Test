#!/usr/bin/env node
// Checks Seoul -> Fukuoka round-trip flight prices via the Travelpayouts
// (Aviasales) Data API and appends the result to a local history file.
//
// Note: Travelpayouts prices/cheap returns the cheapest fare seen in cached
// user searches over the last ~48h for the given route/dates, not a live
// real-time quote. departure_at / return_at are the *departure* times of
// each leg (outbound from origin, inbound from destination) — the API does
// not report arrival times.
//
// Required env vars:
//   TRAVELPAYOUTS_TOKEN
//
// Optional env vars (defaults shown):
//   ORIGIN=ICN
//   DESTINATION=FUK
//   DEPARTURE_DATE=2026-09-10
//   RETURN_DATE=2026-09-13
//   CURRENCY=krw

const fs = require('fs/promises');
const path = require('path');

const ORIGIN = process.env.ORIGIN || 'ICN';
const DESTINATION = process.env.DESTINATION || 'FUK';
const DEPARTURE_DATE = process.env.DEPARTURE_DATE || '2026-09-10';
const RETURN_DATE = process.env.RETURN_DATE || '2026-09-13';
const CURRENCY = process.env.CURRENCY || 'krw';
const HISTORY_FILE = path.join(__dirname, '..', 'flight-price-history.json');

function flattenOffers(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (typeof node.price === 'number') {
    acc.push(node);
    return acc;
  }
  for (const value of Object.values(node)) {
    flattenOffers(value, acc);
  }
  return acc;
}

async function fetchCheapestOffers() {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    throw new Error('TRAVELPAYOUTS_TOKEN 환경변수가 설정되어 있지 않습니다.');
  }

  const params = new URLSearchParams({
    origin: ORIGIN,
    destination: DESTINATION,
    depart_date: DEPARTURE_DATE,
    return_date: RETURN_DATE,
    currency: CURRENCY,
  });

  const res = await fetch(`https://api.travelpayouts.com/v1/prices/cheap?${params}`, {
    headers: { 'x-access-token': token },
  });

  if (!res.ok) {
    throw new Error(`가격 조회 실패: ${res.status} ${await res.text()}`);
  }

  const payload = await res.json();
  if (payload.error) {
    throw new Error(`API 오류: ${payload.error}`);
  }

  return flattenOffers(payload.data)
    .map((offer) => ({
      origin: offer.origin || ORIGIN,
      destination: offer.destination || DESTINATION,
      price: offer.price,
      currency: (payload.currency || CURRENCY).toUpperCase(),
      airline: offer.airline,
      flightNumber: offer.flight_number,
      departureAt: offer.departure_at,
      returnAt: offer.return_at,
    }))
    .sort((a, b) => a.price - b.price);
}

async function appendHistory(entry) {
  let history = [];
  try {
    history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf-8'));
  } catch {
    // no history yet
  }
  history.push(entry);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function main() {
  const offers = await fetchCheapestOffers();

  const entry = {
    checkedAt: new Date().toISOString(),
    origin: ORIGIN,
    destination: DESTINATION,
    departureDate: DEPARTURE_DATE,
    returnDate: RETURN_DATE,
    offers,
  };

  await appendHistory(entry);

  console.log(`${ORIGIN} -> ${DESTINATION} (${DEPARTURE_DATE} ~ ${RETURN_DATE})`);
  if (offers.length === 0) {
    console.log('최근 캐시된 가격 데이터가 없습니다 (해당 날짜/노선 검색 이력 부족).');
    return;
  }
  for (const offer of offers) {
    console.log(
      `- ${offer.airline}${offer.flightNumber ?? ''}: ${offer.price.toLocaleString()} ${offer.currency}` +
        ` (출발 ${offer.departureAt ?? '?'}, 귀국편 출발 ${offer.returnAt ?? '?'})`
    );
  }
  console.log(`\n최저가: ${offers[0].price.toLocaleString()} ${offers[0].currency}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
