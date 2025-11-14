// src/models/Usuario.js
import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";
import { hashPassword } from "../utils/auth.js"; // función async con bcrypt

class Usuario extends Model {
  // === Métodos estáticos CRUD ===

  static async getAll() {
    return await Usuario.findAll({
      attributes: { exclude: ["password"] },
    });
  }

  static async getById(id) {
    return await Usuario.findByPk(id, {
      attributes: { exclude: ["password"] },
    });
  }

  static async getByEmail(email) {
    return await Usuario.findOne({ where: { email } });
  }

  static async createUser(userData) {
    const hashedPassword = await hashPassword(userData.password);

    const newUser = await Usuario.create({
      tipo: userData.tipo, // 'persona' o 'inmobiliaria'
      nombre: userData.nombre,
      apellido: userData.apellido || null, // si es inmobiliaria puede ir null
      email: userData.email,
      password: hashedPassword,
      CUIT: userData.CUIT || null,
      telefono: userData.telefono || null,
      altura: userData.altura || null,
      calle: userData.calle || null,
    });

    const { password, ...userWithoutPassword } = newUser.toJSON();
    return userWithoutPassword;
  }

  static async updateUser(id, updateData) {
    const user = await Usuario.findByPk(id);
    if (!user) return null;

    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
    }

    await user.update(updateData);
    const { password, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  static async deleteUser(id) {
    const user = await Usuario.findByPk(id);
    if (!user) return null;

    await user.destroy();
    const { password, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }
}

// === Definición del modelo Sequelize ===
Usuario.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ENUM("persona", "inmobiliaria"),
      allowNull: false,
      validate: {
        isIn: {
          args: [["persona", "inmobiliaria"]],
          msg: "El tipo debe ser 'persona' o 'inmobiliaria'",
        },
      },
    },
    apellido: {
      type: DataTypes.STRING,
      allowNull: true, // 👈 Permitimos null, pero validamos según tipo
      validate: {
        customValidation(value) {
          if (this.tipo === "persona" && !value) {
            throw new Error(
              "El apellido es obligatorio para usuarios tipo 'persona'"
            );
          }
        },
      },
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_publisher: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // 👈 seguridad: si no se manda, será false
    },
    CUIT: DataTypes.STRING,
    telefono: DataTypes.STRING,
    altura: DataTypes.BIGINT,
    calle: DataTypes.TEXT,
  },

  {
    sequelize,
    modelName: "Usuario",
    tableName: "Usuario",
    timestamps: false,
  }
);

export default Usuario;
