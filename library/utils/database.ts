const fs = require('fs');
const path = require('path');
import Sequelize from 'sequelize';

const db: {
  connected: boolean;
  sequelize?: typeof Sequelize;
  Sequelize?: object;
  [key: string]: any;
} = {
  connected: false,
  Sequelize,
};

// @ts-ignore
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
  }
);

fs.readdirSync(__dirname + '/../models')
  .filter((file: string) => {
    return file.indexOf('.') !== 0 && file.slice(-3) === '.js';
  })
  .forEach((file: string) => {
    const model = sequelize['import'](path.join(__dirname, '/../models', file));
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;

export default db;

export async function connect() {
  if (db.connected) {
    console.log('=> Using existing connection.');
    return db;
  }

  await sequelize.sync();
  await sequelize.authenticate();

  db.connected = true;
  console.log('=> Created a new connection.');

  return db;
};
