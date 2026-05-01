import { createClient } from "@supabase/supabase-js";

const URL = process.env.REACT_APP_SUPABASE_URL;
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
export const BUCKET = process.env.REACT_APP_SUPABASE_BUCKET || "sankalp-files";

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/**
 * Create a NEW auth user without disturbing the current (admin) session.
 * Uses an isolated client whose session is never persisted.
 * Returns { user, error } from supabase.auth.signUp.
 */
export async function signUpIsolated({ email, password, name }) {
  const tmp = createClient(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-iso-${(crypto.randomUUID && crypto.randomUUID()) || Date.now()}`,
    },
  });
  const { data, error } = await tmp.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: { data: { name } },
  });
  return { user: data?.user, error };
}

/** Upload a data URL (e.g. "data:image/png;base64,...") and return the public URL. */
export async function uploadDataUrl(dataUrl, folder = "uploads") {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = (mime.split("/")[1] || "bin").split("+")[0].replace("jpeg", "jpg");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime, upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload a File/Blob object and return the public URL. */
export async function uploadFile(file, folder = "uploads") {
  const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type, upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
