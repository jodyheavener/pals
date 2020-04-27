import { handleRequest, respond } from '../utils/server';
import { HEV, HCX, HCB, HandlerEvent } from '../../types/handler';
import { connect } from '../utils/database';

export async function healthCheck(ev: HEV, cx: HCX, callback: HCB) {
  return handleRequest(ev, cx, callback, async function (
    respond: Function,
    _event: HandlerEvent
  ) {
    return respond(callback, { message: 'Connection successful.' });
  });
}

export async function resetAll(_ev: HEV, _cx: HCX, callback: HCB) {
  let database: any;

  try {
    database = await connect();
  } catch (error) {
    throw new Error('Cannot connect to the database');
  }

  // @ts-ignore
  await database.User.destroy({
    where: {},
  });

  // @ts-ignore
  await database.Pairing.destroy({
    where: {},
  });

  return respond(callback, 200);
}
