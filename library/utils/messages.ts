const fs = require('fs');
const { resolve } = require('path');

const locales: { [key: string]: any } = {};

fs.readdirSync(resolve('./locales')).map((file: string) => {
  const code = file.split('.')[0];
  locales[code] = JSON.parse(fs.readFileSync(`./locales/${file}`, 'utf8'));
});

export function getMessage(
  code: string,
  key: string,
  replacements?: { [key: string]: any }
) {
  function performReplacements(string: string) {
    if (
      string !== null &&
      replacements != null &&
      typeof replacements === 'object'
    ) {
      var _matchesForRegex = string.match(/%{[a-zA-Z]+[a-zA-Z0-9_]*}/g);
      if (null !== _matchesForRegex) {
        for (var _m in _matchesForRegex) {
          var _theMatch = _matchesForRegex[_m];
          if (_theMatch.replace('%{', '').replace('}', '') in replacements) {
            string = string.replace(
              _theMatch,
              replacements[_theMatch.replace('%{', '').replace('}', '')]
            );
          }
        }
      }
    }

    return string;
  }

  let messages = locales[code][key];

  if (typeof messages === 'string') {
    messages = [messages];
  }

  const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
  return performReplacements(selectedMessage);
}
