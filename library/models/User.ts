import Pairing from './Pairing';

export const SUPPORTED_LANGUAGES = {
  en: 'en',
  fr: 'fr'
};

export const STATUS_TYPES = {
  NEEDS_NAME: 'needs_name',
  CONFIRM_LANGUAGES: 'confirm_languages',
  READY: 'ready',
  SUSPENDED: 'suspended'
};

export const OPERATION_TYPES = {
  UNPAIRED_MENU: 'unpairedMenu',
  PAIRED_MENU: 'pairedMenu',
  CHAT_ACTIVE: 'chatActive',
  CONNECTING: 'connecting',
  CONFIRMING_DELETION: 'confirmingDeletion',
}

export const EXCLUDED_ATTRS = [];

export const UPDATABLE_ATTRS = ['name', 'phone'];

// @ts-ignore
export default function User(sequelize, DataTypes) {
  const User = sequelize.define('User', {
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
    operation: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: OPERATION_TYPES.UNPAIRED_MENU,
      validate: {
        isIn: [Object.values(OPERATION_TYPES)],
      },
    },
    languages: {
      type: DataTypes.STRING,
      allowNull: false,
      get(): Array<string> {
        // @ts-ignore
        return JSON.parse(this.getDataValue('languages'));
      },
      set(value: Array<string>) {
        // @ts-ignore
        this.setDataValue('languages', JSON.stringify(value));
      },
      validate: {
        allSupportedLanguages(value: string) {
          if (
            !JSON.parse(value).every((lang: string) =>
              Object.values(SUPPORTED_LANGUAGES).includes(lang)
            )
          ) {
            throw new Error('Contains an unsupported language code');
          }
        },
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
    // TODO: Update this with a preference
    // to set the primary language
    primaryLanguage: {
      type: DataTypes.VIRTUAL,
      get(): string {
        // @ts-ignore
        return this.languages[0];
      },
    },
  }, {});

  User.prototype.toJSON = function () {
    let attributes: { [key: string]: any } = Object.assign({}, this.get());

    for (let a of EXCLUDED_ATTRS) {
      delete attributes[a];
    }

    return attributes;
  }

  User.associate = function (models: { Pairing: (typeof Pairing) }) {
    User.belongsTo(models.Pairing);
  };

  return User;
};
