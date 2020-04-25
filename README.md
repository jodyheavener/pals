# Pals

## Development setup

- Clone this repo
- `yarn install`
- Make sure you have MySQL running
- Update your `dev` secrets, and `staging` for when you want to deploy
  - You'll need to set up an Aurora instance yourself (can this be provisioned as a Serverless resource?)
- To run offline: `sls offline start --skipCacheInvalidation --printOutput`
- To deploy: `sls deploy --stage staging -v`

**TODO:**

- Clean up Typescript! There are lots of `// @ts-ignore`, and `any` types
- Improve/add `User` column validations
- Add some sort of throttling for messages
- Add ability to report Pal
- Add ability to access menu while waiting for connection
