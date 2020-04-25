import User from './User';

// @ts-ignore
export default function Pairing(sequelize, DataTypes) {
  const Pairing = sequelize.define('Pairing', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  }, {});

  Pairing.associate = function(models: { User: (typeof User) }) {
    Pairing.hasMany(models.User);
  };

  return Pairing;
};
