'use strict';

const crypto = require('crypto');

/**
 * Механизмы аутентификации SMTP.
 * SMTP authentication mechanisms.
 *
 * Порядок предпочтения: чем безопаснее и надёжнее, тем раньше.
 */
const PREFERENCE = ['XOAUTH2', 'CRAM-MD5', 'PLAIN', 'LOGIN'];

const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');

/** Выбрать механизм: явно заданный, либо лучший из предложенных сервером. */
function chooseMechanism({ offered = [], preferred = null, hasOAuth = false }) {
  const available = offered.map((m) => m.toUpperCase());
  if (preferred) {
    const wanted = preferred.toUpperCase();
    return { mechanism: wanted, advertised: available.includes(wanted) };
  }
  if (hasOAuth) return { mechanism: 'XOAUTH2', advertised: available.includes('XOAUTH2') };
  const usable = PREFERENCE.filter((m) => m !== 'XOAUTH2');
  const picked = usable.find((m) => available.includes(m));
  // Сервер может не анонсировать AUTH до STARTTLS — тогда пробуем PLAIN.
  return { mechanism: picked || 'PLAIN', advertised: Boolean(picked) };
}

/** Строка AUTH PLAIN: base64("\0user\0pass"). */
function plainToken(user, pass) {
  return Buffer.from(`\0${user}\0${pass}`, 'utf8').toString('base64');
}

/** Строка XOAUTH2: base64("user=<user>^Aauth=Bearer <token>^A^A"). */
function xoauth2Token(user, accessToken) {
  return Buffer.from(`user=${user}\x01auth=Bearer ${accessToken}\x01\x01`, 'utf8').toString('base64');
}

/** Ответ CRAM-MD5 на challenge сервера. */
function cramMd5Response(user, pass, challengeBase64) {
  const challenge = Buffer.from(challengeBase64, 'base64').toString('utf8');
  const digest = crypto.createHmac('md5', pass).update(challenge).digest('hex');
  return b64(`${user} ${digest}`);
}

/**
 * Выполнить аутентификацию. Бросает ошибку с .smtp при отказе.
 * @returns {Promise<{mechanism: string, reply: object}>}
 */
async function authenticate(client, { user, pass, accessToken, mechanism }) {
  const mech = mechanism.toUpperCase();

  if (mech === 'PLAIN') {
    const reply = await client.command(`AUTH PLAIN ${plainToken(user, pass)}`, { expect: 235, redact: true });
    return { mechanism: mech, reply };
  }

  if (mech === 'LOGIN') {
    await client.command('AUTH LOGIN', { expect: 334 });
    client.write(b64(user), { redact: true });
    const promptForPassword = await client.read();
    if (promptForPassword.code !== 334) {
      const err = new Error('auth rejected');
      err.smtp = promptForPassword;
      throw err;
    }
    client.write(b64(pass), { redact: true });
    const reply = await client.read();
    if (reply.code !== 235) {
      const err = new Error('auth rejected');
      err.smtp = reply;
      throw err;
    }
    return { mechanism: mech, reply };
  }

  if (mech === 'CRAM-MD5') {
    const challenge = await client.command('AUTH CRAM-MD5', { expect: 334 });
    client.write(cramMd5Response(user, pass, challenge.lines[0].slice(4).trim()), { redact: true });
    const reply = await client.read();
    if (reply.code !== 235) {
      const err = new Error('auth rejected');
      err.smtp = reply;
      throw err;
    }
    return { mechanism: mech, reply };
  }

  if (mech === 'XOAUTH2') {
    client.write(`AUTH XOAUTH2 ${xoauth2Token(user, accessToken)}`, { redact: true });
    let reply = await client.read();
    if (reply.code === 334) {
      // Сервер вернул JSON с описанием ошибки — подтверждаем пустой строкой, чтобы получить финальный код.
      client.write('');
      reply = await client.read();
    }
    if (reply.code !== 235) {
      const err = new Error('auth rejected');
      err.smtp = reply;
      throw err;
    }
    return { mechanism: mech, reply };
  }

  const err = new Error(`unsupported mechanism ${mech}`);
  err.unsupported = true;
  throw err;
}

module.exports = { PREFERENCE, chooseMechanism, authenticate, plainToken, xoauth2Token, cramMd5Response };
