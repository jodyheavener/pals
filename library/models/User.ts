import Pairing from './Pairing';

export const SUPPORTED_LANGUAGES = {
  en: 'en'
};

export const STATUS_TYPES = {
  NEEDS_NAME: 'needsName',
  UNPAIRED_MENU: 'unpairedMenu',
  PAIRED_MENU: 'pairedMenu',
  CHAT_ACTIVE: 'chatActive',
  CONNECTING: 'connecting',
  CONFIRMING_DELETION: 'confirmingDeletion',
  SUSPENDED: 'suspended',
};

// @ts-ignore
export default function User(sequelize, DataTypes) {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: STATUS_TYPES.NEEDS_NAME,
        validate: {
          isIn: [Object.values(STATUS_TYPES)],
        },
      },
      language: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [Object.values(SUPPORTED_LANGUAGES)],
        },
      },
      name: {
        type: DataTypes.STRING,
      },
      phone: {
        type: DataTypes.STRING,
        validate: {
          isNumberLike(value: string) {
            if (value.replace(/\D/g, '') !== value) {
              throw new Error('Does not look like a number');
            }
          },
        },
      },
    },
    {
      scopes: {
        unpaired: {
          where: {
            PairingId: null,
            status: STATUS_TYPES.CONNECTING,
          },
        },
      },
    }
  );

  User.associate = function (models: { Pairing: (typeof Pairing) }) {
    User.belongsTo(models.Pairing);
  };

  return User;
};
