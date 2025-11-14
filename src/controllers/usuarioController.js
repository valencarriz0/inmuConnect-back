import Usuario from "../models/Usuario.js";

export const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.getAll();
    res.json(usuarios);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

export const getUsuarioById = async (req, res) => {
  try {
    const usuario = await Usuario.getById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const { password, ...usuarioSinPassword } = usuario.toJSON();
    res.json(usuarioSinPassword);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

export const usuarioLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email y contraseña son requeridos" });
    }

    const result = await login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

export const updateUsuario = async (req, res) => {
  try {
    const { nombre, apellido, email, password, CUIT, telefono, altura, calle } =
      req.body;

    const usuarioActualizado = await Usuario.updateUser(req.params.id, {
      nombre,
      apellido,
      email,
      password,
      CUIT,
      telefono,
      altura,
      calle,
    });

    if (!usuarioActualizado) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
};

export const createUsuario = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      email,
      password,
      CUIT,
      telefono,
      altura,
      calle,
      tipo,
    } = req.body;

    const existingUser = await Usuario.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    // 💡 Determinamos si puede publicar
    const is_publisher =
      tipo === "inmobiliaria" || tipo === "persona" ? true : false;

    // 💡 Creamos el usuario según tipo
    const nuevoUsuario = await Usuario.createUser({
      nombre,
      apellido: tipo === "inmobiliaria" ? null : apellido,
      email,
      password,
      CUIT,
      telefono,
      altura,
      calle,
      tipo,
      is_publisher, // 👈 importante
    });

    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
};

export const deleteUsuario = async (req, res) => {
  try {
    const usuarioEliminado = await Usuario.deleteUser(req.params.id);
    if (!usuarioEliminado) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      message: "Usuario eliminado correctamente",
      usuario: usuarioEliminado,
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
};
