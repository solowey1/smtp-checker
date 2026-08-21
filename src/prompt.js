'use strict';

const readline = require('readline');

/**
 * Скрытый ввод пароля в интерактивном терминале.
 * Hidden password prompt for interactive terminals.
 */
function promptPassword(question, { input = process.stdin, output = process.stderr } = {}) {
  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
      reject(new Error('not a tty'));
      return;
    }

    const rl = readline.createInterface({ input, output, terminal: true });
    output.write(question);

    // Скрываем эхо: подменяем запись в поток на время ввода.
    const originalWrite = output.write.bind(output);
    output.write = (chunk, encoding, callback) => {
      if (typeof chunk === 'string' && chunk !== '\r\n' && chunk !== '\n') {
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
      }
      return originalWrite(chunk, encoding, callback);
    };

    const restore = () => {
      output.write = originalWrite;
    };

    rl.question('', (answer) => {
      restore();
      originalWrite('\n');
      rl.close();
      resolve(answer);
    });

    rl.once('SIGINT', () => {
      restore();
      originalWrite('\n');
      rl.close();
      reject(new Error('interrupted'));
    });
  });
}

module.exports = { promptPassword };
