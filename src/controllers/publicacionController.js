import Publicacion from "../models/Publicacion.js";
import TipoDePropiedad from "../models/TipoDePropiedad.js";
import CategoriaDePropiedad from "../models/CategoriaDePropiedad.js";
import TipoDeMoneda from "../models/TipoDeMoneda.js";
import Usuario from "../models/Usuario.js";

export const getPublicaciones = async (req, res) => {
  try {
    const publicaciones = await Publicacion.findAll({
      include: [TipoDePropiedad, CategoriaDePropiedad, TipoDeMoneda, Usuario],
    });
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicacionesById = async (req, res) => {
  try {
    const publicaciones = await Publicacion.findByPk(req.params.id, {
      include: [TipoDePropiedad, CategoriaDePropiedad, TipoDeMoneda, Usuario],
    });
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPublicacion = async (req, res) => {
  try {
    const publicacion = await Publicacion.create(req.body);
    res.status(201).json(publicacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
