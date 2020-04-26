# Pals

## Development

Prequisites:

- [Node.js](https://nodejs.org/en/) at version 12.x
- [Yarn](https://yarnpkg.com/) to install dependencies
- [Serverless CLI](https://serverless.com/framework/docs/providers/aws/cli-reference/)
- A MySQL database running with a dummy database created
  - For deploying you'll need to set up an [Aurora instance](https://aws.amazon.com/rds/aurora/serverless/) yourself (I haven't figured out how to provision this as a Serverless resource)
- A [Twilio](https://www.twilio.com/) account, with a [programmable SMS number](https://www.twilio.com/console/sms/dashboard) set up

Setting up:

- Clone this repo: `git clone git@github.com:jodyheavener/pals.git`
- Install dependencies: `yarn install`
- Update `secrets.dev.json` for local development, and `secrets.staging.json` for when you want to deploy

Now you can run:

- Run locally / offline: `sls offline start --skipCacheInvalidation --printOutput`
- Deploy everything to AWS staging: `sls deploy --stage staging -v`
- Run a function locally: `sls invoke local -f FUNCTION_NAME`
- Run a function on staging: `sls invoke -f FUNCTION_NAME --stage staging`

Reference [`config/functions.yml`](https://github.com/jodyheavener/pals/blob/master/config/functions.yml) to see available functions. You can also import [`insomnia.json`](https://github.com/jodyheavener/pals/blob/master/insomnia.json) into Insomnia if you'd like to test requests.


### To do:

This was fun, but it could be vastly improved in so many ways...

- Clean up Typescript! There are lots of `// @ts-ignore`, and `any` types
- Add some sort of throttling for messages
- Add ability to report Pal
- Add ability to access menu while waiting for connection
- Add ability to infer initial language and set additional languages, pair with someone who speaks your language
- When you end a chat with your Pal it should never rematch with them
