'use strict';

const fs = require('fs');
const path = require('path');
const { getProvider, detectProvider } = require('./providers');

/** Флаги без значения. / Boolean flags. */
const BOOLEAN_OPTIONS = new Set([
  'send', 'secure', 'starttls', 'insecure', 'json', 'verbose', 'quiet',
  'list', 'help', 'version', 'dry-run', 'probe', 'no-auth', 'no-color', 'plain',
]);

/** Параметры со значением. / Options that take a value. */
const VALUE_OPTIONS = new Set([
  'provider', 'host', 'port', 'user', 'pass', 'from', 'to',
  'auth', 'oauth', 'subject', 'text', 'helo', 'timeout', 'lang', 'ports',
]);

/** Короткие псевдонимы. / Short aliases. */
const SHORT_OPTIONS = {
  p: 'provider', H: 'host', u: 'user', P: 'pass', t: 'to', f: 'from',
  s: 'send', v: 'verbose', q: 'quiet', h: 'help', V: 'version', l: 'list', j: 'json',
};

/** Порты, на которых TLS начинается сразу. / Ports serving implicit TLS. */
const IMPLICIT_TLS_PORTS = [465, 2465];

class ConfigError extends Error {
  constructor(key, params) {
    super(key);
    this.i18nKey = key;
    this.params = params || {};
  }
}

/**
 * Целое число в заданных границах. Пустое значение -> null.
 * Без этой проверки строка вроде --timeout abc превращалась бы в NaN,
 * а setTimeout(fn, NaN) срабатывает мгновенно.
 */
function parseInteger(value, flag, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).trim());
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ConfigError('errBadNumber', { flag, value: String(value), min, max });
  }
  return number;
}

/**
 * Разбор argv в плоский объект.
 * Поддерживает: --key value, --key=value, --flag, -u value, -sv.
 */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('-') || token === '-') continue;

    let name;
    let inlineValue = null;

    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      name = eq === -1 ? token.slice(2) : token.slice(2, eq);
      if (eq !== -1) inlineValue = token.slice(eq + 1);
    } else {
      const letters = token.slice(1).split('');
      // Группа коротких флагов: последняя буква может принимать значение.
      for (let k = 0; k < letters.length; k++) {
        const mapped = SHORT_OPTIONS[letters[k]];
        if (!mapped) throw new ConfigError('errUnknownFlag', { flag: '-' + letters[k] });
        if (k < letters.length - 1) {
          if (!BOOLEAN_OPTIONS.has(mapped)) throw new ConfigError('errNeedValue', { flag: '-' + letters[k] });
          out[mapped] = true;
        } else {
          name = mapped;
        }
      }
    }

    if (!BOOLEAN_OPTIONS.has(name) && !VALUE_OPTIONS.has(name)) {
      throw new ConfigError('errUnknownFlag', { flag: '--' + name });
    }

    if (BOOLEAN_OPTIONS.has(name)) {
      out[name] = inlineValue === null ? true : !/^(0|false|no|off)$/i.test(inlineValue);
      continue;
    }

    if (inlineValue !== null) {
      out[name] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || (next.startsWith('--') && next.length > 2)) {
      throw new ConfigError('errNeedValue', { flag: '--' + name });
    }
    out[name] = next;
    i++;
  }
  return out;
}

/** Простейший загрузчик .env — существующие переменные окружения не перетирает. */
function loadDotEnv(file, env = process.env) {
  const target = file || path.join(process.cwd(), '.env');
  let content;
  try {
    content = fs.readFileSync(target, 'utf8');
  } catch {
    return env;
  }
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || /^\s*#/.test(line)) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) env[key] = value;
  }
  return env;
}

/**
 * Свести аргументы, переменные окружения и пресет провайдера в итоговую конфигурацию.
 * Пароль сюда не попадает — он запрашивается отдельно (см. bin/smtp-checker.js).
 */
function resolveConfig(args, env = process.env) {
  const providerKey = args.provider || env.SMTP_PROVIDER || null;
  let provider = null;

  if (providerKey) {
    provider = getProvider(providerKey);
    if (!provider) throw new ConfigError('errUnknownProvider', { name: providerKey });
  }

  const user = args.user || env.SMTP_USER || (provider && provider.defaultUser) || null;
  const from = args.from || env.SMTP_FROM || user || null;

  if (!provider) provider = detectProvider(user) || detectProvider(from);

  const host = args.host || env.SMTP_HOST || (provider && provider.host) || null;
  if (!host) throw new ConfigError('errNoHost');

  const explicitPort = parseInteger(args.port != null ? args.port : env.SMTP_PORT, '--port', 1, 65535);
  const port = explicitPort != null ? explicitPort : (provider ? provider.port : 587);

  let secure;
  if (args.plain) secure = false;
  else if (args.secure) secure = true;
  else if (args.starttls) secure = false;
  else if (env.SMTP_SECURE != null) secure = !/^(0|false|no|off)$/i.test(env.SMTP_SECURE);
  else if (explicitPort != null) secure = IMPLICIT_TLS_PORTS.includes(port);
  else if (provider) secure = provider.secure;
  else secure = IMPLICIT_TLS_PORTS.includes(port);

  const useStarttls = !secure && !args.plain;
  const auth = !args['no-auth'];
  const send = Boolean(args.send);
  const to = args.to || env.SMTP_TO || from;

  // Проверяем до подключения: иначе на сервер уходил бы логин "null",
  // а MAIL FROM:<> падал бы с TypeError уже посреди сессии.
  if (auth && !args.oauth && !env.SMTP_OAUTH_TOKEN && !user) throw new ConfigError('errNoUser');
  if (send) {
    if (!from) throw new ConfigError('errNoSender');
    assertAddress(from, '--from');
    assertAddress(to, '--to');
  }

  return {
    provider,
    host,
    port,
    secure,
    useStarttls,
    allowPlain: Boolean(args.plain),
    rejectUnauthorized: !args.insecure,
    user,
    from,
    to,
    auth,
    mechanism: args.auth || env.SMTP_AUTH || null,
    accessToken: args.oauth || env.SMTP_OAUTH_TOKEN || null,
    send,
    subject: args.subject || null,
    text: args.text || null,
    helo: args.helo || env.SMTP_HELO || null,
    timeout: parseInteger(args.timeout != null ? args.timeout : env.SMTP_TIMEOUT, '--timeout', 100, 600000) || 20000,
    verbose: Boolean(args.verbose),
    quiet: Boolean(args.quiet),
    json: Boolean(args.json),
    color: !args['no-color'] && !env.NO_COLOR,
    dryRun: Boolean(args['dry-run']),
    probe: Boolean(args.probe),
    ports: parsePortList(args.ports),
  };
}

/**
 * Грубая проверка адреса: "user@example.com" или "Имя <user@example.com>".
 * Полную валидацию по RFC 5322 не делаем — задача в том, чтобы отсечь
 * очевидный мусор до MAIL FROM, а не заменить собой сервер.
 */
function assertAddress(value, flag) {
  const bare = /<([^<>]+)>/.exec(String(value || ''));
  const address = (bare ? bare[1] : String(value || '')).trim();
  // Домен без точки (user@localhost) допускаем: утилитой проверяют и локальные релеи.
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+$/.test(address)) {
    throw new ConfigError('errBadAddress', { flag, value: String(value) });
  }
}

/** Список портов для --probe: "25,465,587". */
function parsePortList(value) {
  if (!value) return null;
  const ports = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => parseInteger(part, '--ports', 1, 65535));
  return ports.length ? [...new Set(ports)] : null;
}

/** Режим соединения одним словом — для отчёта. */
function connectionMode(config) {
  if (config.secure) return 'implicit';
  if (config.useStarttls) return 'starttls';
  return 'plain';
}

module.exports = { parseArgs, resolveConfig, loadDotEnv, connectionMode, ConfigError, parseInteger, assertAddress, BOOLEAN_OPTIONS, VALUE_OPTIONS, SHORT_OPTIONS, IMPLICIT_TLS_PORTS };
