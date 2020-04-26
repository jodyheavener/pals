import { HEV, HCX, HCB } from '../../types/handler';
import { respond } from '../utils/server';
import { STATUS_TYPES } from '../models/User';
import { sendMessage } from '../utils/twilio';
import { getMessage } from '../utils/messages';
import db from '../utils/database';

const MAX_USERS_PER_PAIRING = 100;

function informPairing(user: typeof db.User, partner: typeof db.User) {
  user.update({
    status: STATUS_TYPES.CHAT_ACTIVE,
  });

  sendMessage(
    user,
    getMessage(user.language, 'connected', {
      name: partner.name,
    })
  );
}

export async function pair(_ev: HEV, _cx: HCX, _cb: HCB) {
  const unpairedUsers = await db.User.scope('unpaired').findAll({
    limit: MAX_USERS_PER_PAIRING,
    // @ts-ignore
    order: db.Sequelize.literal('rand()'),
  });

  // @ts-ignore
  let pairGroups = unpairedUsers.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 2);

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []; // start a new chunk
    }

    resultArray[chunkIndex].push(item);

    return resultArray;
  }, []);

  pairGroups.forEach(async (users: any) => {
    // We got an awkward number of users in this group, abort
    if (users.length !== 2) {
      return;
    }

    const pairing = await db.Pairing.create();
    pairing.setUsers(users);

    informPairing(users[0], users[1]);
    informPairing(users[1], users[0]);
  });

  return respond(201);
}
