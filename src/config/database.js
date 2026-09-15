import { Sequelize } from "sequelize";

import env from "./env.js";

const sequelize = new Sequelize(env.DB_CONNECTION_STRING, {
  dialect: "postgres",

  logging: false,

  define: {
    freezeTableName: true,
  },

  dialectOptions: {
    ssl: env.DB_SSL
      ? {
          require: true,
          rejectUnauthorized: false,
        }
      : false,
  },
});

export default sequelize;