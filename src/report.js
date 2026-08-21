'use strict';

const { PROVIDERS } = require('./providers');
const { modeKey } = require('./check');

/** ANSI-раскраска, отключаемая через --no-color / NO_COLOR. */
function makePalette(enabled) {
  const wrap = (code) => (text) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text));
  return {
    bold: wrap(1),
    dim: wrap(90),
    green: wrap(32),
    red: wrap(31),
    yellow: wrap(33),
    cyan: wrap(36),
    magenta: wrap(35),
  };
}

const LABEL_WIDTH = 34;

/**
 * Живой вывод хода проверки в терминал.
 * Live progress renderer for the terminal.
 */
class Reporter {
  constructor({ t, lang, config, stream = process.stdout }) {
    this.t = t;
    this.lang = lang;
    this.config = config;
    this.stream = stream;
    this.c = makePalette(config.color && stream.isTTY !== false);
    this.silent = config.json || config.quiet;
  }

  line(text = '') {
    if (!this.silent) this.stream.write(text + '\n');
  }

  header() {
    const { t, c, config } = this;
    this.line();
    this.line(c.bold(t('header')));
    if (config.provider) {
      const title = config.provider.title[this.lang] || config.provider.title.en;
      const detected = config.provider.detectedFrom
        ? ' ' + c.dim('(' + t('detectedByDomain', { domain: config.provider.detectedFrom }) + ')')
        : '';
      this.line(`  ${t('provider')}: ${title}${detected}`);
    }
    this.line(`  ${t('server')}:   ${config.host}:${config.port} ${c.dim('(' + t(modeKey(modeOf(config))) + ')')}`);
    if (config.user) this.line(`  ${t('login')}:    ${config.user}`);
    if (!config.rejectUnauthorized) this.line('  ' + c.yellow(t('warnInsecure')));
    if (modeOf(config) === 'plain') this.line('  ' + c.yellow(t('warnPlain')));
    this.line();
  }

  /** Обработчик событий runCheck. */
  onEvent(event) {
    const { c, t } = this;
    if (event.type === 'wire') {
      if (!this.config.verbose) return;
      const tag = event.direction === 'out' ? c.cyan('C:') : c.dim('S:');
      this.line(`    ${tag} ${event.line}`);
      return;
    }
    if (event.type === 'step:done') {
      this.line(`  ${pad(event.step.label, LABEL_WIDTH)} ${c.green('✓ ' + t('ok'))}${event.step.detail ? c.dim('  ' + event.step.detail) : ''}`);
    } else if (event.type === 'step:skip') {
      this.line(`  ${pad(event.step.label, LABEL_WIDTH)} ${c.dim('– ' + t('skipped'))}${event.step.detail ? c.dim('  ' + event.step.detail) : ''}`);
    } else if (event.type === 'step:fail') {
      this.line(`  ${pad(event.step.label, LABEL_WIDTH)} ${c.red('✗ ' + t('fail'))}${event.step.detail ? c.dim('  ' + event.step.detail) : ''}`);
    }
  }

  /** Итог: сертификат, возможности, вердикт, подсказки. */
  summary(result) {
    const { c, t } = this;
    const details = [];

    if (result.tls) {
      const days = daysLeft(result.tls.validTo);
      const validity = days == null ? '' : days < 0 ? c.red(t('expired')) : t('validFor', { days });
      details.push(`${c.dim(t('certificate'))}: ${result.tls.subject || '—'}${result.tls.issuer ? `, ${t('issuedBy')} ${result.tls.issuer}` : ''}${validity ? `, ${validity}` : ''}`);
    }
    if (result.capabilities && result.capabilities.auth.length) {
      details.push(`${c.dim(t('authMechs'))}: ${result.capabilities.auth.join(', ')}`);
    }
    if (result.capabilities && result.capabilities.size) {
      details.push(`${c.dim(t('maxSize'))}: ${formatBytes(result.capabilities.size)}`);
    }
    if (details.length) {
      this.line();
      for (const detail of details) this.line('  ' + detail);
    }

    this.line();
    if (result.ok) {
      const text = result.message ? t('successSend', { to: result.message.to }) : result.auth ? t('successCheck') : t('successConnect');
      this.line(c.green(c.bold('✓ ' + text)) + ' ' + c.dim(t('elapsed', { ms: Math.round(result.elapsedMs) })));
      if (result.message) this.line(c.dim(`  Message-ID: ${result.message.messageId}`));
    } else {
      this.line(c.red(c.bold('✗ ' + t('failed'))) + ' ' + c.dim(t('elapsed', { ms: Math.round(result.elapsedMs) })));
      this.line('  ' + result.error.message);
      for (const hint of result.error.hints) this.line(`  ${c.yellow(t('hint'))}: ${hint}`);
      const provider = this.config.provider;
      if (provider && provider.credentialsUrl) this.line(`  ${c.dim(t('credentialsUrl'))}: ${provider.credentialsUrl}`);
      if (provider && provider.docsUrl) this.line(`  ${c.dim(t('docsUrl'))}: ${provider.docsUrl}`);
    }
    this.line();
  }
}

/** Таблица известных провайдеров для --list. */
function renderProviderList(t, lang, colorEnabled) {
  const c = makePalette(colorEnabled);
  const rows = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    title: p.title[lang] || p.title.en,
    endpoint: `${p.host}:${p.port}`,
    mode: p.secure ? 'TLS' : 'STARTTLS',
    domains: (p.domains || []).slice(0, 3).join(', '),
  }));
  const width = (key) => Math.max(...rows.map((r) => r[key].length));
  const widths = { id: width('id'), title: width('title'), endpoint: width('endpoint'), mode: 10 };

  const out = ['', c.bold(t('listTitle')), ''];
  for (const row of rows) {
    out.push(
      '  ' +
        c.cyan(pad(row.id, widths.id + 2)) +
        pad(row.title, widths.title + 2) +
        c.dim(pad(row.endpoint, widths.endpoint + 2) + pad(row.mode, widths.mode) + row.domains)
    );
  }
  out.push('', c.dim('  ' + t('listHint')), '');
  return out.join('\n');
}

/** Результат сканирования портов для --probe. */
function renderProbe(t, host, results, colorEnabled) {
  const c = makePalette(colorEnabled);
  const out = ['', c.bold(t('probeTitle', { host })), ''];
  for (const r of results.sort((a, b) => a.port - b.port)) {
    const status = r.open ? c.green('✓ ' + t('probeOpen')) : c.red('✗ ' + t('probeClosed'));
    const detail = r.open ? c.dim(`${Math.round(r.ms)} ms${r.banner ? '  ' + r.banner : ''}`) : c.dim(r.error || '');
    out.push(`  ${pad(String(r.port), 8)}${status}  ${detail}`);
  }
  const open = results.filter((r) => r.open).map((r) => r.port);
  out.push('', '  ' + (open.length ? t('probeSummary', { ports: open.join(', ') }) : c.red(t('probeNone'))), '');
  return out.join('\n');
}

/** Финальный JSON для --json. */
function toJson(config, result) {
  return JSON.stringify(
    {
      ok: result.ok,
      provider: result.provider,
      host: result.host,
      port: result.port,
      mode: result.mode,
      user: result.user,
      tls: result.tls,
      capabilities: result.capabilities,
      auth: result.auth,
      message: result.message,
      steps: result.steps.map((s) => ({ id: s.id, status: s.status, ms: Math.round(s.ms), detail: s.detail })),
      error: result.error,
      elapsedMs: Math.round(result.elapsedMs),
    },
    null,
    2
  );
}

function modeOf(config) {
  if (config.secure) return 'implicit';
  if (config.useStarttls) return 'starttls';
  return 'plain';
}

function pad(text, width) {
  const value = String(text);
  return value.length >= width ? value + ' ' : value + ' '.repeat(width - value.length);
}

function daysLeft(validTo) {
  if (!validTo) return null;
  const expiry = Date.parse(validTo);
  if (Number.isNaN(expiry)) return null;
  return Math.floor((expiry - Date.now()) / 86400000);
}

function formatBytes(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

module.exports = { Reporter, renderProviderList, renderProbe, toJson, makePalette, daysLeft, formatBytes, pad };
