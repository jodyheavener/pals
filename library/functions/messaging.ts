import { handleRequest, HTTPError } from '../utils/server';
import { HEV, HCX, HCB, HandlerEvent } from '../../types/handler';
import { STATUS_TYPES, SUPPORTED_LANGUAGES } from '../models/User';
import { validRequest, sendMessage } from '../utils/twilio';
import { getMessage } from '../utils/messages';
import db from '../utils/database';

function parsableCommand(
  body: string,
  keys: string[] = []
): string | undefined {
  return keys.find((key) => key === body.trim().toUpperCase());
}

async function resetPairing(
  pairing: typeof db.User,
  user: typeof db.User,
  partnerOnly = false
) {
  // destroy the pairing first
  const partner = (await pairing.getUsers({
    where: {
      id: {
        // @ts-ignore
        [db.Sequelize!.Op.ne]: user.id,
      },
    },
  }))[0];

  await pairing.destroy();

  partner.update({
    status: STATUS_TYPES.UNPAIRED_MENU,
  });
  sendMessage(
    partner,
    [
      getMessage(partner.language, 'partnerEndedChat', {
        name: user.name,
      }),
      getMessage(partner.language, 'unpairedCommands'),
    ].join(' ')
  );

  if (!partnerOnly) {
    user.update({
      status: STATUS_TYPES.UNPAIRED_MENU,
    });

    sendMessage(
      user,
      [
        getMessage(user.language, 'youEndedChat'),
        getMessage(user.language, 'unpairedCommands'),
      ].join(' ')
    );
  }
}

export async function process(ev: HEV, cx: HCX, cb: HCB) {
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
      const pairing = await event.authedUser.getPairing();

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
          if (pairing != null) {
            throw new Error('Attempted to use unpaired menu with a pairing');
          }

          switch (parsableCommand(event.params.Body, ['PAIR', 'LEAVE'])) {
            case 'PAIR':
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
          if (!pairing) {
            throw new Error('Attempted to use paired menu without a pairing');
          }

          switch (parsableCommand(event.params.Body, ['BYE', 'EXIT'])) {
            case 'BYE':
              await resetPairing(pairing, event.authedUser);
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
          if (!pairing) {
            throw new Error('Attempted to chat without a pairing');
          }

          if (parsableCommand(event.params.Body, ['> MENU']) === '> MENU') {
            event.authedUser.update({
              status: STATUS_TYPES.PAIRED_MENU,
            });

            sendMessage(
              event.authedUser,
              getMessage(event.authedUser.language, 'pairedCommands')
            );
          } else {
            const partner = (await pairing.getUsers({
              where: {
                // @ts-ignore
                id: { [db.Sequelize!.Op.ne]: event.authedUser.id },
              },
            }))[0];

            sendMessage(partner, event.params.Body);
          }
          break;
        case STATUS_TYPES.CONNECTING:
          if (pairing != null) {
            throw new Error('Attempted to connect while having a pairing');
          }

          sendMessage(
            event.authedUser,
            getMessage(event.authedUser.language, 'stillPairing')
          );
          break;
        case STATUS_TYPES.CONFIRMING_DELETION:
          if (parsableCommand(event.params.Body, ['YES']) === 'YES') {
            await resetPairing(pairing, event.authedUser, true);

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

    return respond(null, 200, {
      // Twilio needs to this content type
      'Content-Type': 'text/plain',
    });
  });
}
