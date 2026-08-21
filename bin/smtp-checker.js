#!/usr/bin/env node
'use strict';

const { parseArgs, resolveConfig, loadDotEnv, connectionMode, ConfigError } = require('../src/config');
const { createTranslator, detectLanguage } = require('../src/i18n');
const { runCheck, probePorts } = require('../src/check');
const { Reporter, renderProviderList, renderProbe, toJson, makePalette } = require('../src/report');
const { helpText } = require('../src/help');
const { promptPassword } = require('../src/prompt');
const pkg = require('../package.json');

const DEFAULT_PROBE_PORTS = [25, 465, 587, 2525];

const EXIT = { OK: 0, FAILED: 1, USAGE: 2 };

async function main(argv) {
  loadDotEnv();

  let args;
  let lang = detectLanguage();
  let t = createTranslator(lang);

  try {
    args = parseArgs(argv);
  } catch (error) {
    return usageError(error, t, true);
  }

  if (args.lang === 'ru' || args.lang === 'en') {
    lang = args.lang;
    t = createTranslator(lang);
  }

  const colorEnabled = !args['no-color'] && !process.env.NO_COLOR && process.stdout.isTTY;

  if (args.help) {
    process.stdout.write(helpText(lang, colorEnabled));
    return EXIT.OK;
  }

  if (args.version) {
    process.stdout.write(`${pkg.name} ${pkg.version}\n`);
    return EXIT.OK;
  }

  if (args.list) {
    process.stdout.write(renderProviderList(t, lang, colorEnabled) + '\n');
    return EXIT.OK;
  }

  let config;
  try {
    config = resolveConfig(args, process.env);
  } catch (error) {
    return usageError(error, t, colorEnabled);
  }

  // --probe: только сканирование портов, без логина.
  if (config.probe) {
    const ports = config.ports || uniquePorts(config);
    const results = await probePorts(config.host, ports, Math.min(config.timeout, 8000));
    if (config.json) {
      process.stdout.write(JSON.stringify({ host: config.host, results }, null, 2) + '\n');
    } else {
      process.stdout.write(renderProbe(t, config.host, results, colorEnabled) + '\n');
    }
    return results.some((r) => r.open) ? EXIT.OK : EXIT.FAILED;
  }

  // --dry-run: показать, что именно будет использовано.
  if (config.dryRun) {
    const c = makePalette(colorEnabled);
    const view = {
      provider: config.provider ? config.provider.id : null,
      host: config.host,
      port: config.port,
      mode: connectionMode(config),
      user: config.user,
      from: config.from,
      to: config.to,
      auth: config.auth ? config.mechanism || 'auto' : false,
      send: config.send,
      timeout: config.timeout,
      rejectUnauthorized: config.rejectUnauthorized,
    };
    if (config.json) process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    else process.stdout.write(`\n${c.bold(t('dryRunTitle'))}\n\n${JSON.stringify(view, null, 2)}\n\n`);
    return EXIT.OK;
  }

  // Пароль: аргумент → окружение → скрытый ввод.
  config.pass = args.pass || process.env.SMTP_PASS || null;
  if (config.auth && !config.accessToken && !config.pass) {
    if (process.stdin.isTTY && !config.json && !config.quiet) {
      try {
        config.pass = await promptPassword(t('promptPassword', { user: config.user || config.host }));
      } catch {
        return usageError(new ConfigError('errNoPassword'), t, colorEnabled);
      }
    }
    if (!config.pass) return usageError(new ConfigError('errNoPassword'), t, colorEnabled);
  }

  const reporter = new Reporter({ t, lang, config, stream: process.stdout });
  reporter.header();

  const result = await runCheck(config, { t, lang, onEvent: (event) => reporter.onEvent(event) });

  if (config.json) process.stdout.write(toJson(config, result) + '\n');
  else reporter.summary(result);

  return result.ok ? EXIT.OK : EXIT.FAILED;
}

/** Порты для --probe: из пресета провайдера плюс стандартные. */
function uniquePorts(config) {
  const fromProvider = config.provider ? [config.provider.port, ...(config.provider.altPorts || [])] : [];
  return [...new Set([...fromProvider, ...DEFAULT_PROBE_PORTS])].sort((a, b) => a - b);
}

function usageError(error, t, colorEnabled) {
  const c = makePalette(colorEnabled);
  const message = error instanceof ConfigError ? t(error.i18nKey, error.params) : error.message;
  process.stderr.write(c.red('✗ ') + message + '\n');
  return EXIT.USAGE;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`✗ ${error && error.stack ? error.stack : error}\n`);
    process.exit(EXIT.USAGE);
  });
