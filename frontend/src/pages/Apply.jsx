import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Camera, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { LOGO } from "@/lib/utils-app";
import {
  listOpenPositions, checkDuplicateApplication, submitApplication, uploadFile,
} from "@/lib/recruitment";
import { uploadDataUrl } from "@/lib/supabase";
import PhotoCapture from "@/components/PhotoCapture";

const MAX_CV_MB = 5;
const MAX_PHOTO_MB = 3;

const empty = {
  job_opening_id: "", name: "", email: "", phone: "",
  experience_years: "", current_company: "", education: "",
  current_address: "", expected_salary: "", cover_note: "",
  website: "", // honeypot — real humans never fill this
};

export default function Apply() {
  const [openings, setOpenings] = useState([]);
  const [data, setData] = useState(empty);
  const [cvFile, setCvFile] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(null); // application_number once submitted
  const [dupWarning, setDupWarning] = useState(null);
  const [confirmedDespiteDup, setConfirmedDespiteDup] = useState(false);

  useEffect(() => {
    listOpenPositions().then(setOpenings).catch(() => toast.error("Could not load open positions")).finally(() => setLoading(false));
  }, []);

  const onCv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(pdf|doc|docx)$/i.test(f.name)) { toast.error("CV must be a PDF or Word document"); return; }
    if (f.size > MAX_CV_MB * 1024 * 1024) { toast.error(`CV must be under ${MAX_CV_MB}MB`); return; }
    setCvFile(f);
  };

  const onPhotoFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Photo must be an image"); return; }
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) { toast.error(`Photo must be under ${MAX_PHOTO_MB}MB`); return; }
    setPhotoFile(f);
    setPhotoDataUrl(URL.createObjectURL(f));
  };

  const onCameraCapture = (dataUrl) => {
    setPhotoDataUrl(dataUrl);
    setPhotoFile(null); // will upload the data URL directly instead
    setShowCamera(false);
  };

  const checkDup = async () => {
    if (!data.job_opening_id || !data.email || !data.phone) return null;
    try {
      const dup = await checkDuplicateApplication(data.job_opening_id, data.email.trim(), data.phone.trim());
      return dup;
    } catch { return null; }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (data.website) return; // honeypot tripped — silently drop
    if (!cvFile) { toast.error("Please attach your CV"); return; }
    if (!photoDataUrl) { toast.error("Please add a photo (upload or capture)"); return; }

    if (!confirmedDespiteDup) {
      const dup = await checkDup();
      if (dup) { setDupWarning(dup); return; }
    }

    setBusy(true);
    try {
      const cv_url = await uploadFile(cvFile, "recruitment/cv");
      const photo_url = photoFile
        ? await uploadFile(photoFile, "recruitment/photos")
        : await uploadDataUrl(photoDataUrl, "recruitment/photos");

      const payload = {
        job_opening_id: data.job_opening_id,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        experience_years: data.experience_years ? Number(data.experience_years) : null,
        current_company: data.current_company || null,
        education: data.education || null,
        current_address: data.current_address || null,
        expected_salary: data.expected_salary ? Number(data.expected_salary) : null,
        cover_note: data.cover_note || null,
        cv_url, photo_url,
      };
      const created = await submitApplication(payload);
      setDone(created.application_number);
    } catch (err) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;

  if (done) {
    return (
      <div className="min-h-screen bg-[#F7FAFC] grid place-items-center px-4">
        <div className="sk-card p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
          <h1 className="font-heading text-xl font-extrabold">Application received!</h1>
          <p className="text-sm text-slate-600 mt-2">Your reference number is</p>
          <div className="text-lg font-mono font-bold text-[#4DA3FF] mt-1">{done}</div>
          <p className="text-xs text-slate-500 mt-4">We'll email you at each step of the process. Thank you for applying to Sankalp Interior Solution.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAFC] py-8 px-4">
      {showCamera && <PhotoCapture onCapture={onCameraCapture} onClose={() => setShowCamera(false)} />}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-slate-900 grid place-items-center overflow-hidden shrink-0">
            <img src={LOGO} alt="Sankalp" className="w-full h-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-extrabold text-slate-900">Sankalp Interior Solution</div>
            <div className="text-xs text-slate-500 -mt-0.5">Job Application</div>
          </div>
        </div>

        {openings.length === 0 ? (
          <div className="sk-card p-6 text-center text-slate-500">There are no open positions right now. Please check back later.</div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="sk-card p-5 space-y-4">
              <F label="Position Applying For *">
                <select required className="sk-input" value={data.job_opening_id}
                  onChange={e => { setData({ ...data, job_opening_id: e.target.value }); setConfirmedDespiteDup(false); }}>
                  <option value="">Select a position…</option>
                  {openings.map(o => <option key={o.id} value={o.id}>{o.title}{o.department ? ` — ${o.department}` : ""}</option>)}
                </select>
              </F>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Full Name *"><input required className="sk-input" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></F>
                <F label="Phone *"><input required className="sk-input" value={data.phone} onChange={e => { setData({ ...data, phone: e.target.value }); setConfirmedDespiteDup(false); }} /></F>
                <F label="Email *"><input type="email" required className="sk-input" value={data.email} onChange={e => { setData({ ...data, email: e.target.value }); setConfirmedDespiteDup(false); }} /></F>
                <F label="Total Experience (years)"><input type="number" min="0" step="0.5" className="sk-input" value={data.experience_years} onChange={e => setData({ ...data, experience_years: e.target.value })} /></F>
                <F label="Current / Last Company"><input className="sk-input" value={data.current_company} onChange={e => setData({ ...data, current_company: e.target.value })} /></F>
                <F label="Expected Salary (₹)"><input type="number" min="0" className="sk-input" value={data.expected_salary} onChange={e => setData({ ...data, expected_salary: e.target.value })} /></F>
                <F label="Education Qualification"><input className="sk-input" value={data.education} onChange={e => setData({ ...data, education: e.target.value })} /></F>
              </div>
              <F label="Current Address"><textarea rows={2} className="sk-input" value={data.current_address} onChange={e => setData({ ...data, current_address: e.target.value })} /></F>
              <F label="Cover Note (optional)"><textarea rows={3} className="sk-input" value={data.cover_note} onChange={e => setData({ ...data, cover_note: e.target.value })} /></F>
              {/* honeypot — hidden from real users via CSS, bots often fill every field */}
              <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                <input tabIndex={-1} autoComplete="off" value={data.website} onChange={e => setData({ ...data, website: e.target.value })} />
              </div>
            </div>

            <div className="sk-card p-5 space-y-4">
              <div className="font-heading font-bold">Documents</div>
              <F label="Upload CV (PDF/DOC, max 5MB) *">
                <label className="sk-btn-ghost cursor-pointer w-full">
                  <Upload className="w-4 h-4" /> {cvFile ? cvFile.name : "Choose file"}
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onCv} />
                </label>
              </F>
              <F label="Photo (upload or take live) *">
                <div className="flex items-center gap-4">
                  {photoDataUrl ? <img src={photoDataUrl} alt="" className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 rounded-xl bg-slate-100 grid place-items-center text-slate-400 text-xs">No photo</div>}
                  <div className="flex flex-col gap-2">
                    <label className="sk-btn-ghost cursor-pointer"><Upload className="w-4 h-4" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={onPhotoFile} /></label>
                    <button type="button" className="sk-btn-ghost" onClick={() => setShowCamera(true)}><Camera className="w-4 h-4" /> Take Photo</button>
                  </div>
                </div>
              </F>
            </div>

            {dupWarning && (
              <div className="sk-card p-4 border-amber-300 bg-amber-50 text-sm text-amber-800">
                You already applied for this position on {new Date(dupWarning.applied_at).toLocaleDateString()} (Ref: {dupWarning.application_number}, status: {dupWarning.status}).
                <div className="flex gap-2 mt-3">
                  <button type="button" className="sk-btn-primary" onClick={() => { setConfirmedDespiteDup(true); setDupWarning(null); }}>Submit anyway</button>
                  <button type="button" className="sk-btn-ghost" onClick={() => setDupWarning(null)}>Cancel</button>
                </div>
              </div>
            )}

            <button disabled={busy} className="sk-btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Submit Application</button>
          </form>
        )}
      </div>
    </div>
  );
}
const F = ({ label, children }) => <div><label className="sk-label">{label}</label>{children}</div>;
