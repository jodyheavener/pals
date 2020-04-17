import Sequelize from 'sequelize';
import UserModel from '../models/User';

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

const User = UserModel(sequelize, Sequelize);

const Models = { User };
const connection = {};

export default async function database() {
  // @ts-ignore
  if (connection.isConnected) {
    console.log('=> Using existing connection.');
    return Models;
  }

  await sequelize.sync();
  await sequelize.authenticate();
  // @ts-ignore
  connection.isConnected = true;
  console.log('=> Created a new connection.');
  return Models;
};
