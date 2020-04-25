import { handleRequest, HTTPError } from '../utils/server';
import { HEV, HCX, HCB, HandlerEvent } from '../../types/handler';
import { STATUS_TYPES, OPERATION_TYPES } from '../models/User';

const fs = require('fs');
const { resolve } = require('path');
const twilio = require('twilio');
const LanguageDetect = require('languagedetect');
const lngDetector = new LanguageDetect();

const twilioClient = twilio(
  process.env.TWILIO_SID!,
  process.env.TWILIO_TOKEN!,
  {
    lazyLoading: true,
  }
);

const locales: { [key: string]: any } = {};

fs.readdirSync(resolve('./locales')).map((file: string) => {
  const code = file.split('.')[0];
  locales[code] = JSON.parse(fs.readFileSync(`./locales/${file}`, 'utf8'));
});

function validRequest(event: HandlerEvent) {
  return (
    process.env.NODE_ENV === 'dev' ||
    twilio.validateRequest(
      process.env.TWILIO_TOKEN!,
      event.headers['x-twilio-signature'],
      event.url,
      event.params
    )
  );
}

function getMessage(
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

function inferLanguage(text: string) {
  const matchers = {
    english: 'en',
    french: 'fr',
  };

  const detection = lngDetector.detect(text);
  // We don't support all detectable languages, so narrow the results
  const availableResults = detection.filter((set: Array<string>) =>
    Object.keys(matchers).includes(set[0])
  );

  // @ts-ignore
  return matchers[availableResults[0][0]] || 'en';
}

// @ts-ignore
function getKeyByValue(object: { [key: string]: any }, value: string) {
  return Object.keys(object).find((key) => object[key] === value);
}

// @ts-ignore
function detectLanguages(user, text: string) {
  // This whole function is a friggen mess
  // please do not judge me it is very late

  const strippedWords = text.toLowerCase().replace(/\W/g, '');
  const localedLanguage = locales[user.languages[0]].languages;

  const foundLanguages = Object.values(localedLanguage).filter((language) =>
    // @ts-ignore
    strippedWords.includes(language.toLowerCase())
  );

  const languageKeys = Object.keys(localedLanguage).filter((key) =>
    foundLanguages.includes(localedLanguage[key])
  );

  const combinedKeys = user.languages.concat(languageKeys);

  // @ts-ignore
  return combinedKeys.filter(function (item, pos) {
    return combinedKeys.indexOf(item) == pos;
  });
}

// @ts-ignore
function getStatusMessage(user) {
  const language = user.primaryLanguage;
  let messages;

  switch (user.status) {
    case STATUS_TYPES.NEEDS_NAME:
      messages = [
        ['1/2 -', getMessage(language, 'welcome')].join(' '),
        [
          '2/2 -',
          getMessage(language, 'whatsYourName'),
          getMessage(language, 'seenByYourPal'),
        ].join(' '),
      ];
      break;
    case STATUS_TYPES.CONFIRM_LANGUAGES:
      const availableLanguages = Object.values(locales[language].languages);

      messages = [
        ['1/2 -', getMessage(language, 'greeting', { name: user.name })].join(
          ' '
        ),
        [
          '2/2 -',
          getMessage(language, 'whatLanguages'),
          getMessage(language, 'languagesWeSupport', {
            languages: availableLanguages.join(', '),
          }),
        ].join(' '),
      ];
      break;
    case STATUS_TYPES.SUSPENDED:
      messages = getMessage(language, 'cantHelpYou');
      break;
  }

  return messages;
}

// @ts-ignore
function sendMessage(user, messages: Array<string> | string = []) {
  if (typeof messages === 'string') {
    messages = [messages];
  }

  messages.forEach((message) => {
    twilioClient.messages.create({
      from: process.env.TWILIO_NUMBER!,
      to: user.phone,
      body: message,
    });
  });
}

function parsableCommand(body: string, keys: string[] = []): string | undefined {
  return keys.find((key) => key === body.trim().toUpperCase());
}

export async function handleTwilio(ev: HEV, cx: HCX, cb: HCB) {
  return handleRequest(ev, cx, cb, async function (
    respond: Function,
    event: HandlerEvent
  ) {
    if (!validRequest(event)) {
      return respond(null, 401);
    }

    if (!event.authedUser) {
      try {
        event.authedUser = await event.database.User.create({
          languages: [inferLanguage(event.params.Body)],
          phone: event.params.From.replace(/\D/g, ''),
        });

        sendMessage(event.authedUser, getStatusMessage(event.authedUser));
      } catch (error) {
        return respond(new HTTPError(400, 'Could not create the user', error));
      }
    } else {
      if (event.authedUser.status === STATUS_TYPES.CONFIRM_LANGUAGES) {
        event.authedUser.update({
          languages: detectLanguages(event.authedUser, event.params.Body),
          status: STATUS_TYPES.READY,
        });

        sendMessage(event.authedUser, [
          [
            '1/2 -',
            getMessage(event.authedUser.primaryLanguage, 'ready')
          ].join(' '),
          [
            '2/2 -',
            getMessage(event.authedUser.primaryLanguage, 'unpairedCommands'),
          ].join(' '),
        ]);
      }

      if (event.authedUser.status === STATUS_TYPES.NEEDS_NAME) {
        event.authedUser.update({
          name: event.params.Body,
          status: STATUS_TYPES.CONFIRM_LANGUAGES,
        });
      }

      const existingPairing = await event.authedUser.getPairing();

      if (event.authedUser.status !== STATUS_TYPES.READY) {
        sendMessage(event.authedUser, getStatusMessage(event.authedUser));
      } else {
        switch (event.authedUser.operation) {
          case 'unpairedMenu':
            switch (parsableCommand(event.params.Body, ['PAIR', 'LEAVE'])) {
              case 'PAIR':
                // TODO: initiate pairing request
                // should message with:
                // sendMessage(
                //   event.authedUser,
                //   getMessage(event.authedUser.primaryLanguage, 'connected', {
                //     name: 'PAIRED NAME',
                //   })
                // );
                event.authedUser.update({
                  operation: OPERATION_TYPES.CONNECTING,
                });
                sendMessage(
                  event.authedUser,
                  getMessage(event.authedUser.primaryLanguage, 'connecting')
                );
                break;
              case 'LEAVE':
                event.authedUser.update({
                  operation: OPERATION_TYPES.CONFIRMING_DELETION,
                });
                sendMessage(
                  event.authedUser,
                  getMessage(
                    event.authedUser.primaryLanguage,
                    'deleteConfirmation'
                  )
                );
                break;
              default:
                sendMessage(
                  event.authedUser,
                  getMessage(
                    event.authedUser.primaryLanguage,
                    'unpairedCommands'
                  )
                );
                break;
            }
            break;
          case 'pairedMenu':
            switch (parsableCommand(event.params.Body, ['BYE', 'EXIT'])) {
              case 'BYE':
                // TODO: destroy pairing
                sendMessage(
                  event.authedUser,
                  getMessage(event.authedUser.primaryLanguage, 'disconnected')
                );
                break;
              case 'EXIT':
                event.authedUser.update({
                  operation: OPERATION_TYPES.CHAT_ACTIVE,
                });
                break;
              default:
                sendMessage(
                  event.authedUser,
                  getMessage(event.authedUser.primaryLanguage, 'pairedCommands')
                );
                break;
            }
            break;
          case 'chatActive':
            if (parsableCommand(event.params.Body, ['> MENU']) === '> MENU') {
              event.authedUser.update({
                operation: OPERATION_TYPES.PAIRED_MENU,
              });

              sendMessage(
                event.authedUser,
                getMessage(event.authedUser.primaryLanguage, 'pairedCommands')
              );
            } else {
              // TODO: send the Body to the pairing recipient
            }
            break;
          case 'connecting':
            sendMessage(
              event.authedUser,
              getMessage(event.authedUser.primaryLanguage, 'stillPairing')
            );
            break;
          case 'confirmingDeletion':
            if (parsableCommand(event.params.Body, ['YES']) === 'YES') {
              const user = {
                phone: event.authedUser.phone,
                primaryLanguage: event.authedUser.primaryLanguage,
              };

              await event.authedUser.destroy();

              sendMessage(
                user,
                getMessage(user.primaryLanguage, 'accountDeleted')
              );
            } else {
              event.authedUser.update({
                operation: OPERATION_TYPES.UNPAIRED_MENU,
              });

              sendMessage(event.authedUser, [
                [
                  '1/2 -',
                  getMessage(
                    event.authedUser.primaryLanguage,
                    'deleteCancelled'
                  ),
                ].join(' '),
                [
                  '2/2 -',
                  getMessage(
                    event.authedUser.primaryLanguage,
                    'unpairedCommands'
                  ),
                ].join(' '),
              ]);
            }
            break;
        }
      }
    }

    return respond(null, 200);
  });
}
