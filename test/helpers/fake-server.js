'use strict';

const net = require('net');

/**
 * Крошечный фальшивый SMTP-сервер для тестов.
 * A tiny fake SMTP server used by the tests.
 */
function startFakeServer({ user = 'user@example.com', pass = 'secret', capabilities = ['AUTH PLAIN LOGIN', 'SIZE 10485760', 'PIPELINING'], greeting = '220 fake.smtp ESMTP ready', supportsEhlo = true } = {}) {
  const received = [];

  const server = net.createServer((socket) => {
    let mode = 'command';
    let dataBuffer = '';
    let buffer = '';

    socket.setEncoding('utf8');
    socket.write(greeting + '\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (mode === 'data') {
          if (line === '.') {
            received.push(dataBuffer);
            dataBuffer = '';
            mode = 'command';
            socket.write('250 2.0.0 Ok: queued as FAKE123\r\n');
          } else {
            dataBuffer += (line.startsWith('..') ? line.slice(1) : line) + '\r\n';
          }
          continue;
        }

        const [verb, ...rest] = line.split(' ');
        const command = verb.toUpperCase();

        if (command === 'EHLO') {
          if (!supportsEhlo) {
            socket.write('500 5.5.1 Command not recognized\r\n');
            continue;
          }
          const lines = capabilities.length
            ? ['250-fake.smtp', ...capabilities.map((c, i) => (i === capabilities.length - 1 ? `250 ${c}` : `250-${c}`))]
            : ['250 fake.smtp'];
          socket.write(lines.join('\r\n') + '\r\n');
        } else if (command === 'HELO') {
          socket.write('250 fake.smtp\r\n');
        } else if (command === 'AUTH') {
          const mechanism = (rest[0] || '').toUpperCase();
          if (mechanism === 'PLAIN') {
            const token = Buffer.from(rest[1] || '', 'base64').toString('utf8').split('\0');
            socket.write(token[1] === user && token[2] === pass ? '235 2.7.0 Authentication successful\r\n' : '535 5.7.8 Bad credentials\r\n');
          } else if (mechanism === 'LOGIN') {
            mode = 'login-user';
            socket.write('334 VXNlcm5hbWU6\r\n');
          } else {
            socket.write('504 5.5.4 Unsupported mechanism\r\n');
          }
        } else if (mode === 'login-user') {
          mode = Buffer.from(line, 'base64').toString('utf8') === user ? 'login-pass' : 'login-bad';
          socket.write('334 UGFzc3dvcmQ6\r\n');
        } else if (mode === 'login-pass' || mode === 'login-bad') {
          const okUser = mode === 'login-pass';
          mode = 'command';
          socket.write(okUser && Buffer.from(line, 'base64').toString('utf8') === pass ? '235 2.7.0 Authentication successful\r\n' : '535 5.7.8 Bad credentials\r\n');
        } else if (command === 'MAIL' || command === 'RCPT') {
          socket.write('250 2.1.0 Ok\r\n');
        } else if (command === 'DATA') {
          mode = 'data';
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (command === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else if (command === 'RSET' || command === 'NOOP') {
          socket.write('250 2.0.0 Ok\r\n');
        } else {
          socket.write('502 5.5.2 Command not implemented\r\n');
        }
      }
    });

    socket.on('error', () => { /* клиент мог оборвать соединение */ });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        host: '127.0.0.1',
        received,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { startFakeServer };
