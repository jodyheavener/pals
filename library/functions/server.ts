import { handleRequest } from '../utils/server';
import { HEV, HCX, HCB, HandlerEvent } from '../../types/handler';

export async function healthCheck(ev: HEV, cx: HCX, cb: HCB) {
  return handleRequest(ev, cx, cb, async function (
    respond: Function,
    _event: HandlerEvent
  ) {
    return respond({ message: 'Connection successful.' });
  });
}
