import { HandlerEvent } from "../../types/handler";

const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_SID!,
  process.env.TWILIO_TOKEN!,
  {
    lazyLoading: true,
  }
);

export function validRequest(event: HandlerEvent) {
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

// @ts-ignore
export function sendMessage(user, messages: Array<string> | string = []) {
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
