import { createClient } from "@supabase/supabase-js";
import env from "../../config/env.js";

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const bucket = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET);

const storageClient = {
  async upload(path, buffer, contentType) {
    const { error } = await bucket.upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw error;
  },

  getPublicUrl(path) {
    const { data } = bucket.getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Storage no devolvió una URL pública.");
    return data.publicUrl;
  },

  async remove(paths) {
    const { error } = await bucket.remove(paths);
    if (error) throw error;
  },
};

export default storageClient;
