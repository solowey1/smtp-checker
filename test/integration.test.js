'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { startFakeServer } = require('./helpers/fake-server');
const { runCheck, probePorts } = require('../src/check');
const { parseArgs, resolveConfig } = require('../src/config');
const { createTranslator } = require('../src/i18n');

const t = createTranslator('ru');

/** Конфиг для локального фейкового сервера: без TLS, чтобы не возиться с сертификатами. */
function localConfig(server, extra = []) {
  const config = resolveConfig(parseArgs(['-H', server.host, '--port', String(server.port), '--plain', '-u', 'user@example.com', ...extra]), {});
  config.pass = 'secret';
  config.timeout = 5000;
  return config;
}

test('проверка проходит: подключение, EHLO и AUTH PLAIN', async () => {
  const server = await startFakeServer();
  try {
    const result = await runCheck(localConfig(server), { t });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.auth.mechanism, 'PLAIN');
    assert.deepEqual(result.capabilities.auth, ['PLAIN', 'LOGIN']);
    assert.equal(result.capabilities.size, 10485760);
    assert.equal(result.steps.find((s) => s.id === 'send').status, 'skip');
  } finally {
    await server.close();
  }
});

test('отправка письма: сервер получает корректный MIME', async () => {
  const server = await startFakeServer();
  try {
    const config = localConfig(server, ['--send', '--to', 'friend@example.com', '--subject', 'Тест кириллицей']);
    const result = await runCheck(config, { t });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.message.to, 'friend@example.com');
    assert.match(result.message.response, /queued/);

    assert.equal(server.received.length, 1);
    const raw = server.received[0];
    assert.match(raw, /^From: <user@example\.com>\r\n/);
    assert.match(raw, /\r\nTo: <friend@example\.com>\r\n/);
    assert.match(raw, /\r\nSubject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=\r\n/);
    assert.match(raw, /\r\nX-Mailer: smtp-checker\r\n/);

    // Тело действительно декодируется и содержит наши строки.
    const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    const decoded = Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8');
    assert.match(decoded, /smtp-checker/);
    assert.match(decoded, /user@example\.com/);
  } finally {
    await server.close();
  }
});

test('AUTH LOGIN используется, если сервер предлагает только его', async () => {
  const server = await startFakeServer({ capabilities: ['AUTH LOGIN'] });
  try {
    const result = await runCheck(localConfig(server), { t });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.auth.mechanism, 'LOGIN');
  } finally {
    await server.close();
  }
});

test('неверный пароль: ok=false, код 535 и подсказка', async () => {
  const server = await startFakeServer({ pass: 'другой-пароль' });
  try {
    const result = await runCheck(localConfig(server), { t });
    assert.equal(result.ok, false);
    assert.equal(result.error.smtpCode, 535);
    assert.ok(result.error.hints.length > 0);
    assert.equal(result.steps.find((s) => s.id === 'auth').status, 'fail');
  } finally {
    await server.close();
  }
});

test('--no-auth пропускает аутентификацию', async () => {
  const server = await startFakeServer({ pass: 'что угодно' });
  try {
    const config = localConfig(server, ['--no-auth']);
    config.pass = null;
    const result = await runCheck(config, { t });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.auth, null);
    assert.equal(result.steps.find((s) => s.id === 'auth').status, 'skip');
  } finally {
    await server.close();
  }
});

test('сервер без STARTTLS: проверка падает с понятной ошибкой', async () => {
  const server = await startFakeServer({ capabilities: ['AUTH PLAIN'] });
  try {
    const config = resolveConfig(parseArgs(['-H', server.host, '--port', String(server.port), '--starttls', '-u', 'user@example.com']), {});
    config.pass = 'secret';
    config.timeout = 5000;
    const result = await runCheck(config, { t });
    assert.equal(result.ok, false);
    assert.equal(result.error.message, t('errNoStarttls'));
  } finally {
    await server.close();
  }
});

test('откат на HELO, если EHLO не поддерживается', async () => {
  const server = await startFakeServer({ supportsEhlo: false });
  try {
    const config = localConfig(server, ['--no-auth']);
    config.pass = null;
    const result = await runCheck(config, { t });
    assert.equal(result.ok, true, JSON.stringify(result.error));
  } finally {
    await server.close();
  }
});

test('закрытый порт: ECONNREFUSED и подсказка про другой порт', async () => {
  const server = await startFakeServer();
  const port = server.port;
  await server.close();

  const config = resolveConfig(parseArgs(['-H', '127.0.0.1', '--port', String(port), '--plain', '-u', 'user@example.com']), {});
  config.pass = 'secret';
  config.timeout = 3000;
  const result = await runCheck(config, { t });
  assert.equal(result.ok, false);
  assert.equal(result.error.networkCode, 'ECONNREFUSED');
  assert.ok(result.error.hints.some((hint) => hint.includes('Порт закрыт')));
});

test('probePorts: открытый порт виден, закрытый — нет', async () => {
  const open = await startFakeServer();
  const closed = await startFakeServer();
  const closedPort = closed.port;
  await closed.close();

  try {
    const results = await probePorts('127.0.0.1', [open.port, closedPort], 2000);
    const byPort = Object.fromEntries(results.map((r) => [r.port, r]));
    assert.equal(byPort[open.port].open, true);
    assert.match(byPort[open.port].banner, /^220 /);
    assert.equal(byPort[closedPort].open, false);
  } finally {
    await open.close();
  }
});

test('verbose-события содержат и команды, и ответы, без пароля', async () => {
  const server = await startFakeServer();
  try {
    const wire = [];
    await runCheck(localConfig(server), { t, onEvent: (event) => event.type === 'wire' && wire.push(event) });
    const outgoing = wire.filter((e) => e.direction === 'out').map((e) => e.line);
    const incoming = wire.filter((e) => e.direction === 'in').map((e) => e.line);
    assert.ok(outgoing.some((line) => line.startsWith('EHLO ')));
    assert.ok(incoming.some((line) => line.startsWith('220 ')));
    assert.ok(outgoing.some((line) => line === 'AUTH PLAIN <hidden>'));
    assert.ok(!wire.some((e) => e.line.includes('secret')));
  } finally {
    await server.close();
  }
});
