require('dotenv').config();
const { loadConfig } = require('./config');
const { runUntilSuccess } = require('./bot');

runUntilSuccess(loadConfig(process.env))
  .then((result) => {
    console.log('종료:', result);
    process.exitCode = result.status === 'success' ? 0 : 1;
  })
  .catch((err) => {
    console.error('[fatal]', err);
    process.exitCode = 1;
  });
