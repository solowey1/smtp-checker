'use strict';

const net = require('net');
const tls = require('tls');
const { SmtpClient, parseCapabilities } = require('./client');
const { chooseMechanism, authenticate } = require('./auth');
const { buildTestMessage, toDataPayload, bareAddress, safeHostname } = require('./message');
const { connectionMode } = require('./config');

/**
 * Полный сценарий проверки: подключение → TLS → EHLO → AUTH → (опционально) отправка.
 * Full check: connect → TLS → EHLO → AUTH → optionally send.
 *
 * Возвращает структурированный результат и никогда не бросает наружу —
 * ошибка попадает в result.error, чтобы вызывающий код мог её напечатать или отдать в JSON.
 */
async function runCheck(config, { t, lang = 'ru', onEvent = () => {} } = {}) {
  const startedAt = process.hrtime.bigint();
  const steps = [];
  const result = {
    ok: false,
    host: config.host,
    port: config.port,
    mode: connectionMode(config),
    user: config.user,
    provider: config.provider ? config.provider.id : null,
    steps,
    tls: null,
    capabilities: null,
    auth: null,
    message: null,
    error: null,
    elapsedMs: 0,
  };

  const step = (id, label) => {
    const entry = { id, label, status: 'running', ms: 0, detail: null };
    steps.push(entry);
    onEvent({ type: 'step:start', step: entry });
    const begin = process.hrtime.bigint();
    return {
      done(detail, extra) {
        entry.status = 'ok';
        entry.ms = Number(process.hrtime.bigint() - begin) / 1e6;
        entry.detail = detail || null;
        if (extra) Object.assign(entry, extra);
        onEvent({ type: 'step:done', step: entry });
      },
      skip(detail) {
        entry.status = 'skip';
        entry.detail = detail || null;
        onEvent({ type: 'step:skip', step: entry });
      },
      fail(detail) {
        entry.status = 'fail';
        entry.ms = Number(process.hrtime.bigint() - begin) / 1e6;
        entry.detail = detail || null;
        onEvent({ type: 'step:fail', step: entry });
      },
    };
  };

  const client = new SmtpClient({
    host: config.host,
    port: config.port,
    secure: config.secure,
    timeout: config.timeout,
    rejectUnauthorized: config.rejectUnauthorized,
  });

  client.on('command', (line) => onEvent({ type: 'wire', direction: 'out', line }));
  client.on('reply', (reply) => reply.lines.forEach((line) => onEvent({ type: 'wire', direction: 'in', line })));

  let current = null;
  try {
    // 1. TCP (+ implicit TLS)
    current = step('connect', t('stepConnect'));
    const connectMs = await client.connect();
    current.done(`${connectMs.toFixed(0)} ms`);

    if (config.secure) {
      current = step('tls', t('stepTls'));
      result.tls = client.tlsInfo;
      current.done(describeTls(client.tlsInfo), { tls: client.tlsInfo });
    }

    // 2. Приветствие
    current = step('greeting', t('stepGreeting'));
    const greeting = await client.read();
    if (Math.floor(greeting.code / 100) !== 2) throw smtpError(greeting);
    result.greeting = greeting.text;
    current.done(greeting.lines[0]);

    // 3. EHLO
    const helo = config.helo || safeHostname();
    current = step('ehlo', t('stepEhlo'));
    let ehlo = await ehloOrHelo(client, helo);
    let caps = parseCapabilities(ehlo.lines);
    result.capabilities = caps;
    current.done(summarizeCapabilities(caps), { capabilities: caps });

    // 4. STARTTLS
    if (config.useStarttls) {
      current = step('starttls', t('stepStarttls'));
      if (!caps.starttls) throw new CheckError('errNoStarttls');
      await client.command('STARTTLS', { expect: 2 });
      await client.upgradeToTls();
      result.tls = client.tlsInfo;
      ehlo = await ehloOrHelo(client, helo);
      caps = parseCapabilities(ehlo.lines);
      result.capabilities = caps;
      current.done(describeTls(client.tlsInfo), { tls: client.tlsInfo });
    } else if (!config.secure) {
      step('starttls', t('stepStarttls')).skip(t('warnPlain'));
    }

    // 5. AUTH
    current = step('auth', t('stepAuth'));
    if (!config.auth) {
      current.skip(t('authSkipped'));
    } else {
      const picked = chooseMechanism({
        offered: caps.auth,
        preferred: config.mechanism,
        hasOAuth: Boolean(config.accessToken),
      });
      const authResult = await authenticate(client, {
        user: config.user,
        pass: config.pass,
        accessToken: config.accessToken,
        mechanism: picked.mechanism,
      });
      result.auth = { mechanism: authResult.mechanism, advertised: picked.advertised, ok: true };
      current.done(authResult.mechanism, { mechanism: authResult.mechanism });
    }

    // 6. Отправка
    current = step('send', t('stepSend'));
    if (!config.send) {
      current.skip(t('sendSkipped'));
    } else {
      const message = buildTestMessage({
        from: config.from,
        to: config.to,
        subject: config.subject,
        text: config.text,
        context: { t, host: config.host, port: config.port, mode: t(modeKey(result.mode)), user: config.user },
      });
      await client.command(`MAIL FROM:<${bareAddress(config.from)}>`, { expect: 2 });
      await client.command(`RCPT TO:<${bareAddress(config.to)}>`, { expect: 2 });
      await client.command('DATA', { expect: 354 });
      client.writeRaw(toDataPayload(message.raw));
      onEvent({ type: 'wire', direction: 'out', line: `<message body, ${message.size} bytes> CRLF.CRLF` });
      const accepted = await client.read();
      if (Math.floor(accepted.code / 100) !== 2) throw smtpError(accepted, 'errNotAccepted');
      result.message = {
        to: config.to,
        from: config.from,
        subject: message.subject,
        messageId: message.messageId,
        size: message.size,
        response: accepted.text,
      };
      current.done(`${t('accepted')}: ${accepted.lines[accepted.lines.length - 1]}`);
    }

    result.ok = true;
  } catch (error) {
    if (current) {
      try { current.fail(errorSummary(error)); } catch { /* шаг уже закрыт */ }
    }
    result.error = normalizeError(error, config, t, lang);
  } finally {
    try {
      if (result.ok) await client.close();
      else client.destroy();
    } catch { /* соединение уже закрыто */ }
    result.elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  }

  return result;
}

/** EHLO с откатом на HELO для древних серверов. */
async function ehloOrHelo(client, hostname) {
  try {
    return await client.command(`EHLO ${hostname}`, { expect: 2 });
  } catch (error) {
    if (!error.smtp) throw error;
    return client.command(`HELO ${hostname}`, { expect: 2 });
  }
}

/** Проверка доступности набора портов без аутентификации. */
// async ради единых семантик: любые ошибки приходят отказом промиса, а не синхронным throw.
// eslint-disable-next-line require-await
async function probePorts(host, ports, timeout = 5000, implicitTlsPorts = [465, 2465]) {
  const attempts = ports.map(
    (port) =>
      new Promise((resolve) => {
        const started = process.hrtime.bigint();
        const useTls = implicitTlsPorts.includes(port);
        // На 465 сервер молчит до TLS-рукопожатия, поэтому подключаемся сразу через TLS.
        const socket = useTls
          ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
          : net.connect({ host, port });

        let settled = false;
        const finish = (open, banner, error) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve({
            port,
            open,
            tls: useTls,
            banner: banner || null,
            error: error || null,
            ms: Number(process.hrtime.bigint() - started) / 1e6,
          });
        };

        socket.setTimeout(timeout, () => finish(false, null, 'ETIMEDOUT'));
        socket.once('error', (err) => finish(false, null, err.code || err.message));
        socket.once(useTls ? 'secureConnect' : 'connect', () => {
          // Соединение уже есть: дальше ждём баннер, но его отсутствие не делает порт закрытым.
          socket.removeAllListeners('timeout');
          socket.setTimeout(Math.min(timeout, 3000), () => finish(true, null, null));
          socket.once('data', (chunk) => finish(true, String(chunk).split(/\r?\n/)[0], null));
        });
      })
  );
  return Promise.all(attempts);
}

class CheckError extends Error {
  constructor(i18nKey, params) {
    super(i18nKey);
    this.i18nKey = i18nKey;
    this.params = params || {};
  }
}

function smtpError(reply, i18nKey) {
  const error = new Error(`smtp ${reply.code}`);
  error.smtp = reply;
  if (i18nKey) error.i18nKey = i18nKey;
  return error;
}

function modeKey(mode) {
  return mode === 'implicit' ? 'modeImplicit' : mode === 'starttls' ? 'modeStarttls' : 'modePlain';
}

function describeTls(info) {
  if (!info) return null;
  const parts = [info.protocol, info.cipher].filter(Boolean);
  if (info.subject) parts.push(`CN=${info.subject}`);
  return parts.join(', ');
}

function summarizeCapabilities(caps) {
  const parts = [];
  if (caps.auth.length) parts.push(`AUTH: ${caps.auth.join(' ')}`);
  if (caps.starttls) parts.push('STARTTLS');
  if (caps.size) parts.push(`SIZE ${caps.size}`);
  return parts.join(' | ') || null;
}

function errorSummary(error) {
  if (error.smtp) return error.smtp.lines[error.smtp.lines.length - 1];
  return error.message;
}

/** Человеческий текст ошибки + подсказки. */
function normalizeError(error, config, t, lang = 'ru') {
  const smtp = error.smtp || null;
  const code = smtp ? smtp.code : null;
  const netCode = error.code || null;
  const hints = [];

  let message;
  if (error.i18nKey === 'errNoStarttls') message = t('errNoStarttls');
  else if (error.i18nKey === 'errNotAccepted') message = t('errNotAccepted', { code, text: smtp.text });
  else if (smtp && (code === 535 || code === 534 || code === 454 || code === 530)) message = t('errAuthFailed', { code, text: smtp.text });
  else if (smtp) message = t('errUnexpected', { code, text: smtp.text });
  else if (netCode === 'ETIMEDOUT' && error.phase === 'read') message = t('errTimeoutRead', { ms: config.timeout });
  else if (netCode === 'ETIMEDOUT') message = t('errTimeoutConnect', { ms: config.timeout });
  else message = error.message;

  if (netCode === 'ENOTFOUND' || netCode === 'EAI_AGAIN') hints.push(t('hintDns'));
  if (netCode === 'ECONNREFUSED') hints.push(t('hintRefused'));
  if (netCode === 'ETIMEDOUT') hints.push(t('hintTimeout'));
  if (netCode && /CERT|SELF_SIGNED|ALTNAME|DEPTH_ZERO/i.test(netCode)) hints.push(t('hintCert'));
  if (/wrong version number|packet length too long|record layer/i.test(error.message || '')) hints.push(t('hintPortMismatch'));
  if (code === 535 || code === 534 || code === 530) hints.push(t('hintAuth'));
  if (code === 550 || code === 553 || code === 554) hints.push(t('hintRelay'));
  if (code === 553 || (smtp && /sender|from address|not owned/i.test(smtp.text))) hints.push(t('hintSenderMismatch'));
  if (code === 421 || code === 450 || code === 451 || code === 452) hints.push(t('hintRateLimit'));

  if (config.provider && config.provider.notes) {
    hints.push(config.provider.notes[lang] || config.provider.notes.en);
  }

  return {
    message,
    smtpCode: code,
    smtpText: smtp ? smtp.text : null,
    networkCode: netCode,
    hints: [...new Set(hints.filter(Boolean))],
  };
}

module.exports = { runCheck, probePorts, modeKey, describeTls, CheckError };
