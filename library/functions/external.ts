import { handleRequest, HTTPError } from '../utils/server';
import { HEV, HCX, HCB, HandlerEvent } from '../../types/handler';
import { STATUS_TYPES, SUPPORTED_LANGUAGES } from '../models/User';

const fs = require('fs');
const { resolve } = require('path');
const twilio = require('twilio');

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

function parsableCommand(
  body: string,
  keys: string[] = []
): string | undefined {
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
          language: SUPPORTED_LANGUAGES.en,
          phone: event.params.From.replace(/\D/g, ''),
        });

        sendMessage(event.authedUser, [
          [
            getMessage(event.authedUser.language, 'welcome'),
            getMessage(event.authedUser.language, 'whatsYourName'),
            getMessage(event.authedUser.language, 'seenByYourPal'),
          ].join(' '),
        ]);
      } catch (error) {
        return respond(new HTTPError(400, 'Could not create the user', error));
      }
    } else {
      switch (event.authedUser.status) {
        case STATUS_TYPES.SUSPENDED:
          sendMessage(
            event.authedUser,
            getMessage(event.authedUser.language, 'cantHelpYou')
          );
          break;
        case STATUS_TYPES.NEEDS_NAME:
          event.authedUser.update({
            name: event.params.Body,
            status: STATUS_TYPES.UNPAIRED_MENU,
          });

          sendMessage(event.authedUser, [
            [
              getMessage(event.authedUser.language, 'ready', {
                name: event.authedUser.name,
              }),
              getMessage(event.authedUser.language, 'unpairedCommands'),
            ].join(' '),
          ]);
          break;
        case STATUS_TYPES.UNPAIRED_MENU:
          switch (parsableCommand(event.params.Body, ['PAIR', 'LEAVE'])) {
            case 'PAIR':
              // TODO: initiate pairing request
              // should message with:
              // sendMessage(
              //   event.authedUser,
              //   getMessage(event.authedUser.language, 'connected', {
              //     name: 'PAIRED NAME',
              //   })
              // );
              event.authedUser.update({
                status: STATUS_TYPES.CONNECTING,
              });
              sendMessage(
                event.authedUser,
                getMessage(event.authedUser.language, 'connecting')
              );
              break;
            case 'LEAVE':
              event.authedUser.update({
                status: STATUS_TYPES.CONFIRMING_DELETION,
              });
              sendMessage(
                event.authedUser,
                getMessage(event.authedUser.language, 'deleteConfirmation')
              );
              break;
            default:
              sendMessage(
                event.authedUser,
                getMessage(event.authedUser.language, 'unpairedCommands')
              );
              break;
          }
          break;
        case STATUS_TYPES.PAIRED_MENU:
          switch (parsableCommand(event.params.Body, ['BYE', 'EXIT'])) {
            case 'BYE':
              // TODO: destroy pairing
              sendMessage(
                event.authedUser,
                getMessage(event.authedUser.language, 'disconnected')
              );
              break;
            case 'EXIT':
              event.authedUser.update({
                status: STATUS_TYPES.CHAT_ACTIVE,
              });
              break;
            default:
              sendMessage(
                event.authedUser,
                getMessage(event.authedUser.language, 'pairedCommands')
              );
              break;
          }
          break;
        case STATUS_TYPES.CHAT_ACTIVE:
          if (parsableCommand(event.params.Body, ['> MENU']) === '> MENU') {
            event.authedUser.update({
              status: STATUS_TYPES.PAIRED_MENU,
            });

            sendMessage(
              event.authedUser,
              getMessage(event.authedUser.language, 'pairedCommands')
            );
          } else {
            // TODO: send the Body to the pairing recipient
          }
          break;
        case STATUS_TYPES.CONNECTING:
          sendMessage(
            event.authedUser,
            getMessage(event.authedUser.language, 'stillPairing')
          );
          break;
        case STATUS_TYPES.CONFIRMING_DELETION:
          if (parsableCommand(event.params.Body, ['YES']) === 'YES') {
            const user = {
              phone: event.authedUser.phone,
              language: event.authedUser.language,
            };

            await event.authedUser.destroy();

            sendMessage(user, getMessage(user.language, 'accountDeleted'));
          } else {
            event.authedUser.update({
              status: STATUS_TYPES.UNPAIRED_MENU,
            });

            sendMessage(event.authedUser, [
              [
                getMessage(event.authedUser.language, 'deleteCancelled'),
                getMessage(event.authedUser.language, 'unpairedCommands'),
              ].join(' '),
            ]);
          }
          break;
      }
    }

    return respond(null, 200);
  });
}
