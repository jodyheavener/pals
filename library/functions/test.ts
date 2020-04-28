export async function send(ev, cx, callback) {
  const accountSid = process.env.TWILIO_SID;
  const authToken = process.env.TWILIO_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  console.log('started');

  client.messages
    .create({
      body: 'Hello from Lambda',
      to: '',
      from: process.env.TWILIO_NUMBER,
    })
    .then((message) => {
      console.log(message);
      // Success, return message SID
      callback(null, message.sid);
    })
    .catch((e) => {
      // console.log(e);
      // // Error, return error object
      // callback(Error(e));
    });
};
