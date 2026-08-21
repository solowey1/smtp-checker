'use strict';

const net = require('net');
const tls = require('tls');
const { EventEmitter } = require('events');

/**
 * Минимальный SMTP-клиент поверх net/tls. Без зависимостей.
 * Minimal SMTP client on top of net/tls. Dependency-free.
 *
 * События / events: 'command' (строка, отправленная нами), 'reply' (ответ сервера).
 */
class SmtpClient extends EventEmitter {
  constructor({ host, port, secure = false, timeout = 20000, rejectUnauthorized = true, servername } = {}) {
    super();
    this.host = host;
    this.port = port;
    this.secure = secure;
    this.timeout = timeout;
    this.rejectUnauthorized = rejectUnauthorized;
    this.servername = servername || host;
    this.socket = null;
    this.tlsInfo = null;
    this._buffer = '';
    this._pending = null;
  }

  /** Открыть соединение. Возвращает время подключения в мс. */
  connect() {
    return new Promise((resolve, reject) => {
      const started = process.hrtime.bigint();
      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(arg);
      };

      const timer = setTimeout(() => {
        const err = new Error('connect timeout');
        err.code = 'ETIMEDOUT';
        if (this.socket) this.socket.destroy();
        finish(reject, err);
      }, this.timeout);

      const onReady = () => {
        this.socket.setTimeout(0);
        this._attach(this.socket);
        if (this.secure) this._captureTls(this.socket);
        finish(resolve, Number(process.hrtime.bigint() - started) / 1e6);
      };

      const options = { host: this.host, port: this.port };
      this.socket = this.secure
        ? tls.connect({ ...options, servername: this.servername, rejectUnauthorized: this.rejectUnauthorized }, onReady)
        : net.connect(options, onReady);

      this.socket.once('error', (err) => finish(reject, err));
    });
  }

  /** Апгрейд открытого сокета до TLS после команды STARTTLS. */
  upgradeToTls() {
    return new Promise((resolve, reject) => {
      const started = process.hrtime.bigint();
      const plain = this.socket;
      plain.removeAllListeners('data');
      this._buffer = '';

      const secureSocket = tls.connect(
        { socket: plain, servername: this.servername, rejectUnauthorized: this.rejectUnauthorized },
        () => {
          secureSocket.removeListener('error', onError);
          this.socket = secureSocket;
          this._attach(secureSocket);
          this._captureTls(secureSocket);
          resolve(Number(process.hrtime.bigint() - started) / 1e6);
        }
      );
      const onError = (err) => reject(err);
      secureSocket.once('error', onError);
    });
  }

  /** Прочитать один полный ответ сервера (с учётом многострочных). */
  read() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending = null;
        const err = new Error('read timeout');
        err.code = 'ETIMEDOUT';
        err.phase = 'read';
        reject(err);
      }, this.timeout);
      this._pending = { resolve, reject, timer };
      this._drain();
    });
  }

  /** Отправить строку команды (без CRLF). */
  write(line, { redact = false } = {}) {
    this.emit('command', redact ? redactCommand(line) : line);
    this.socket.write(line + '\r\n');
  }

  /** Отправить сырые данные (тело письма). */
  writeRaw(data) {
    this.socket.write(data);
  }

  /** Команда + ответ. expect — список допустимых кодов или первых цифр. */
  async command(line, { expect, redact = false } = {}) {
    this.write(line, { redact });
    const reply = await this.read();
    if (expect && !matchesExpectation(reply.code, expect)) {
      const err = new Error(`unexpected reply ${reply.code}`);
      err.smtp = reply;
      throw err;
    }
    return reply;
  }

  /** Закрыть соединение, не роняя процесс на ошибках сокета. */
  async close() {
    if (!this.socket || this.socket.destroyed) return;
    try {
      this.write('QUIT');
      await Promise.race([this.read(), new Promise((r) => setTimeout(r, 2000).unref())]);
    } catch {
      /* сервер вправе просто оборвать соединение */
    }
    this.socket.destroy();
  }

  destroy() {
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
  }

  // --- внутреннее ---

  _attach(socket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      this._buffer += chunk;
      this._drain();
    });
    socket.on('error', (err) => {
      if (this._pending) {
        const p = this._pending;
        this._pending = null;
        clearTimeout(p.timer);
        p.reject(err);
      }
    });
  }

  _captureTls(socket) {
    const cert = socket.getPeerCertificate ? socket.getPeerCertificate() : null;
    const cipher = socket.getCipher ? socket.getCipher() : null;
    this.tlsInfo = {
      protocol: socket.getProtocol ? socket.getProtocol() : null,
      cipher: cipher ? cipher.name : null,
      authorized: socket.authorized,
      authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
      subject: cert && cert.subject ? cert.subject.CN || null : null,
      issuer: cert && cert.issuer ? cert.issuer.O || cert.issuer.CN || null : null,
      validFrom: cert ? cert.valid_from || null : null,
      validTo: cert ? cert.valid_to || null : null,
      altNames: cert && cert.subjectaltname ? cert.subjectaltname : null,
    };
  }

  _drain() {
    if (!this._pending) return;
    const parsed = parseReply(this._buffer);
    if (!parsed) return;
    this._buffer = parsed.rest;
    const pending = this._pending;
    this._pending = null;
    clearTimeout(pending.timer);
    this.emit('reply', parsed.reply);
    pending.resolve(parsed.reply);
  }
}

/**
 * Разбор ответа SMTP из буфера.
 * Возвращает { reply: { code, lines, text }, rest } или null, если ответ ещё не полный.
 */
function parseReply(buffer) {
  const parts = buffer.split(/\r?\n/);
  for (let i = 0; i < parts.length - 1; i++) {
    // Финальная строка ответа: "250 OK" (пробел), а не "250-OK" (продолжение).
    if (/^\d{3}(?: |$)/.test(parts[i])) {
      const lines = parts.slice(0, i + 1);
      return {
        reply: {
          code: parseInt(lines[lines.length - 1].slice(0, 3), 10),
          lines,
          text: lines.map((l) => l.slice(4)).join(' ').trim(),
        },
        rest: parts.slice(i + 1).join('\r\n'),
      };
    }
  }
  return null;
}

/** Совпадает ли код ответа с ожиданием: 2 (любой 2xx), 250, [2, 354]. */
function matchesExpectation(code, expect) {
  const list = Array.isArray(expect) ? expect : [expect];
  return list.some((e) => (e < 10 ? Math.floor(code / 100) === e : code === e));
}

/** Скрыть секреты в логе команд: сохраняем только имя механизма. */
function redactCommand(line) {
  const withMechanism = /^(AUTH\s+\S+)(\s+.*)?$/i.exec(line);
  if (withMechanism) return withMechanism[1] + (withMechanism[2] ? ' <hidden>' : '');
  return '<hidden>';
}

/** Разбор строк EHLO в структуру возможностей. */
function parseCapabilities(replyLines) {
  const caps = { raw: [], auth: [], size: null, starttls: false, pipelining: false, eightBitMime: false, enhancedStatusCodes: false, smtputf8: false };
  for (const line of replyLines.slice(1)) {
    const value = line.slice(4).trim();
    if (!value) continue;
    caps.raw.push(value);
    const [keyword, ...rest] = value.split(/\s+/);
    const key = keyword.toUpperCase();
    if (key === 'AUTH') caps.auth = rest.map((m) => m.toUpperCase());
    else if (key === 'STARTTLS') caps.starttls = true;
    else if (key === 'SIZE') caps.size = rest[0] ? parseInt(rest[0], 10) : 0;
    else if (key === 'PIPELINING') caps.pipelining = true;
    else if (key === '8BITMIME') caps.eightBitMime = true;
    else if (key === 'ENHANCEDSTATUSCODES') caps.enhancedStatusCodes = true;
    else if (key === 'SMTPUTF8') caps.smtputf8 = true;
  }
  // Некоторые серверы пишут "AUTH=PLAIN LOGIN" (старый синтаксис).
  if (!caps.auth.length) {
    const legacy = caps.raw.find((l) => /^AUTH=/i.test(l));
    if (legacy) caps.auth = legacy.slice(5).trim().split(/\s+/).map((m) => m.toUpperCase());
  }
  return caps;
}

module.exports = { SmtpClient, parseReply, parseCapabilities, matchesExpectation };
