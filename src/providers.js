'use strict';

/**
 * Реестр известных SMTP-провайдеров.
 * Registry of known SMTP providers.
 *
 * secure: true  -> implicit TLS (обычно порт 465)
 * secure: false -> plain + STARTTLS (обычно порт 587)
 */

const PROVIDERS = {
  gmail: {
    title: { ru: 'Gmail', en: 'Gmail' },
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['gmail.com', 'googlemail.com'],
    credentialsUrl: 'https://myaccount.google.com/apppasswords',
    docsUrl: 'https://support.google.com/mail/answer/7126229',
    notes: {
      ru: 'Обычный пароль не подойдёт: включите двухфакторную аутентификацию и создайте пароль приложения (16 символов). Аккаунты Google Workspace могут требовать разрешения SMTP AUTH от администратора.',
      en: 'A regular password will not work: enable 2-step verification and create a 16-character app password. Google Workspace accounts may need SMTP AUTH enabled by an admin.',
    },
  },

  yandex: {
    title: { ru: 'Яндекс Почта', en: 'Yandex Mail' },
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['yandex.ru', 'yandex.com', 'ya.ru', 'yandex.by', 'yandex.kz', 'yandex.ua', 'narod.ru'],
    credentialsUrl: 'https://id.yandex.ru/security/app-passwords',
    docsUrl: 'https://yandex.ru/support/mail/mail-clients/others.html',
    notes: {
      ru: 'Нужен пароль приложения, и в настройках Почты должен быть включён доступ по протоколам IMAP/SMTP. Логин — полный адрес; для Яндекс 360 с своим доменом это адрес вида user@ваш-домен.ru.',
      en: 'Requires an app password, and IMAP/SMTP access must be enabled in Mail settings. The login is the full address; for Yandex 360 custom domains it is user@your-domain.tld.',
    },
  },

  mailru: {
    title: { ru: 'Mail.ru', en: 'Mail.ru' },
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['mail.ru', 'inbox.ru', 'bk.ru', 'list.ru', 'internet.ru', 'mail.ua'],
    credentialsUrl: 'https://account.mail.ru/user/2-step-auth/passwords',
    docsUrl: 'https://help.mail.ru/mail/mailer/popsmtp',
    notes: {
      ru: 'Требуется пароль для внешнего приложения, созданный в настройках аккаунта. Основной пароль SMTP не примет.',
      en: 'Requires an application password created in account settings. The main password is rejected by SMTP.',
    },
  },

  outlook: {
    title: { ru: 'Outlook.com / Hotmail', en: 'Outlook.com / Hotmail' },
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    altPorts: [],
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'passport.com'],
    credentialsUrl: 'https://account.live.com/proofs/AppPassword',
    docsUrl: 'https://support.microsoft.com/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353',
    notes: {
      ru: 'Только STARTTLS на порту 587, порт 465 не работает. Microsoft отключает базовую аутентификацию: личным аккаунтам нужен пароль приложения, корпоративным — OAuth2 (--oauth).',
      en: 'STARTTLS on port 587 only; port 465 is not served. Microsoft is disabling basic auth: personal accounts need an app password, work accounts need OAuth2 (--oauth).',
    },
  },

  office365: {
    title: { ru: 'Microsoft 365 (рабочий)', en: 'Microsoft 365 (work)' },
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    altPorts: [],
    domains: [],
    docsUrl: 'https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission',
    notes: {
      ru: 'SMTP AUTH по умолчанию выключен на уровне тенанта и для каждого ящика — включается администратором. Basic auth отключён, используйте OAuth2 (--oauth).',
      en: 'SMTP AUTH is disabled by default per tenant and per mailbox — an admin must enable it. Basic auth is retired; use OAuth2 (--oauth).',
    },
  },

  icloud: {
    title: { ru: 'iCloud Mail', en: 'iCloud Mail' },
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    altPorts: [],
    domains: ['icloud.com', 'me.com', 'mac.com'],
    credentialsUrl: 'https://account.apple.com/account/manage',
    docsUrl: 'https://support.apple.com/102525',
    notes: {
      ru: 'Обязателен пароль приложения Apple ID. Логин — часть адреса до @ либо полный адрес, в зависимости от аккаунта.',
      en: 'An Apple ID app-specific password is required. The username is the part before @ or the full address, depending on the account.',
    },
  },

  yahoo: {
    title: { ru: 'Yahoo Mail', en: 'Yahoo Mail' },
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com'],
    credentialsUrl: 'https://login.yahoo.com/account/security',
    notes: {
      ru: 'Нужен пароль приложения из раздела безопасности аккаунта.',
      en: 'Requires an app password from the account security section.',
    },
  },

  aol: {
    title: { ru: 'AOL Mail', en: 'AOL Mail' },
    host: 'smtp.aol.com',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['aol.com'],
    notes: {
      ru: 'Нужен пароль приложения.',
      en: 'Requires an app password.',
    },
  },

  zoho: {
    title: { ru: 'Zoho Mail', en: 'Zoho Mail' },
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['zoho.com', 'zohomail.com'],
    docsUrl: 'https://www.zoho.com/mail/help/zoho-smtp.html',
    notes: {
      ru: 'Для аккаунтов в ЕС используйте smtp.zoho.eu, в Индии — smtp.zoho.in (--host). При включённой 2FA нужен пароль приложения.',
      en: 'EU accounts use smtp.zoho.eu, India smtp.zoho.in (--host). With 2FA enabled an app password is required.',
    },
  },

  fastmail: {
    title: { ru: 'Fastmail', en: 'Fastmail' },
    host: 'smtp.fastmail.com',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['fastmail.com', 'fastmail.fm'],
    credentialsUrl: 'https://app.fastmail.com/settings/security/apppw',
    notes: {
      ru: 'Только пароли приложений с правом отправки почты.',
      en: 'App passwords with mail-send scope only.',
    },
  },

  gmx: {
    title: { ru: 'GMX', en: 'GMX' },
    host: 'mail.gmx.com',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['gmx.com', 'gmx.net', 'gmx.de'],
    notes: {
      ru: 'В настройках аккаунта нужно разрешить доступ по IMAP/SMTP.',
      en: 'IMAP/SMTP access must be enabled in account settings.',
    },
  },

  webde: {
    title: { ru: 'WEB.DE', en: 'WEB.DE' },
    host: 'smtp.web.de',
    port: 587,
    secure: false,
    altPorts: [465],
    domains: ['web.de'],
    notes: {
      ru: 'В настройках аккаунта нужно разрешить доступ по IMAP/SMTP.',
      en: 'IMAP/SMTP access must be enabled in account settings.',
    },
  },

  rambler: {
    title: { ru: 'Рамблер', en: 'Rambler' },
    host: 'smtp.rambler.ru',
    port: 465,
    secure: true,
    altPorts: [587],
    domains: ['rambler.ru', 'lenta.ru', 'autorambler.ru', 'myrambler.ru', 'ro.ru', 'rambler.ua'],
    notes: {
      ru: 'Логин — полный адрес, пароль — основной пароль аккаунта.',
      en: 'The login is the full address with the regular account password.',
    },
  },

  protonbridge: {
    title: { ru: 'Proton Mail Bridge (локально)', en: 'Proton Mail Bridge (local)' },
    host: '127.0.0.1',
    port: 1025,
    secure: false,
    altPorts: [],
    domains: [],
    docsUrl: 'https://proton.me/mail/bridge',
    notes: {
      ru: 'Работает только через локально запущенный Proton Mail Bridge и его самоподписанный сертификат — добавьте --insecure.',
      en: 'Works only through a locally running Proton Mail Bridge with a self-signed certificate — add --insecure.',
    },
  },

  sendgrid: {
    title: { ru: 'SendGrid', en: 'SendGrid' },
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    altPorts: [465, 2525],
    domains: [],
    defaultUser: 'apikey',
    docsUrl: 'https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api',
    notes: {
      ru: 'Логин всегда буквально apikey, пароль — сам API-ключ (SG.xxxx).',
      en: 'The username is literally apikey; the password is the API key itself (SG.xxxx).',
    },
  },

  mailgun: {
    title: { ru: 'Mailgun', en: 'Mailgun' },
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    altPorts: [465, 2525],
    domains: [],
    docsUrl: 'https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/#smtp',
    notes: {
      ru: 'Логин — postmaster@ваш-домен, пароль — SMTP-пароль домена. Для ЕС-региона хост smtp.eu.mailgun.org.',
      en: 'Username is postmaster@your-domain with the domain SMTP password. EU region uses smtp.eu.mailgun.org.',
    },
  },

  postmark: {
    title: { ru: 'Postmark', en: 'Postmark' },
    host: 'smtp.postmarkapp.com',
    port: 587,
    secure: false,
    altPorts: [2525],
    domains: [],
    docsUrl: 'https://postmarkapp.com/developer/user-guide/send-email-with-smtp',
    notes: {
      ru: 'И логин, и пароль — это Server API Token.',
      en: 'Both the username and the password are the Server API Token.',
    },
  },

  ses: {
    title: { ru: 'Amazon SES', en: 'Amazon SES' },
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    altPorts: [465, 2465, 2587],
    domains: [],
    docsUrl: 'https://docs.aws.amazon.com/ses/latest/dg/smtp-connect.html',
    notes: {
      ru: 'Подставьте свой регион через --host (например email-smtp.eu-central-1.amazonaws.com). Нужны отдельные SMTP-креды SES, а не ключи IAM. В песочнице получатель должен быть подтверждён.',
      en: 'Set your region via --host (e.g. email-smtp.eu-central-1.amazonaws.com). Use SES SMTP credentials, not raw IAM keys. In sandbox mode the recipient must be verified.',
    },
  },

  brevo: {
    title: { ru: 'Brevo (Sendinblue)', en: 'Brevo (Sendinblue)' },
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    altPorts: [465, 2525],
    domains: [],
    docsUrl: 'https://help.brevo.com/hc/articles/7924908994322',
    notes: {
      ru: 'Логин — e-mail аккаунта, пароль — SMTP-ключ из раздела SMTP & API.',
      en: 'Username is the account e-mail; the password is the SMTP key from the SMTP & API section.',
    },
  },

  mailjet: {
    title: { ru: 'Mailjet', en: 'Mailjet' },
    host: 'in-v3.mailjet.com',
    port: 587,
    secure: false,
    altPorts: [465, 25, 2525],
    domains: [],
    docsUrl: 'https://dev.mailjet.com/smtp-relay/configuration/',
    notes: {
      ru: 'Логин — API Key, пароль — Secret Key.',
      en: 'Username is the API Key, password is the Secret Key.',
    },
  },

  resend: {
    title: { ru: 'Resend', en: 'Resend' },
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    altPorts: [587, 2465, 2587],
    domains: [],
    defaultUser: 'resend',
    docsUrl: 'https://resend.com/docs/send-with-smtp',
    notes: {
      ru: 'Логин всегда resend, пароль — API-ключ (re_xxxx).',
      en: 'The username is always resend; the password is the API key (re_xxxx).',
    },
  },

  mailtrap: {
    title: { ru: 'Mailtrap (песочница)', en: 'Mailtrap (sandbox)' },
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    secure: false,
    altPorts: [25, 465, 587],
    domains: [],
    docsUrl: 'https://mailtrap.io/blog/smtp-settings/',
    notes: {
      ru: 'Тестовая песочница: письма никуда не уходят, а оседают в инбоксе Mailtrap. Логин и пароль берутся из настроек инбокса.',
      en: 'Test sandbox: messages are captured in the Mailtrap inbox instead of being delivered. Credentials come from the inbox settings.',
    },
  },

  mailhog: {
    title: { ru: 'MailHog / Mailpit (локально)', en: 'MailHog / Mailpit (local)' },
    host: '127.0.0.1',
    port: 1025,
    secure: false,
    altPorts: [],
    domains: [],
    noAuth: true,
    notes: {
      ru: 'Локальная ловушка писем для разработки, обычно без аутентификации и без TLS — используйте --no-auth.',
      en: 'A local mail catcher for development, usually without authentication or TLS — use --no-auth.',
    },
  },
};

/** Все ключи провайдеров. / All provider keys. */
function listProviders() {
  return Object.keys(PROVIDERS);
}

/** Провайдер по ключу (регистр не важен). / Provider by key (case-insensitive). */
function getProvider(key) {
  if (!key) return null;
  const normalized = String(key).toLowerCase().replace(/[\s._-]/g, '');
  const aliases = {
    google: 'gmail',
    googlemail: 'gmail',
    ya: 'yandex',
    yandexmail: 'yandex',
    mail: 'mailru',
    hotmail: 'outlook',
    live: 'outlook',
    o365: 'office365',
    microsoft365: 'office365',
    exchange: 'office365',
    apple: 'icloud',
    amazonses: 'ses',
    aws: 'ses',
    sendinblue: 'brevo',
    proton: 'protonbridge',
    protonmail: 'protonbridge',
    mailpit: 'mailhog',
  };
  const id = aliases[normalized] || normalized;
  return PROVIDERS[id] ? { id, ...PROVIDERS[id] } : null;
}

/** Провайдер по домену e-mail. / Provider guessed from an e-mail domain. */
function detectProvider(email) {
  if (!email || typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return null;
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (p.domains && p.domains.includes(domain)) return { id, ...p, detectedFrom: domain };
  }
  return null;
}

module.exports = { PROVIDERS, listProviders, getProvider, detectProvider };
