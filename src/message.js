'use strict';

const os = require('os');

/**
 * Сборка тестового письма (MIME, UTF-8, base64).
 * Builds the test message: MIME, UTF-8, base64 body.
 */

/** Кодирование заголовка по RFC 2047, если в нём есть не-ASCII. */
function encodeHeaderValue(value) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Разбить base64 на строки по 76 символов, как требует MIME. */
function wrapBase64(value) {
  return (value.match(/.{1,76}/g) || []).join('\r\n');
}

/** Точка в начале строки экранируется удвоением (RFC 5321, 4.5.2). */
function dotStuff(data) {
  return data.split('\r\n').map((line) => (line.startsWith('.') ? '.' + line : line)).join('\r\n');
}

/**
 * @param {object} options
 * @param {string} options.from      адрес отправителя
 * @param {string} options.to        адрес получателя
 * @param {string} [options.subject] тема (по умолчанию — сгенерированная)
 * @param {string} [options.text]    тело (по умолчанию — сгенерированное)
 * @param {object} options.context   { host, port, mode, user, lang, t, date }
 * @returns {{ raw: string, subject: string, messageId: string, size: number }}
 */
function buildTestMessage({ from, to, subject, text, context }) {
  const { t, host, port, mode, user, date = new Date() } = context;
  const stamp = date.toISOString().replace(/\.\d+Z$/, 'Z');
  const finalSubject = subject || t('testSubject', { time: stamp });

  const body = text || [
    t('testBodyIntro'),
    '',
    `${t('server')}: ${host}:${port} (${mode})`,
    `${t('login')}: ${user}`,
    `Date: ${date.toUTCString()}`,
    `Host: ${safeHostname()}`,
    '',
    t('testBodyOutro'),
  ].join('\r\n');

  const messageId = `<${date.getTime()}.${process.pid}.smtp-checker@${sanitizeDomain(from)}>`;

  const headers = [
    `From: ${formatAddress(from)}`,
    `To: ${formatAddress(to)}`,
    `Subject: ${encodeHeaderValue(finalSubject)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    'X-Mailer: smtp-checker',
    'Auto-Submitted: auto-generated',
  ].join('\r\n');

  const raw = `${headers}\r\n\r\n${wrapBase64(Buffer.from(body, 'utf8').toString('base64'))}\r\n`;
  return { raw, subject: finalSubject, messageId, size: Buffer.byteLength(raw, 'utf8') };
}

/** Данные для команды DATA: экранированные точки + завершающая последовательность. */
function toDataPayload(raw) {
  return `${dotStuff(raw.endsWith('\r\n') ? raw : raw + '\r\n')}.\r\n`;
}

function formatAddress(address) {
  return /^[^<>]+<[^<>]+>$/.test(address) ? address : `<${address}>`;
}

/** Только адрес без отображаемого имени — для MAIL FROM / RCPT TO. */
function bareAddress(address) {
  const angle = /<([^<>]+)>/.exec(address);
  return (angle ? angle[1] : address).trim();
}

function sanitizeDomain(address) {
  const bare = bareAddress(address);
  const at = bare.lastIndexOf('@');
  return at === -1 ? safeHostname() : bare.slice(at + 1);
}

function safeHostname() {
  try {
    const name = os.hostname();
    return name && /^[A-Za-z0-9.-]+$/.test(name) ? name : 'localhost';
  } catch {
    return 'localhost';
  }
}

module.exports = { buildTestMessage, toDataPayload, dotStuff, encodeHeaderValue, wrapBase64, bareAddress, safeHostname };
