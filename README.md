# smtp-checker

**Русский** · [English](README.en.md)

Консольная утилита, которая за пару секунд отвечает на вопрос «а SMTP-то вообще работает?».
Подключается к серверу, проверяет TLS и сертификат, логинится, при желании отправляет тестовое письмо — и показывает весь диалог с сервером, если что-то пошло не так.

[![CI](https://github.com/solowey1/smtp-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/solowey1/smtp-checker/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20.10-brightgreen)
![Зависимости](https://img.shields.io/badge/%D0%B7%D0%B0%D0%B2%D0%B8%D1%81%D0%B8%D0%BC%D0%BE%D1%81%D1%82%D0%B8-0-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

```
Проверка SMTP
  Провайдер: Яндекс Почта (определён по домену yandex.ru)
  Сервер:   smtp.yandex.ru:465 (implicit TLS)
  Логин:    me@yandex.ru

  TCP-подключение                    ✓ ок  38 ms
  TLS-рукопожатие                    ✓ ок  TLSv1.3, TLS_AES_256_GCM_SHA384, CN=smtp.yandex.ru
  Приветствие сервера                ✓ ок  220 mail-nwsmtp... Ok
  EHLO и возможности                 ✓ ок  AUTH: LOGIN PLAIN XOAUTH2 | STARTTLS | SIZE 53477376
  Аутентификация                     ✓ ок  PLAIN
  Отправка письма                    ✓ ок  принято: 250 2.0.0 Ok: queued

  Сертификат: smtp.yandex.ru, выдан GlobalSign nv-sa, действителен ещё 74 дн.
  Механизмы AUTH: LOGIN, PLAIN, XOAUTH2
  Макс. размер письма: 51.0 MB

✓ SMTP работает: письмо отправлено на me@yandex.ru. заняло 1204 мс
```

## Зачем это нужно

Когда почта «не отправляется», причина почти всегда в одном из пяти мест: закрыт порт, не тот режим шифрования, протух сертификат, не принят пароль или сервер отказался пересылать письмо. Утилита проверяет всё это по очереди и говорит, на каком именно шаге всё сломалось — вместо `Error: connection closed` где-то в недрах приложения.

## Возможности

- **Ноль зависимостей** — только встроенные модули Node (`net`, `tls`, `crypto`). Ставить нечего, аудировать легко.
- **23 готовых пресета** провайдеров: Gmail, Яндекс, Mail.ru, Outlook, Microsoft 365, iCloud, Yahoo, Zoho, Fastmail, SendGrid, Mailgun, Postmark, Amazon SES, Brevo, Mailjet, Resend, Mailtrap и другие.
- **Автоопределение провайдера** по домену e-mail: `-u me@bk.ru` — и хост с портом подставятся сами.
- **Оба режима шифрования**: implicit TLS (465) и STARTTLS (587/25), с показом версии TLS, шифра и срока сертификата.
- **Все распространённые механизмы AUTH**: PLAIN, LOGIN, CRAM-MD5, XOAUTH2.
- **Отправка настоящего письма** с корректным UTF-8 MIME — по флагу `--send`, не по умолчанию.
- **Диагностика вместо стектрейсов**: понятная причина ошибки и подсказка, что делать.
- **Для CI**: `--json`, честные коды возврата, чтение настроек из переменных окружения и `.env`.
- **Двуязычный вывод**: русский и английский (`--lang`).
- **Пароль не светится**: в подробном логе на его месте `<hidden>`.

## Быстрый старт

Без установки:

```bash
npx github:solowey1/smtp-checker --user you@gmail.com --pass "пароль приложения"
```

Глобально:

```bash
npm install -g smtp-checker
smtp-checker --user you@gmail.com --pass "пароль приложения"
```

Из GitHub Packages (пакет `@solowey1/smtp-checker`). Реестр GitHub требует
аутентификации даже для публичных пакетов, поэтому нужен
[токен](https://github.com/settings/tokens) с правом `read:packages`:

```bash
# ~/.npmrc
@solowey1:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ВАШ_ТОКЕН
```

```bash
npm install -g @solowey1/smtp-checker
```

Из исходников:

```bash
git clone git@github.com:solowey1/smtp-checker.git
cd smtp-checker
node bin/smtp-checker.js --help
```

Нужен Node.js 20.10 или новее. Runtime-зависимостей нет — `npm install` нужен
только для разработки (ESLint).

## Как пользоваться

### Проверить, что логин и пароль подходят

```bash
smtp-checker -u you@yandex.ru -P "пароль-приложения"
```

Письмо при этом **не отправляется** — только подключение, TLS и `AUTH`. Провайдер определяется по домену.

### Отправить тестовое письмо себе

```bash
smtp-checker -u you@yandex.ru -P "пароль-приложения" --send
```

### Отправить на другой адрес

```bash
smtp-checker -u you@gmail.com -P "..." --send --to друг@example.com
```

### Свой сервер

```bash
smtp-checker --host mail.mydomain.ru --port 587 -u noreply@mydomain.ru -P "..." --send
```

Порт 465 включает implicit TLS, порты 587 и 25 — STARTTLS. Переопределить можно флагами `--secure` и `--starttls`.

### Понять, какие порты вообще открыты

Полезно, когда провайдер интернета или облако режут исходящие соединения:

```bash
smtp-checker --provider mailru --probe
```

```
  25      ✓ открыт  902 ms  220 smtp.mail.ru ESMTP ready
  465     ✓ открыт  1127 ms 220 smtp.mail.ru ESMTP ready
  587     ✓ открыт  872 ms  220 smtp.mail.ru ESMTP ready
  2525    ✓ открыт  886 ms  220 smtp.mail.ru ESMTP ready
```

### Посмотреть весь диалог с сервером

```bash
smtp-checker -u you@gmail.com -P "..." --verbose
```

```
    C: EHLO my-laptop.local
    S: 250-smtp.gmail.com at your service
    S: 250-SIZE 35882577
    S: 250 STARTTLS
    C: AUTH PLAIN <hidden>
    S: 235 2.7.0 Accepted
```

### Локальная ловушка писем (MailHog, Mailpit, Mailtrap)

```bash
smtp-checker --provider mailhog --no-auth --send --from dev@localhost --to test@localhost
```

## Ввод пароля

Три способа, по убыванию безопасности:

```bash
# 1. Скрытый ввод: утилита спросит сама, в истории команд ничего не останется
smtp-checker -u you@example.com

# 2. Переменная окружения
SMTP_PASS="..." smtp-checker -u you@example.com

# 3. Аргументом — удобно, но попадёт в историю shell
smtp-checker -u you@example.com -P "..."
```

Ещё можно положить настройки в `.env` рядом с собой — файл читается автоматически, реальные переменные окружения он не перетирает. Шаблон: [.env.example](.env.example).

## Поддерживаемые провайдеры

`smtp-checker --list` покажет этот же список в терминале.

| Ключ | Провайдер | Сервер | Режим | Домены для автоопределения |
| --- | --- | --- | --- | --- |
| `gmail` | Gmail | `smtp.gmail.com:465` | TLS | gmail.com, googlemail.com |
| `yandex` | Яндекс Почта | `smtp.yandex.ru:465` | TLS | yandex.ru, yandex.com, ya.ru, yandex.by, yandex.kz, yandex.ua, narod.ru |
| `mailru` | Mail.ru | `smtp.mail.ru:465` | TLS | mail.ru, inbox.ru, bk.ru, list.ru, internet.ru, mail.ua |
| `outlook` | Outlook.com / Hotmail | `smtp-mail.outlook.com:587` | STARTTLS | outlook.com, hotmail.com, live.com, msn.com |
| `office365` | Microsoft 365 (рабочий) | `smtp.office365.com:587` | STARTTLS | — |
| `icloud` | iCloud Mail | `smtp.mail.me.com:587` | STARTTLS | icloud.com, me.com, mac.com |
| `yahoo` | Yahoo Mail | `smtp.mail.yahoo.com:465` | TLS | yahoo.com, yahoo.co.uk, ymail.com, rocketmail.com |
| `aol` | AOL Mail | `smtp.aol.com:465` | TLS | aol.com |
| `zoho` | Zoho Mail | `smtp.zoho.com:465` | TLS | zoho.com, zohomail.com |
| `fastmail` | Fastmail | `smtp.fastmail.com:465` | TLS | fastmail.com, fastmail.fm |
| `gmx` | GMX | `mail.gmx.com:465` | TLS | gmx.com, gmx.net, gmx.de |
| `webde` | WEB.DE | `smtp.web.de:587` | STARTTLS | web.de |
| `rambler` | Рамблер | `smtp.rambler.ru:465` | TLS | rambler.ru, lenta.ru, myrambler.ru, ro.ru |
| `protonbridge` | Proton Mail Bridge | `127.0.0.1:1025` | STARTTLS | — |
| `sendgrid` | SendGrid | `smtp.sendgrid.net:587` | STARTTLS | — |
| `mailgun` | Mailgun | `smtp.mailgun.org:587` | STARTTLS | — |
| `postmark` | Postmark | `smtp.postmarkapp.com:587` | STARTTLS | — |
| `ses` | Amazon SES | `email-smtp.us-east-1.amazonaws.com:587` | STARTTLS | — |
| `brevo` | Brevo (Sendinblue) | `smtp-relay.brevo.com:587` | STARTTLS | — |
| `mailjet` | Mailjet | `in-v3.mailjet.com:587` | STARTTLS | — |
| `resend` | Resend | `smtp.resend.com:465` | TLS | — |
| `mailtrap` | Mailtrap (песочница) | `sandbox.smtp.mailtrap.io:2525` | STARTTLS | — |
| `mailhog` | MailHog / Mailpit | `127.0.0.1:1025` | STARTTLS | — |

Если провайдера в списке нет — просто укажите `--host` и `--port` вручную. Ключи понимают псевдонимы: `google`, `hotmail`, `sendinblue`, `aws`, `mailpit` и другие.

### Особенности отдельных провайдеров

| Провайдер | Что нужно знать |
| --- | --- |
| Gmail | Обычный пароль не подойдёт: включите двухфакторную аутентификацию и создайте [пароль приложения](https://myaccount.google.com/apppasswords). |
| Яндекс | Нужен [пароль приложения](https://id.yandex.ru/security/app-passwords), а в настройках Почты — включённый доступ по IMAP/SMTP. |
| Mail.ru | Нужен пароль для внешнего приложения из настроек аккаунта. |
| Outlook / Microsoft 365 | Только порт 587 (STARTTLS), 465 не обслуживается. Basic auth отключается — используйте `--oauth`, а для рабочих тенантов SMTP AUTH включает администратор. |
| iCloud | Обязателен пароль приложения Apple ID. |
| SendGrid | Логин всегда `apikey`, пароль — сам API-ключ. |
| Postmark | И логин, и пароль — это Server API Token. |
| Amazon SES | Свой регион подставляется через `--host`; нужны SMTP-креды SES, а не ключи IAM. |
| Resend | Логин всегда `resend`, пароль — API-ключ `re_...`. |

## Все параметры

### Куда подключаться

| Параметр | Описание |
| --- | --- |
| `-p, --provider <ключ>` | пресет провайдера (`--list` покажет все) |
| `-H, --host <хост>` | SMTP-сервер вручную |
| `--port <порт>` | порт: 465 — TLS сразу, 587/25 — STARTTLS |
| `--secure` | принудительно implicit TLS |
| `--starttls` | принудительно STARTTLS |
| `--plain` | без шифрования (только для локальных серверов) |
| `--insecure` | не проверять сертификат (самоподписанные) |

### Учётные данные

| Параметр | Описание |
| --- | --- |
| `-u, --user <логин>` | логин, обычно полный e-mail |
| `-P, --pass <пароль>` | пароль; без него утилита спросит скрытым вводом |
| `--auth <механизм>` | `PLAIN`, `LOGIN`, `CRAM-MD5` или `XOAUTH2` |
| `--oauth <токен>` | access token для XOAUTH2 |
| `--no-auth` | не аутентифицироваться |

### Отправка письма

| Параметр | Описание |
| --- | --- |
| `-s, --send` | отправить тестовое письмо |
| `-f, --from <адрес>` | отправитель (по умолчанию `--user`) |
| `-t, --to <адрес>` | получатель (по умолчанию `--from`) |
| `--subject <тема>` | своя тема |
| `--text <текст>` | своё тело письма |

### Режимы и вывод

| Параметр | Описание |
| --- | --- |
| `-l, --list` | список провайдеров |
| `--probe` | проверить открытые порты (25/465/587/2525) |
| `--ports <список>` | свои порты для `--probe`, через запятую |
| `--dry-run` | показать итоговые настройки и выйти |
| `-j, --json` | машинночитаемый результат |
| `-v, --verbose` | весь диалог с сервером |
| `-q, --quiet` | только код возврата |
| `--no-color` | без ANSI-цветов |
| `--lang <ru\|en>` | язык вывода |
| `--timeout <мс>` | таймаут, по умолчанию 20000 |
| `--helo <имя>` | имя хоста для EHLO |
| `-h, --help` | справка |
| `-V, --version` | версия |

### Переменные окружения

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TO`, `SMTP_PROVIDER`, `SMTP_SECURE`, `SMTP_AUTH`, `SMTP_OAUTH_TOKEN`, `SMTP_TIMEOUT`, `SMTP_HELO`, `SMTP_CHECKER_LANG`.

Аргументы командной строки важнее переменных окружения, а те — важнее `.env`.

## В CI и скриптах

Коды возврата:

| Код | Значение |
| --- | --- |
| `0` | проверка прошла |
| `1` | проверка не прошла (нет связи, отказ аутентификации, письмо не принято) |
| `2` | ошибка в параметрах запуска |

```yaml
- name: Проверить SMTP перед деплоем
  env:
    SMTP_PASS: ${{ secrets.SMTP_PASS }}
  run: npx github:solowey1/smtp-checker -u bot@example.com --json --lang en
```

Формат `--json`:

```json
{
  "ok": true,
  "provider": "yandex",
  "host": "smtp.yandex.ru",
  "port": 465,
  "mode": "implicit",
  "tls": { "protocol": "TLSv1.3", "cipher": "TLS_AES_256_GCM_SHA384", "subject": "smtp.yandex.ru", "validTo": "..." },
  "capabilities": { "auth": ["LOGIN", "PLAIN", "XOAUTH2"], "starttls": true, "size": 53477376 },
  "auth": { "mechanism": "PLAIN", "ok": true },
  "message": { "to": "me@yandex.ru", "messageId": "<...>", "size": 512, "response": "2.0.0 Ok: queued" },
  "steps": [{ "id": "connect", "status": "ok", "ms": 38, "detail": "38 ms" }],
  "error": null,
  "elapsedMs": 1204
}
```

## Программный интерфейс

```js
const { checkSmtp } = require('smtp-checker');

const result = await checkSmtp({
  user: 'you@yandex.ru',
  pass: process.env.SMTP_PASS,
  send: true,
  to: 'friend@example.com',
  lang: 'ru',
});

if (!result.ok) {
  console.error(result.error.message, result.error.hints);
}
```

Экспортируются также `runCheck`, `probePorts`, `resolveConfig`, `SmtpClient`, `buildTestMessage`, `getProvider`, `detectProvider` и реестр `PROVIDERS` — из них можно собрать свою проверку.

## Что означают ошибки

| Что видно | Причина | Что делать |
| --- | --- | --- |
| `ECONNREFUSED` | порт закрыт на стороне сервера | попробуйте другой порт: `--probe` покажет, какие открыты |
| `ETIMEDOUT` при подключении | порт режет провайдер, файрвол или облако | смените порт (25 закрыт почти везде) или сеть |
| `wrong version number` | режим шифрования не совпал с портом | 465 — это `--secure`, 587 — `--starttls` |
| `SELF_SIGNED_CERT_IN_CHAIN` | самоподписанный сертификат | для локального сервера добавьте `--insecure` |
| `535` | пароль не принят | нужен пароль приложения, а не пароль от аккаунта |
| `530` | сервер требует аутентификацию или TLS | добавьте учётные данные или смените режим шифрования |
| `550` / `554` | сервер отказался пересылать письмо | адрес в `--from` должен принадлежать вашему аккаунту |
| `553` | отправитель не подтверждён | используйте адрес ящика, под которым вошли |
| `421` / `45x` | лимит или временная перегрузка | подождите и повторите |

## Как это работает

1. TCP-подключение; на порту 465 сразу TLS.
2. Чтение приветствия `220`.
3. `EHLO` (с откатом на `HELO`) и разбор возможностей: `STARTTLS`, `AUTH`, `SIZE`, `8BITMIME`.
4. При STARTTLS — апгрейд сокета и повторный `EHLO`.
5. `AUTH` выбранным или лучшим доступным механизмом.
6. При `--send` — `MAIL FROM` → `RCPT TO` → `DATA` → тело в base64 с экранированием точек → `QUIT`.

Весь протокол — около 800 строк на голых `net` и `tls`, без обёрток: [src/client.js](src/client.js), [src/check.js](src/check.js), [src/auth.js](src/auth.js) и [src/message.js](src/message.js).

## Безопасность

- Пароль никогда не печатается: в `--verbose` вместо него `<hidden>`, в `--json` его нет.
- Сертификаты проверяются по умолчанию; отключить можно только явным `--insecure`.
- Без шифрования утилита работает только по явному `--plain` и предупреждает об этом.
- `.env` в `.gitignore`, в репозиторий попадает только `.env.example`.

## Разработка

```bash
npm ci            # только dev-зависимости: ESLint
npm test          # 49 тестов: юниты и интеграция против фейкового SMTP-сервера
npm run lint      # ESLint
npm run list      # список провайдеров
npm run help      # справка
```

Тесты не ходят в интернет: [test/helpers/fake-server.js](test/helpers/fake-server.js) поднимает локальный SMTP-сервер, который умеет ошибаться так же, как настоящие.

Добавить провайдера — одна запись в [src/providers.js](src/providers.js): хост, порт, режим, домены и заметка на двух языках. Pull request'ы приветствуются.

## Лицензия

[MIT](LICENSE)
