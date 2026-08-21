'use strict';

/**
 * Программный интерфейс. / Programmatic API.
 *
 *   const { checkSmtp } = require('smtp-checker');
 *   const result = await checkSmtp({ user: 'a@b.com', pass: '...', send: true });
 */

const { runCheck, probePorts } = require('./src/check');
const { resolveConfig, connectionMode } = require('./src/config');
const { createTranslator, detectLanguage } = require('./src/i18n');
const { PROVIDERS, listProviders, getProvider, detectProvider } = require('./src/providers');
const { SmtpClient, parseCapabilities, parseReply } = require('./src/client');
const { buildTestMessage } = require('./src/message');

/**
 * @param {object} options — те же ключи, что у CLI: provider, host, port, user, pass,
 *                           from, to, send, secure, starttls, insecure, timeout, lang…
 * @returns {Promise<object>} структурированный результат проверки
 */
async function checkSmtp(options = {}) {
  const lang = options.lang || detectLanguage();
  const t = createTranslator(lang);
  const args = { ...options };
  const config = resolveConfig(args, options.env || {});
  config.pass = options.pass || null;
  config.verbose = false;
  return runCheck(config, { t, lang, onEvent: options.onEvent || (() => {}) });
}

module.exports = {
  checkSmtp,
  runCheck,
  probePorts,
  resolveConfig,
  connectionMode,
  PROVIDERS,
  listProviders,
  getProvider,
  detectProvider,
  SmtpClient,
  parseCapabilities,
  parseReply,
  buildTestMessage,
  createTranslator,
  detectLanguage,
};
