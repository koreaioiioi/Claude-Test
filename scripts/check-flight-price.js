#!/usr/bin/env node
// Checks Seoul -> Fukuoka round-trip flight prices via the Amadeus Self-Service API
// and appends the result to a local history file.
//
// Required env vars:
//   AMADEUS_CLIENT_ID
//   AMADEUS_CLIENT_SECRET
//
// Optional env vars (defaults shown):
//   ORIGIN=ICN
//   DESTINATION=FUK
//   DEPARTURE_DATE=2026-09-10
//   RETURN_DATE=2026-09-13
//   AMADEUS_HOST=test.api.amadeus.com   (use api.amadeus.com for production)

const fs = require('fs/promises');
const path = require('path');

const HOST = process.env.AMADEUS_HOST || 'test.api.amadeus.com';
const ORIGIN = process.env.ORIGIN || 'ICN';
const DESTINATION = process.env.DESTINATION || 'FUK';
const DEPARTURE_DATE = process.env.DEPARTURE_DATE || '2026-09-10';
const RETURN_DATE = process.env.RETURN_DATE || '2026-09-13';
const HISTORY_FILE = path.join(__dirname, '..', 'flight-price-history.json');

async function getAccessToken() {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET 환경변수가 설정되어 있지 않습니다.');
  }

  const res = await fetch(`https://${HOST}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`토큰 발급 실패: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function searchFlightOffers(token) {
  const params = new URLSearchParams({
    originLocationCode: ORIGIN,
    destinationLocationCode: DESTINATION,
    departureDate: DEPARTURE_DATE,
    returnDate: RETURN_DATE,
    adults: '1',
    currencyCode: 'KRW',
    max: '10',
  });

  const res = await fetch(`https://${HOST}/v2/shopping/flight-offers?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`항공권 검색 실패: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function summarizeOffers(payload) {
  const carriers = payload.dictionaries?.carriers || {};
  const offers = payload.data || [];

  return offers
    .map((offer) => {
      const firstItinerary = offer.itineraries[0];
      const carrierCode = firstItinerary.segments[0].carrierCode;
      return {
        airline: carriers[carrierCode] || carrierCode,
        price: Number(offer.price.total),
        currency: offer.price.currency,
      };
    })
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
  const token = await getAccessToken();
  const payload = await searchFlightOffers(token);
  const offers = summarizeOffers(payload);

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
    console.log('검색된 항공권이 없습니다.');
    return;
  }
  for (const offer of offers) {
    console.log(`- ${offer.airline}: ${offer.price.toLocaleString()} ${offer.currency}`);
  }
  console.log(`\n최저가: ${offers[0].airline} ${offers[0].price.toLocaleString()} ${offers[0].currency}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
