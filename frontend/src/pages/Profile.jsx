import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || "",
    address: user.address || "",
    bank_account: user.bank_account || "",
    bank_name: user.bank_name || "",
    bank_ifsc: user.bank_ifsc || "",
    photo_url: user.photo_url || "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await api.put(`/employees/${user.id}`, payload);
      await refresh();
      toast.success("Profile updated");
      setForm({ ...form, password: "" });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await api.post("/upload", { data_url: reader.result, folder: "employees" });
        setForm(d => ({ ...d, photo_url: r.data.url }));
      } catch { toast.error("Upload failed"); }
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="sk-page max-w-3xl" data-testid="profile-page">
      <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Profile</h1>
      <p className="text-sm text-slate-500 mt-1 mb-5">Update your personal info, photo and bank details</p>

      <form onSubmit={save} className="space-y-5">
        <div className="sk-card p-5 space-y-4">
          <div className="flex items-center gap-4">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#4DA3FF] to-[#FFA94D] grid place-items-center text-white font-bold text-xl">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="font-heading text-lg font-bold">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email} · {user.role}</div>
              <label className="inline-flex items-center gap-2 mt-2 text-sm text-[#4DA3FF] cursor-pointer">
                <Upload className="w-4 h-4" /> Change photo
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
            </div>
          </div>
        </div>

        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Personal Info</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="sk-input" /></Field>
            <Field label="Phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="sk-input" /></Field>
          </div>
          <Field label="Address"><textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="sk-input" /></Field>
        </div>

        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Bank Details</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Account No."><input value={form.bank_account} onChange={e => setForm({ ...form, bank_account: e.target.value })} className="sk-input" /></Field>
            <Field label="Bank Name"><input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="sk-input" /></Field>
            <Field label="IFSC"><input value={form.bank_ifsc} onChange={e => setForm({ ...form, bank_ifsc: e.target.value })} className="sk-input" /></Field>
          </div>
        </div>

        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Change Password</div>
          <Field label="New Password (leave blank to keep current)">
            <input type="password" minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="sk-input" />
          </Field>
        </div>

        <div className="flex justify-end">
          <button disabled={busy} className="sk-btn-primary" data-testid="save-profile">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <label className="sk-label">{label}</label>
    {children}
  </div>
);
