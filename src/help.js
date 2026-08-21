'use strict';

const { makePalette } = require('./report');

const HELP = {
  ru: `
{bold}smtp-checker{reset} — быстрая проверка SMTP из консоли

{bold}Использование{reset}
  smtp-checker --user you@example.com --pass "пароль" [--send]

{bold}Куда подключаться{reset}
  -p, --provider <ключ>   пресет провайдера (--list покажет все)
  -H, --host <хост>       SMTP-сервер вручную
      --port <порт>       порт (465 = TLS сразу, 587/25 = STARTTLS)
      --secure            принудительно implicit TLS
      --starttls          принудительно STARTTLS
      --plain             без шифрования (только для локальных серверов)
      --insecure          не проверять сертификат (самоподписанные)

{bold}Учётные данные{reset}
  -u, --user <логин>      логин, обычно полный e-mail
  -P, --pass <пароль>     пароль (лучше через SMTP_PASS или интерактивный ввод)
      --auth <механизм>   PLAIN | LOGIN | CRAM-MD5 | XOAUTH2
      --oauth <токен>     access token для XOAUTH2
      --no-auth           не аутентифицироваться (открытые релеи, MailHog)

{bold}Отправка письма{reset}
  -s, --send              отправить тестовое письмо (без флага — только логин)
  -f, --from <адрес>      отправитель (по умолчанию = --user)
  -t, --to <адрес>        получатель (по умолчанию = --from)
      --subject <тема>    своя тема письма
      --text <текст>      своё тело письма

{bold}Режимы и вывод{reset}
  -l, --list              список известных провайдеров
      --probe             проверить, какие порты открыты (25/465/587/2525)
      --ports <список>    свои порты для --probe, через запятую
      --dry-run           показать итоговые настройки и выйти
  -j, --json              машинночитаемый результат
  -v, --verbose           показать весь диалог с сервером
  -q, --quiet             только код возврата
      --no-color          без ANSI-цветов
      --lang <ru|en>      язык вывода
      --timeout <мс>      таймаут, по умолчанию 20000
      --helo <имя>        имя хоста для EHLO
  -h, --help              эта справка
  -V, --version           версия

{bold}Переменные окружения{reset}
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TO,
  SMTP_PROVIDER, SMTP_SECURE, SMTP_AUTH, SMTP_OAUTH_TOKEN, SMTP_TIMEOUT
  Читаются также из файла .env в текущей папке.

{bold}Примеры{reset}
  {dim}# только проверить логин, провайдер определится по домену{reset}
  smtp-checker -u you@gmail.com -P "app password"

  {dim}# отправить тестовое письмо самому себе{reset}
  smtp-checker -u you@yandex.ru -P "..." --send

  {dim}# свой сервер на STARTTLS, письмо на другой адрес{reset}
  smtp-checker -H mail.mydomain.ru --port 587 -u noreply@mydomain.ru -P "..." -s -t me@example.com

  {dim}# какие порты вообще открыты{reset}
  smtp-checker -H smtp.mail.ru --probe

  {dim}# в CI: тихо, с кодом возврата{reset}
  SMTP_PASS="..." smtp-checker -u bot@example.com --json

{bold}Коды возврата{reset}
  0 — всё хорошо   1 — проверка не прошла   2 — ошибка в параметрах
`,

  en: `
{bold}smtp-checker{reset} — quick SMTP check from the console

{bold}Usage{reset}
  smtp-checker --user you@example.com --pass "secret" [--send]

{bold}Where to connect{reset}
  -p, --provider <key>    provider preset (see --list)
  -H, --host <host>       SMTP server explicitly
      --port <port>       port (465 = implicit TLS, 587/25 = STARTTLS)
      --secure            force implicit TLS
      --starttls          force STARTTLS
      --plain             no encryption (local servers only)
      --insecure          skip certificate validation (self-signed)

{bold}Credentials{reset}
  -u, --user <login>      username, usually the full e-mail
  -P, --pass <password>   password (prefer SMTP_PASS or the interactive prompt)
      --auth <mechanism>  PLAIN | LOGIN | CRAM-MD5 | XOAUTH2
      --oauth <token>     access token for XOAUTH2
      --no-auth           skip authentication (open relays, MailHog)

{bold}Sending a message{reset}
  -s, --send              send a test message (without it, auth only)
  -f, --from <address>    sender (defaults to --user)
  -t, --to <address>      recipient (defaults to --from)
      --subject <text>    custom subject
      --text <body>       custom body

{bold}Modes and output{reset}
  -l, --list              list known providers
      --probe             check which ports are reachable (25/465/587/2525)
      --ports <list>      custom comma-separated ports for --probe
      --dry-run           print resolved settings and exit
  -j, --json              machine-readable result
  -v, --verbose           print the full SMTP dialogue
  -q, --quiet             exit code only
      --no-color          disable ANSI colors
      --lang <ru|en>      output language
      --timeout <ms>      timeout, default 20000
      --helo <name>       hostname used in EHLO
  -h, --help              this help
  -V, --version           version

{bold}Environment variables{reset}
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_TO,
  SMTP_PROVIDER, SMTP_SECURE, SMTP_AUTH, SMTP_OAUTH_TOKEN, SMTP_TIMEOUT
  Also read from a .env file in the current directory.

{bold}Examples{reset}
  {dim}# check the login only; the provider is detected from the domain{reset}
  smtp-checker -u you@gmail.com -P "app password"

  {dim}# send a test message to yourself{reset}
  smtp-checker -u you@yandex.ru -P "..." --send

  {dim}# custom STARTTLS server, message to another address{reset}
  smtp-checker -H mail.mydomain.com --port 587 -u noreply@mydomain.com -P "..." -s -t me@example.com

  {dim}# which ports are open at all{reset}
  smtp-checker -H smtp.mail.ru --probe

  {dim}# in CI: quiet, exit-code driven{reset}
  SMTP_PASS="..." smtp-checker -u bot@example.com --json

{bold}Exit codes{reset}
  0 — success   1 — check failed   2 — bad arguments
`,
};

function helpText(lang, colorEnabled) {
  const c = makePalette(colorEnabled);
  const raw = HELP[lang] || HELP.en;
  return raw
    .replace(/\{bold\}(.*?)\{reset\}/g, (_, text) => c.bold(text))
    .replace(/\{dim\}(.*?)\{reset\}/g, (_, text) => c.dim(text));
}

module.exports = { helpText, HELP };
