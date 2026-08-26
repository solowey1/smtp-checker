# smtp-checker

[Русский](README.ru.md) · **English**

A console tool that answers one question in a couple of seconds: *is SMTP actually working?*
It connects to the server, checks TLS and the certificate, authenticates, optionally sends a test message — and shows the whole SMTP dialogue when something goes wrong.

[![CI](https://github.com/solowey1/smtp-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/solowey1/smtp-checker/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20.10-brightgreen)
![Dependencies](https://img.shields.io/badge/dependencies-0-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

```
SMTP check
  Provider: Gmail (detected from domain gmail.com)
  Server:   smtp.gmail.com:465 (implicit TLS)
  Login:    me@gmail.com

  TCP connection                     ✓ ok  38 ms
  TLS handshake                      ✓ ok  TLSv1.3, TLS_AES_256_GCM_SHA384, CN=smtp.gmail.com
  Server greeting                    ✓ ok  220 smtp.gmail.com ESMTP
  EHLO and capabilities              ✓ ok  AUTH: LOGIN PLAIN XOAUTH2 | SIZE 35882577
  Authentication                     ✓ ok  PLAIN
  Sending message                    ✓ ok  accepted: 250 2.0.0 OK

  Certificate: smtp.gmail.com, issued by Google Trust Services, valid for 68 more days
  AUTH mechanisms: LOGIN, PLAIN, XOAUTH2
  Max message size: 34.2 MB

✓ SMTP works: a test message was sent to me@gmail.com. took 1204 ms
```

## Why

When mail "doesn't send", the cause is almost always one of five things: a blocked port, the wrong encryption mode, an expired certificate, a rejected password, or the server refusing to relay. This tool walks through all of them in order and tells you exactly which step broke — instead of an `Error: connection closed` buried somewhere in your app.

## Features

- **Zero dependencies** — built-in Node modules only (`net`, `tls`, `crypto`). Nothing to install, easy to audit.
- **23 provider presets**: Gmail, Yandex, Mail.ru, Outlook, Microsoft 365, iCloud, Yahoo, Zoho, Fastmail, SendGrid, Mailgun, Postmark, Amazon SES, Brevo, Mailjet, Resend, Mailtrap and more.
- **Provider auto-detection** from the e-mail domain: pass `-u me@bk.ru` and the host and port are filled in for you.
- **Both encryption modes**: implicit TLS (465) and STARTTLS (587/25), reporting the TLS version, cipher, and certificate expiry.
- **All common AUTH mechanisms**: PLAIN, LOGIN, CRAM-MD5, XOAUTH2.
- **Real message delivery** with correct UTF-8 MIME — behind `--send`, never by default.
- **Diagnostics instead of stack traces**: a plain-language cause and a hint about what to do.
- **CI-friendly**: `--json`, meaningful exit codes, configuration from environment variables and `.env`.
- **Bilingual output**: Russian and English (`--lang`).
- **Passwords stay hidden**: the verbose log prints `<hidden>` in their place.

## Quick start

Without installing:

```bash
npx github:solowey1/smtp-checker --user you@gmail.com --pass "app password"
```

Globally:

```bash
npm install -g smtp-checker
smtp-checker --user you@gmail.com --pass "app password"
```

From GitHub Packages (published as `@solowey1/smtp-checker`). The GitHub registry
requires authentication even for public packages, so you need a
[token](https://github.com/settings/tokens) with the `read:packages` scope:

```bash
# ~/.npmrc
@solowey1:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

```bash
npm install -g @solowey1/smtp-checker
```

From source:

```bash
git clone git@github.com:solowey1/smtp-checker.git
cd smtp-checker
node bin/smtp-checker.js --help
```

Requires Node.js 20.10 or newer. There are no runtime dependencies — `npm install`
is only needed for development (ESLint).

## Usage

### Verify that the credentials work

```bash
smtp-checker -u you@yandex.ru -P "app-password"
```

No message is sent — connection, TLS and `AUTH` only. The provider is detected from the domain.

### Send a test message to yourself

```bash
smtp-checker -u you@yandex.ru -P "app-password" --send
```

### Send to another address

```bash
smtp-checker -u you@gmail.com -P "..." --send --to friend@example.com
```

### A custom server

```bash
smtp-checker --host mail.mydomain.com --port 587 -u noreply@mydomain.com -P "..." --send
```

Port 465 means implicit TLS; ports 587 and 25 mean STARTTLS. Override with `--secure` or `--starttls`.

### Find out which ports are reachable

Useful when an ISP or a cloud provider filters outbound connections:

```bash
smtp-checker --provider mailru --probe
```

```
  25      ✓ open  902 ms  220 smtp.mail.ru ESMTP ready
  465     ✓ open  1127 ms 220 smtp.mail.ru ESMTP ready
  587     ✓ open  872 ms  220 smtp.mail.ru ESMTP ready
  2525    ✓ open  886 ms  220 smtp.mail.ru ESMTP ready
```

### See the full SMTP dialogue

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

### Local mail catchers (MailHog, Mailpit, Mailtrap)

```bash
smtp-checker --provider mailhog --no-auth --send --from dev@localhost --to test@localhost
```

## Supplying the password

Three ways, most secure first:

```bash
# 1. Hidden prompt: nothing ends up in your shell history
smtp-checker -u you@example.com

# 2. Environment variable
SMTP_PASS="..." smtp-checker -u you@example.com

# 3. As an argument — convenient, but recorded in shell history
smtp-checker -u you@example.com -P "..."
```

You can also drop the settings into a `.env` file next to you — it is read automatically and never overrides real environment variables. Template: [.env.example](.env.example).

## Supported providers

`smtp-checker --list` prints the same table in your terminal.

| Key | Provider | Server | Mode | Auto-detected domains |
| --- | --- | --- | --- | --- |
| `gmail` | Gmail | `smtp.gmail.com:465` | TLS | gmail.com, googlemail.com |
| `yandex` | Yandex Mail | `smtp.yandex.ru:465` | TLS | yandex.ru, yandex.com, ya.ru, yandex.by, yandex.kz, narod.ru |
| `mailru` | Mail.ru | `smtp.mail.ru:465` | TLS | mail.ru, inbox.ru, bk.ru, list.ru, internet.ru |
| `outlook` | Outlook.com / Hotmail | `smtp-mail.outlook.com:587` | STARTTLS | outlook.com, hotmail.com, live.com, msn.com |
| `office365` | Microsoft 365 (work) | `smtp.office365.com:587` | STARTTLS | — |
| `icloud` | iCloud Mail | `smtp.mail.me.com:587` | STARTTLS | icloud.com, me.com, mac.com |
| `yahoo` | Yahoo Mail | `smtp.mail.yahoo.com:465` | TLS | yahoo.com, yahoo.co.uk, ymail.com, rocketmail.com |
| `aol` | AOL Mail | `smtp.aol.com:465` | TLS | aol.com |
| `zoho` | Zoho Mail | `smtp.zoho.com:465` | TLS | zoho.com, zohomail.com |
| `fastmail` | Fastmail | `smtp.fastmail.com:465` | TLS | fastmail.com, fastmail.fm |
| `gmx` | GMX | `mail.gmx.com:465` | TLS | gmx.com, gmx.net, gmx.de |
| `webde` | WEB.DE | `smtp.web.de:587` | STARTTLS | web.de |
| `rambler` | Rambler | `smtp.rambler.ru:465` | TLS | rambler.ru, lenta.ru, myrambler.ru, ro.ru |
| `protonbridge` | Proton Mail Bridge | `127.0.0.1:1025` | STARTTLS | — |
| `sendgrid` | SendGrid | `smtp.sendgrid.net:587` | STARTTLS | — |
| `mailgun` | Mailgun | `smtp.mailgun.org:587` | STARTTLS | — |
| `postmark` | Postmark | `smtp.postmarkapp.com:587` | STARTTLS | — |
| `ses` | Amazon SES | `email-smtp.us-east-1.amazonaws.com:587` | STARTTLS | — |
| `brevo` | Brevo (Sendinblue) | `smtp-relay.brevo.com:587` | STARTTLS | — |
| `mailjet` | Mailjet | `in-v3.mailjet.com:587` | STARTTLS | — |
| `resend` | Resend | `smtp.resend.com:465` | TLS | — |
| `mailtrap` | Mailtrap (sandbox) | `sandbox.smtp.mailtrap.io:2525` | STARTTLS | — |
| `mailhog` | MailHog / Mailpit | `127.0.0.1:1025` | STARTTLS | — |

If your provider is not listed, just pass `--host` and `--port`. Keys accept aliases too: `google`, `hotmail`, `sendinblue`, `aws`, `mailpit` and others.

### Provider quirks

| Provider | What to know |
| --- | --- |
| Gmail | A regular password will not work: enable 2-step verification and create an [app password](https://myaccount.google.com/apppasswords). |
| Yandex | Needs an [app password](https://id.yandex.ru/security/app-passwords) plus IMAP/SMTP access enabled in Mail settings. |
| Mail.ru | Needs an application password created in account settings. |
| Outlook / Microsoft 365 | Port 587 (STARTTLS) only; 465 is not served. Basic auth is being retired — use `--oauth`, and for work tenants an admin must enable SMTP AUTH. |
| iCloud | An Apple ID app-specific password is required. |
| SendGrid | The username is always `apikey`; the password is the API key. |
| Postmark | Both the username and the password are the Server API Token. |
| Amazon SES | Point `--host` at your region; use SES SMTP credentials, not IAM keys. |
| Resend | The username is always `resend`; the password is the `re_...` API key. |

## All options

### Where to connect

| Option | Description |
| --- | --- |
| `-p, --provider <key>` | provider preset (see `--list`) |
| `-H, --host <host>` | SMTP server explicitly |
| `--port <port>` | port: 465 for implicit TLS, 587/25 for STARTTLS |
| `--secure` | force implicit TLS |
| `--starttls` | force STARTTLS |
| `--plain` | no encryption (local servers only) |
| `--insecure` | skip certificate validation (self-signed) |

### Credentials

| Option | Description |
| --- | --- |
| `-u, --user <login>` | username, usually the full e-mail |
| `-P, --pass <password>` | password; omit it and you get a hidden prompt |
| `--auth <mechanism>` | `PLAIN`, `LOGIN`, `CRAM-MD5` or `XOAUTH2` |
| `--oauth <token>` | access token for XOAUTH2 |
| `--no-auth` | skip authentication |

### Sending a message

| Option | Description |
| --- | --- |
| `-s, --send` | send a test message |
| `-f, --from <address>` | sender (defaults to `--user`) |
| `-t, --to <address>` | recipient (defaults to `--from`) |
| `--subject <text>` | custom subject |
| `--text <body>` | custom body |

### Modes and output

| Option | Description |
| --- | --- |
| `-l, --list` | list providers |
| `--probe` | check which ports are reachable (25/465/587/2525) |
| `--ports <list>` | custom comma-separated ports for `--probe` |
| `--dry-run` | print resolved settings and exit |
| `-j, --json` | machine-readable result |
| `-v, --verbose` | full SMTP dialogue |
| `-q, --quiet` | exit code only |
| `--no-color` | disable ANSI colors |
| `--lang <ru\|en>` | output language |
| `--timeout <ms>` | timeout, default 20000 |
| `--helo <name>` | hostname used in EHLO |
| `-h, --help` | help |
| `-V, --version` | version |

### Environment variables

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TO`, `SMTP_PROVIDER`, `SMTP_SECURE`, `SMTP_AUTH`, `SMTP_OAUTH_TOKEN`, `SMTP_TIMEOUT`, `SMTP_HELO`, `SMTP_CHECKER_LANG`.

Command-line arguments beat environment variables, which beat `.env`.

## In CI and scripts

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | the check passed |
| `1` | the check failed (no connection, auth rejected, message not accepted) |
| `2` | bad arguments |

```yaml
- name: Verify SMTP before deploy
  env:
    SMTP_PASS: ${{ secrets.SMTP_PASS }}
  run: npx github:solowey1/smtp-checker -u bot@example.com --json --lang en
```

The `--json` shape:

```json
{
  "ok": true,
  "provider": "gmail",
  "host": "smtp.gmail.com",
  "port": 465,
  "mode": "implicit",
  "tls": { "protocol": "TLSv1.3", "cipher": "TLS_AES_256_GCM_SHA384", "subject": "smtp.gmail.com", "validTo": "..." },
  "capabilities": { "auth": ["LOGIN", "PLAIN", "XOAUTH2"], "starttls": true, "size": 35882577 },
  "auth": { "mechanism": "PLAIN", "ok": true },
  "message": { "to": "me@gmail.com", "messageId": "<...>", "size": 512, "response": "2.0.0 OK" },
  "steps": [{ "id": "connect", "status": "ok", "ms": 38, "detail": "38 ms" }],
  "error": null,
  "elapsedMs": 1204
}
```

## Programmatic API

```js
const { checkSmtp } = require('smtp-checker');

const result = await checkSmtp({
  user: 'you@gmail.com',
  pass: process.env.SMTP_PASS,
  send: true,
  to: 'friend@example.com',
  lang: 'en',
});

if (!result.ok) {
  console.error(result.error.message, result.error.hints);
}
```

`runCheck`, `probePorts`, `resolveConfig`, `SmtpClient`, `buildTestMessage`, `getProvider`, `detectProvider` and the `PROVIDERS` registry are exported as well, so you can assemble your own check.

## What the errors mean

| What you see | Cause | What to do |
| --- | --- | --- |
| `ECONNREFUSED` | the port is closed server-side | try another port; `--probe` shows which ones are open |
| `ETIMEDOUT` while connecting | the port is filtered by an ISP, firewall or cloud | change the port (25 is blocked almost everywhere) or the network |
| `wrong version number` | encryption mode does not match the port | 465 means `--secure`, 587 means `--starttls` |
| `SELF_SIGNED_CERT_IN_CHAIN` | self-signed certificate | add `--insecure` for a local server |
| `535` | password rejected | you likely need an app password, not the account password |
| `530` | the server demands authentication or TLS | supply credentials or switch the encryption mode |
| `550` / `554` | the server refused to relay | the `--from` address must belong to your account |
| `553` | sender not verified | use the mailbox you authenticated with |
| `421` / `45x` | rate limit or temporary overload | wait and retry |

## How it works

1. TCP connection; on port 465 TLS starts immediately.
2. Read the `220` greeting.
3. `EHLO` (falling back to `HELO`) and parse the capabilities: `STARTTLS`, `AUTH`, `SIZE`, `8BITMIME`.
4. For STARTTLS — upgrade the socket and re-issue `EHLO`.
5. `AUTH` with the requested or best available mechanism.
6. With `--send` — `MAIL FROM` → `RCPT TO` → `DATA` → base64 body with dot-stuffing → `QUIT`.

The whole protocol is about 800 lines on bare `net` and `tls`, no wrappers: [src/client.js](src/client.js), [src/check.js](src/check.js), [src/auth.js](src/auth.js) and [src/message.js](src/message.js).

## Security

- The password is never printed: `--verbose` shows `<hidden>`, and `--json` omits it entirely.
- Certificates are validated by default; validation is skipped only with an explicit `--insecure`.
- Unencrypted sessions require an explicit `--plain` and print a warning.
- `.env` is git-ignored; only `.env.example` is committed.

## Development

```bash
npm ci            # dev dependencies only: ESLint
npm test          # 49 tests: unit plus integration against a fake SMTP server
npm run lint      # ESLint
npm run list      # list providers
npm run help      # show help
```

The tests never touch the network: [test/helpers/fake-server.js](test/helpers/fake-server.js) spins up a local SMTP server that fails the same way real ones do.

Adding a provider is one entry in [src/providers.js](src/providers.js): host, port, mode, domains and a note in both languages. Pull requests welcome.

## License

[MIT](LICENSE)
