const qs = require('qs');
import { connect } from './database';
import User from '../models/User';
import { HEV, HCX, HCB } from '../../types/handler';

const STATUS_MESSAGES = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

export class HTTPError extends Error {
  statusCode: number;
  statusMessage: string;
  stack?: string;

  constructor(statusCode: number, message: string = '', stack?: string) {
    // @ts-ignore
    super(message);
    // @ts-ignore
    this.statusMessage = STATUS_MESSAGES[statusCode];
    this.statusCode = statusCode;
    this.stack = stack;
  }
}

export async function handleRequest(
  originalEvent: HEV,
  context: HCX,
  callback: HCB,
  handler: Function
) {
  const event: {
    originalEvent: { [key: string]: any };
    params: { [key: string]: any };
    query: { [key: string]: any };
    headers: { [key: string]: any };
    url: string;
    authedUser?: typeof User;
    database?: any;
  } = {
    originalEvent,
    params: {},
    query: originalEvent.queryStringParameters,
    headers: originalEvent.headers || {},
    url: `${process.env.BASE_URL!}${originalEvent.path}`,
  };

  if (event.query) {
    event.url = `${event.url}?${qs.stringify(event.query)}`;
  }

  if (originalEvent.body != null) {
    const contentType = originalEvent.headers['Content-Type'];

    if (contentType === 'application/json') {
      event.params = JSON.parse(originalEvent.body);
    } else if (contentType === 'application/x-www-form-urlencoded') {
      event.params = qs.parse(originalEvent.body);
    }
  }

  context.callbackWaitsForEmptyEventLoop = true;

  try {
    event.database = await connect();
  } catch (error) {
    return respond(
      callback,
      new HTTPError(500, 'Cannot connect to the database', error)
    );
  }

  const phoneParam = event.params.From;

  if (phoneParam) {
    const User = event.database.User;
    let user;

    try {
      user = await User.findOne({
        where: { phone: phoneParam.replace(/\D/g, '') },
      });

      if (user) {
        event.authedUser = user;
      }
    } catch (error) {
      return respond(
        callback,
        new HTTPError(500, 'Cannot look up up authenticated user', error)
      );
    }
  }

  return handler(respond, event);
}

export function respond(
  callback: HCB,
  dataOrError: HTTPError | { [key: string]: any } | number,
  statusCode: number = 200,
  headers: { [key: string]: any } = {}
): {
  body?: string | null;
  statusCode?: number;
  headers?: { [key: string]: any };
} {
  let body: {
    statusCode?: number;
    statusMessage?: string;
    errors?: [string];
    data?: any;
  } = {};

  if (dataOrError instanceof Error) {
    body.statusCode = dataOrError.statusCode;
    body.statusMessage = dataOrError.statusMessage;

    if (typeof dataOrError.message === 'string') {
      body.errors = [dataOrError.message];
    } else {
      body.errors = dataOrError.message;
    }

    // TODO: Should this print to some other server logs?
    console.log(dataOrError.stack);
  } else if (typeof dataOrError === 'number') {
    body.statusCode = dataOrError;
    // @ts-ignore
    body.statusMessage = STATUS_MESSAGES[dataOrError];
    body.data = {};
  } else {
    body.statusCode = statusCode;
    // @ts-ignore
    body.statusMessage = STATUS_MESSAGES[statusCode];
    body.data = dataOrError;
  }

  let response = {
    statusCode: body.statusCode,
    headers,
  };

  if (dataOrError != null) {
    // @ts-ignore
    response.body = JSON.stringify(body);
  }

  return callback(null, response);
}
