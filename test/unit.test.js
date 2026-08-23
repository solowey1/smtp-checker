'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseReply, parseCapabilities, matchesExpectation } = require('../src/client');
const { parseArgs, resolveConfig, connectionMode, ConfigError, parseInteger } = require('../src/config');
const { getProvider, detectProvider, listProviders } = require('../src/providers');
const { dotStuff, encodeHeaderValue, wrapBase64, bareAddress, buildTestMessage, toDataPayload } = require('../src/message');
const { chooseMechanism, plainToken, cramMd5Response, xoauth2Token } = require('../src/auth');
const { createTranslator, detectLanguage, STRINGS } = require('../src/i18n');

test('parseReply: однострочный ответ', () => {
  const parsed = parseReply('220 mail.example ESMTP\r\n');
  assert.equal(parsed.reply.code, 220);
  assert.equal(parsed.reply.lines.length, 1);
  assert.equal(parsed.rest, '');
});

test('parseReply: многострочный ответ собирается целиком', () => {
  const parsed = parseReply('250-mail.example\r\n250-STARTTLS\r\n250 AUTH PLAIN LOGIN\r\n');
  assert.equal(parsed.reply.code, 250);
  assert.equal(parsed.reply.lines.length, 3);
});

test('parseReply: неполный ответ не разбирается', () => {
  assert.equal(parseReply('250-mail.example\r\n250-STAR'), null);
});

test('parseReply: остаток буфера сохраняется для следующего чтения', () => {
  const parsed = parseReply('220 one\r\n250 two\r\n');
  assert.equal(parsed.reply.code, 220);
  assert.equal(parseReply(parsed.rest).reply.code, 250);
});

test('parseCapabilities: возможности сервера', () => {
  const caps = parseCapabilities(['250-mail', '250-STARTTLS', '250-SIZE 42991616', '250-8BITMIME', '250 AUTH PLAIN LOGIN XOAUTH2']);
  assert.equal(caps.starttls, true);
  assert.equal(caps.size, 42991616);
  assert.equal(caps.eightBitMime, true);
  assert.deepEqual(caps.auth, ['PLAIN', 'LOGIN', 'XOAUTH2']);
});

test('parseCapabilities: старый синтаксис AUTH=', () => {
  assert.deepEqual(parseCapabilities(['250-mail', '250 AUTH=PLAIN LOGIN']).auth, ['PLAIN', 'LOGIN']);
});

test('matchesExpectation: класс кода и точное совпадение', () => {
  assert.equal(matchesExpectation(250, 2), true);
  assert.equal(matchesExpectation(354, 2), false);
  assert.equal(matchesExpectation(354, [2, 354]), true);
  assert.equal(matchesExpectation(535, 235), false);
});

test('parseArgs: длинные, короткие и inline-значения', () => {
  const args = parseArgs(['--host', 'smtp.example.com', '--port=587', '-u', 'a@b.com', '-sv']);
  assert.equal(args.host, 'smtp.example.com');
  assert.equal(args.port, '587');
  assert.equal(args.user, 'a@b.com');
  assert.equal(args.send, true);
  assert.equal(args.verbose, true);
});

test('parseArgs: неизвестный короткий флаг — ошибка', () => {
  assert.throws(() => parseArgs(['-Z']), ConfigError);
});

test('parseArgs: параметру без значения — ошибка', () => {
  assert.throws(() => parseArgs(['--host']), ConfigError);
});

test('providers: определение по домену', () => {
  assert.equal(detectProvider('someone@gmail.com').id, 'gmail');
  assert.equal(detectProvider('someone@bk.ru').id, 'mailru');
  assert.equal(detectProvider('someone@ya.ru').id, 'yandex');
  assert.equal(detectProvider('someone@unknown-domain.tld'), null);
  assert.equal(detectProvider('not-an-email'), null);
});

test('providers: псевдонимы ключей', () => {
  assert.equal(getProvider('Google').id, 'gmail');
  assert.equal(getProvider('hotmail').id, 'outlook');
  assert.equal(getProvider('sendinblue').id, 'brevo');
  assert.equal(getProvider('nope'), null);
});

test('providers: у каждого пресета есть обязательные поля', () => {
  for (const id of listProviders()) {
    const p = getProvider(id);
    assert.ok(p.host, `${id}: нет host`);
    assert.ok(Number.isInteger(p.port), `${id}: нет port`);
    assert.equal(typeof p.secure, 'boolean', `${id}: нет secure`);
    assert.ok(p.title.ru && p.title.en, `${id}: нет названия на двух языках`);
  }
});

test('resolveConfig: пресет по домену пользователя', () => {
  const config = resolveConfig(parseArgs(['-u', 'me@yandex.ru']), {});
  assert.equal(config.host, 'smtp.yandex.ru');
  assert.equal(config.port, 465);
  assert.equal(config.secure, true);
  assert.equal(connectionMode(config), 'implicit');
  assert.equal(config.to, 'me@yandex.ru');
});

test('resolveConfig: явный порт 587 переключает на STARTTLS', () => {
  const config = resolveConfig(parseArgs(['-u', 'me@yandex.ru', '--port', '587']), {});
  assert.equal(config.secure, false);
  assert.equal(connectionMode(config), 'starttls');
});

test('resolveConfig: флаг --secure сильнее порта', () => {
  const config = resolveConfig(parseArgs(['-H', 'mail.example.com', '--port', '587', '--secure', '-u', 'me@example.com']), {});
  assert.equal(config.secure, true);
});

test('resolveConfig: переменные окружения', () => {
  const config = resolveConfig({}, { SMTP_HOST: 'mail.env.com', SMTP_PORT: '2525', SMTP_USER: 'env@example.com' });
  assert.equal(config.host, 'mail.env.com');
  assert.equal(config.port, 2525);
  assert.equal(config.user, 'env@example.com');
});

test('resolveConfig: аргументы важнее окружения', () => {
  const config = resolveConfig(parseArgs(['-H', 'from-args.com', '--no-auth']), { SMTP_HOST: 'from-env.com' });
  assert.equal(config.host, 'from-args.com');
});

test('resolveConfig: без хоста и провайдера — ошибка', () => {
  assert.throws(() => resolveConfig({}, {}), ConfigError);
});

test('resolveConfig: неизвестный провайдер — ошибка', () => {
  assert.throws(() => resolveConfig({ provider: 'нет-такого' }, {}), ConfigError);
});

test('resolveConfig: у SendGrid логин подставляется по умолчанию', () => {
  const config = resolveConfig(parseArgs(['-p', 'sendgrid']), {});
  assert.equal(config.user, 'apikey');
  assert.equal(config.host, 'smtp.sendgrid.net');
});

test('message: точка в начале строки экранируется', () => {
  assert.equal(dotStuff('hello\r\n.hidden\r\n..more'), 'hello\r\n..hidden\r\n...more');
});

test('message: заголовок с кириллицей кодируется по RFC 2047', () => {
  assert.equal(encodeHeaderValue('Plain ASCII'), 'Plain ASCII');
  assert.match(encodeHeaderValue('Проверка'), /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
});

test('message: base64 переносится по 76 символов', () => {
  const wrapped = wrapBase64('x'.repeat(200));
  assert.deepEqual(wrapped.split('\r\n').map((line) => line.length), [76, 76, 48]);
});

test('message: адрес извлекается из угловых скобок', () => {
  assert.equal(bareAddress('Имя <a@b.com>'), 'a@b.com');
  assert.equal(bareAddress('a@b.com'), 'a@b.com');
});

test('message: собранное письмо содержит нужные заголовки', () => {
  const t = createTranslator('ru');
  const message = buildTestMessage({
    from: 'a@b.com',
    to: 'c@d.com',
    context: { t, host: 'smtp.b.com', port: 465, mode: 'implicit TLS', user: 'a@b.com', date: new Date('2026-01-02T03:04:05Z') },
  });
  assert.match(message.raw, /^From: <a@b\.com>\r\n/);
  assert.match(message.raw, /\r\nTo: <c@d\.com>\r\n/);
  assert.match(message.raw, /\r\nContent-Transfer-Encoding: base64\r\n/);
  assert.match(message.raw, /\r\nMIME-Version: 1\.0\r\n/);
  assert.ok(message.size > 100);
  assert.ok(toDataPayload(message.raw).endsWith('\r\n.\r\n'));
});

test('auth: токен PLAIN', () => {
  const decoded = Buffer.from(plainToken('u@e.com', 'pw'), 'base64').toString('utf8');
  assert.equal(decoded, ['', 'u@e.com', 'pw'].join('\u0000'));
});

test('auth: токен XOAUTH2', () => {
  const decoded = Buffer.from(xoauth2Token('u@e.com', 'tok'), 'base64').toString('utf8');
  assert.equal(decoded, 'user=u@e.com\u0001auth=Bearer tok\u0001\u0001');
});

test('auth: ответ CRAM-MD5 — это логин, пробел и hex-подпись', () => {
  const challenge = Buffer.from('<123@server>').toString('base64');
  const decoded = Buffer.from(cramMd5Response('u@e.com', 'pw', challenge), 'base64').toString('utf8');
  assert.match(decoded, /^u@e\.com [0-9a-f]{32}$/);
});

test('auth: выбор механизма', () => {
  assert.equal(chooseMechanism({ offered: ['LOGIN', 'PLAIN'] }).mechanism, 'PLAIN');
  assert.equal(chooseMechanism({ offered: ['LOGIN'] }).mechanism, 'LOGIN');
  assert.equal(chooseMechanism({ offered: ['PLAIN'], hasOAuth: true }).mechanism, 'XOAUTH2');
  assert.equal(chooseMechanism({ offered: ['PLAIN'], preferred: 'login' }).mechanism, 'LOGIN');
  assert.equal(chooseMechanism({ offered: [] }).advertised, false);
});

test('i18n: словари ru и en совпадают по ключам', () => {
  assert.deepEqual(Object.keys(STRINGS.ru).sort(), Object.keys(STRINGS.en).sort());
});

test('i18n: подстановка параметров', () => {
  assert.equal(createTranslator('ru')('validFor', { days: 42 }), 'действителен ещё 42 дн.');
  assert.equal(createTranslator('en')('validFor', { days: 42 }), 'valid for 42 more days');
});

test('i18n: язык из окружения', () => {
  assert.equal(detectLanguage({ LANG: 'ru_RU.UTF-8' }), 'ru');
  assert.equal(detectLanguage({ LANG: 'en_US.UTF-8' }), 'en');
  assert.equal(detectLanguage({}), 'en');
});

test('parseInteger: отвергает нечисловые и выходящие за границы значения', () => {
  assert.equal(parseInteger('587', '--port', 1, 65535), 587);
  assert.equal(parseInteger(undefined, '--port', 1, 65535), null);
  assert.equal(parseInteger('', '--port', 1, 65535), null);
  for (const bad of ['abc', '1.5', '0', '70000', 'NaN', '12abc']) {
    assert.throws(() => parseInteger(bad, '--port', 1, 65535), ConfigError, `должно упасть на ${bad}`);
  }
});

test('resolveConfig: нечисловой --timeout — ошибка, а не NaN', () => {
  assert.throws(() => resolveConfig(parseArgs(['-u', 'me@gmail.com', '--timeout', 'abc']), {}), ConfigError);
  assert.equal(resolveConfig(parseArgs(['-u', 'me@gmail.com']), {}).timeout, 20000);
  assert.equal(resolveConfig(parseArgs(['-u', 'me@gmail.com', '--timeout', '5000']), {}).timeout, 5000);
});

test('resolveConfig: нечисловой --port — ошибка', () => {
  assert.throws(() => resolveConfig(parseArgs(['-u', 'me@gmail.com', '--port', 'нет']), {}), ConfigError);
  assert.throws(() => resolveConfig(parseArgs(['-u', 'me@gmail.com', '--port', '99999']), {}), ConfigError);
});

test('resolveConfig: --ports разбирается и чистится от дублей', () => {
  const config = resolveConfig(parseArgs(['-u', 'me@gmail.com', '--probe', '--ports', '25, 465 ,587,465']), {});
  assert.deepEqual(config.ports, [25, 465, 587]);
  assert.throws(() => resolveConfig(parseArgs(['-u', 'me@gmail.com', '--ports', '25,abc']), {}), ConfigError);
});

test('resolveConfig: аутентификация без логина — ошибка', () => {
  assert.throws(() => resolveConfig(parseArgs(['-H', 'mail.example.com']), {}), ConfigError);
  // --no-auth и XOAUTH2-токен снимают требование логина.
  assert.equal(resolveConfig(parseArgs(['-H', 'mail.example.com', '--no-auth']), {}).auth, false);
  assert.doesNotThrow(() => resolveConfig(parseArgs(['-H', 'mail.example.com', '--oauth', 'ya29.token']), {}));
});

test('resolveConfig: --send требует отправителя и получателя', () => {
  assert.throws(
    () => resolveConfig(parseArgs(['-H', 'mail.example.com', '--no-auth', '--send']), {}),
    (error) => error instanceof ConfigError && error.i18nKey === 'errNoSender'
  );
  assert.throws(
    () => resolveConfig(parseArgs(['-H', 'mail.example.com', '--no-auth', '--send', '--from', 'не адрес']), {}),
    (error) => error instanceof ConfigError && error.i18nKey === 'errBadAddress'
  );
  assert.throws(
    () => resolveConfig(parseArgs(['-H', 'mail.example.com', '--no-auth', '--send', '--from', 'a@example.com', '--to', 'без-собаки']), {}),
    (error) => error instanceof ConfigError && error.i18nKey === 'errBadAddress'
  );
  // Локальные релеи (MailHog) обходятся доменом без точки — такой адрес принимаем.
  assert.doesNotThrow(() =>
    resolveConfig(parseArgs(['-H', '127.0.0.1', '--no-auth', '--send', '--from', 'Тест <a@localhost>', '--to', 'b@example.co.uk']), {})
  );
  const config = resolveConfig(parseArgs(['-u', 'me@gmail.com', '--send']), {});
  assert.equal(config.from, 'me@gmail.com');
  assert.equal(config.to, 'me@gmail.com');
});
