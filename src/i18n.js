'use strict';

/** Строки интерфейса на русском и английском. / UI strings in Russian and English. */

const STRINGS = {
  ru: {
    // шапка
    header: 'Проверка SMTP',
    provider: 'Провайдер',
    detectedByDomain: 'определён по домену {domain}',
    server: 'Сервер',
    login: 'Логин',
    modeImplicit: 'implicit TLS',
    modeStarttls: 'STARTTLS',
    modePlain: 'без шифрования',

    // шаги
    stepConnect: 'TCP-подключение',
    stepTls: 'TLS-рукопожатие',
    stepGreeting: 'Приветствие сервера',
    stepEhlo: 'EHLO и возможности',
    stepStarttls: 'Переход на TLS (STARTTLS)',
    stepAuth: 'Аутентификация',
    stepSend: 'Отправка письма',
    stepQuit: 'Завершение сессии',

    // результаты
    ok: 'ок',
    fail: 'ошибка',
    skipped: 'пропущено',
    certificate: 'Сертификат',
    issuedBy: 'выдан',
    validFor: 'действителен ещё {days} дн.',
    expired: 'ПРОСРОЧЕН',
    authMechs: 'Механизмы AUTH',
    maxSize: 'Макс. размер письма',
    noAuthOffered: 'сервер не предлагает AUTH',
    authSkipped: 'пропущена (--no-auth)',
    sendSkipped: 'пропущена (добавьте --send, чтобы отправить письмо)',
    accepted: 'принято',
    messageSize: 'размер письма',

    successCheck: 'SMTP работает: подключение и аутентификация прошли успешно.',
    successConnect: 'SMTP доступен: соединение установлено, аутентификация не проверялась.',
    successSend: 'SMTP работает: письмо отправлено на {to}.',
    failed: 'Проверка не пройдена.',
    elapsed: 'заняло {ms} мс',
    hint: 'подсказка',
    credentialsUrl: 'Создать пароль приложения',
    docsUrl: 'Документация провайдера',

    // ошибки
    errNoPassword: 'Не указан пароль. Передайте --pass, задайте SMTP_PASS или запустите в интерактивном терминале.',
    errUnknownProvider: 'Неизвестный провайдер: {name}. Список доступных: --list',
    errNoHost: 'Не удалось определить сервер. Укажите --provider, --host или e-mail в --user.',
    errTimeoutRead: 'Сервер не ответил за {ms} мс.',
    errTimeoutConnect: 'Не удалось подключиться за {ms} мс.',
    errNoStarttls: 'Сервер не поддерживает STARTTLS — соединение осталось бы незашифрованным.',
    errUnexpected: 'Неожиданный ответ {code}: {text}',
    errAuthFailed: 'Аутентификация отклонена ({code}): {text}',
    errNoMech: 'Ни один поддерживаемый механизм AUTH не подошёл. Сервер предлагает: {mechs}',
    errNotAccepted: 'Сервер не принял письмо ({code}): {text}',
    errUnknownFlag: 'Неизвестный параметр: {flag}. Справка: --help',
    errNeedValue: 'Параметру {flag} нужно значение.',

    // подсказки
    hintDns: 'Хост не резолвится — проверьте написание в --host.',
    hintRefused: 'Порт закрыт. Попробуйте другой: --port 587 или --port 465.',
    hintTimeout: 'Нет ответа: порт скорее всего блокирует провайдер интернета, файрвол или облако (порт 25 закрыт почти везде).',
    hintCert: 'Сертификат не проходит проверку. Для локального или самоподписанного сервера добавьте --insecure.',
    hintAuth: 'Проверьте логин и пароль. У большинства провайдеров нужен отдельный пароль приложения, а не основной пароль аккаунта.',
    hintRelay: 'Сервер отказался пересылать письмо: адрес отправителя должен принадлежать вашему аккаунту, а получатель — быть разрешённым.',
    hintSenderMismatch: 'Адрес в --from должен совпадать с ящиком, под которым вы авторизовались (или быть его подтверждённым алиасом).',
    hintPortMismatch: 'Похоже, режим шифрования не совпадает с портом. Порт 465 — это --secure, порт 587/25 — это STARTTLS.',
    hintRateLimit: 'Слишком много попыток или превышен лимит отправки — подождите и повторите.',

    // прочее
    promptPassword: 'Пароль для {user}: ',
    listTitle: 'Известные провайдеры',
    listHint: 'Использование: --provider <ключ>',
    dryRunTitle: 'Итоговые параметры (--dry-run, подключение не выполняется)',
    probeTitle: 'Проверка портов {host}',
    probeOpen: 'открыт',
    probeClosed: 'закрыт',
    probeSummary: 'Доступные порты: {ports}',
    probeNone: 'Ни один порт не ответил.',
    testSubject: 'Проверка SMTP {time}',
    testBodyIntro: 'Это тестовое письмо, отправленное утилитой smtp-checker.',
    testBodyOutro: 'Если вы его получили — отправка почты работает.',
    warnInsecure: 'ВНИМАНИЕ: проверка сертификата отключена (--insecure).',
    warnPlain: 'ВНИМАНИЕ: соединение без шифрования, пароль уйдёт открытым текстом.',
  },

  en: {
    header: 'SMTP check',
    provider: 'Provider',
    detectedByDomain: 'detected from domain {domain}',
    server: 'Server',
    login: 'Login',
    modeImplicit: 'implicit TLS',
    modeStarttls: 'STARTTLS',
    modePlain: 'unencrypted',

    stepConnect: 'TCP connection',
    stepTls: 'TLS handshake',
    stepGreeting: 'Server greeting',
    stepEhlo: 'EHLO and capabilities',
    stepStarttls: 'Upgrade to TLS (STARTTLS)',
    stepAuth: 'Authentication',
    stepSend: 'Sending message',
    stepQuit: 'Closing session',

    ok: 'ok',
    fail: 'failed',
    skipped: 'skipped',
    certificate: 'Certificate',
    issuedBy: 'issued by',
    validFor: 'valid for {days} more days',
    expired: 'EXPIRED',
    authMechs: 'AUTH mechanisms',
    maxSize: 'Max message size',
    noAuthOffered: 'server does not advertise AUTH',
    authSkipped: 'skipped (--no-auth)',
    sendSkipped: 'skipped (add --send to deliver a test message)',
    accepted: 'accepted',
    messageSize: 'message size',

    successCheck: 'SMTP works: connection and authentication succeeded.',
    successConnect: 'SMTP is reachable: the connection succeeded, authentication was not checked.',
    successSend: 'SMTP works: a test message was sent to {to}.',
    failed: 'Check failed.',
    elapsed: 'took {ms} ms',
    hint: 'hint',
    credentialsUrl: 'Create an app password',
    docsUrl: 'Provider documentation',

    errNoPassword: 'No password supplied. Pass --pass, set SMTP_PASS, or run in an interactive terminal.',
    errUnknownProvider: 'Unknown provider: {name}. See --list for the available keys.',
    errNoHost: 'Cannot determine the server. Pass --provider, --host, or an e-mail in --user.',
    errTimeoutRead: 'The server did not answer within {ms} ms.',
    errTimeoutConnect: 'Could not connect within {ms} ms.',
    errNoStarttls: 'The server does not support STARTTLS — the session would stay unencrypted.',
    errUnexpected: 'Unexpected reply {code}: {text}',
    errAuthFailed: 'Authentication rejected ({code}): {text}',
    errNoMech: 'No supported AUTH mechanism worked. The server offers: {mechs}',
    errNotAccepted: 'The server rejected the message ({code}): {text}',
    errUnknownFlag: 'Unknown option: {flag}. See --help.',
    errNeedValue: 'Option {flag} requires a value.',

    hintDns: 'The hostname does not resolve — check the spelling in --host.',
    hintRefused: 'The port is closed. Try another one: --port 587 or --port 465.',
    hintTimeout: 'No response: the port is most likely blocked by your ISP, a firewall, or a cloud provider (port 25 is blocked almost everywhere).',
    hintCert: 'The certificate failed validation. For a local or self-signed server add --insecure.',
    hintAuth: 'Check the username and password. Most providers require a dedicated app password rather than the main account password.',
    hintRelay: 'The server refused to relay: the sender must belong to your account and the recipient must be allowed.',
    hintSenderMismatch: 'The --from address must match the mailbox you authenticated with (or be a verified alias of it).',
    hintPortMismatch: 'The encryption mode looks mismatched with the port. Port 465 means --secure; ports 587/25 mean STARTTLS.',
    hintRateLimit: 'Too many attempts or a sending quota was exceeded — wait and retry.',

    promptPassword: 'Password for {user}: ',
    listTitle: 'Known providers',
    listHint: 'Usage: --provider <key>',
    dryRunTitle: 'Resolved settings (--dry-run, nothing is connected)',
    probeTitle: 'Port probe for {host}',
    probeOpen: 'open',
    probeClosed: 'closed',
    probeSummary: 'Reachable ports: {ports}',
    probeNone: 'No port responded.',
    testSubject: 'SMTP check {time}',
    testBodyIntro: 'This is a test message sent by the smtp-checker utility.',
    testBodyOutro: 'If you received it, outgoing mail works.',
    warnInsecure: 'WARNING: certificate validation is disabled (--insecure).',
    warnPlain: 'WARNING: the connection is unencrypted, the password will travel in clear text.',
  },
};

/** Язык по окружению: ru для русских локалей, иначе en. */
function detectLanguage(env = process.env) {
  const locale = String(env.SMTP_CHECKER_LANG || env.LC_ALL || env.LC_MESSAGES || env.LANG || '').toLowerCase();
  return locale.startsWith('ru') ? 'ru' : 'en';
}

/** Переводчик: t('server') / t('validFor', { days: 42 }). */
function createTranslator(lang) {
  const dict = STRINGS[lang] || STRINGS.en;
  return function t(key, params) {
    const template = dict[key] != null ? dict[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (m, name) => (params[name] != null ? String(params[name]) : m));
  };
}

module.exports = { STRINGS, detectLanguage, createTranslator };
