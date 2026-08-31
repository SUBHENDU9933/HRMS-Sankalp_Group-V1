import { useEffect, useState } from "react";
import {
  Upload, Camera, CheckCircle2, Loader2, Search, Briefcase, User, Phone, Mail,
  Star, Building2, IndianRupee, GraduationCap, MapPin, MessageSquare, FileText,
  Shield, ArrowRight, TrendingUp, Users, Target, Facebook, Instagram, AtSign, Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { LOGO } from "@/lib/utils-app";
import {
  listOpenPositions, checkDuplicateApplication, submitApplication, uploadFile, sendStatusEmail,
} from "@/lib/recruitment";
import { uploadDataUrl } from "@/lib/supabase";
import PhotoCapture from "@/components/PhotoCapture";

const MAX_CV_MB = 3;
const MAX_PHOTO_MB = 3;
const ROYAL = "#0D47A1";
const ORANGE = "#FF6A00";
const GOOGLE_BUSINESS_URL = "https://share.google/STNTYyQmAtCLrH4fB";
const SOCIALS = [
  { Icon: Facebook, href: "https://www.facebook.com/sankalpinterior" },
  { Icon: Instagram, href: "https://www.instagram.com/sankalp_interior_solution/" },
  { Icon: AtSign, href: "https://www.threads.com/@sankalp_interior_solution" },
  { Icon: Youtube, href: "https://www.youtube.com/@SankalpInterior" },
];

const empty = {
  job_opening_id: "", name: "", email: "", phone: "",
  experience_years: "", current_company: "", education: "",
  address_line: "", city_town_area: "", pin_code: "", state: "",
  expected_salary: "", cover_note: "", declaration: false,
  website: "", // honeypot — real humans never fill this
};
const EXPERIENCE_OPTIONS = [
  { value: "0", label: "0 - Freshers" },
  ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  { value: "11", label: "More than 10" },
];
const EDUCATION_OPTIONS = ["10th", "10+2 / HS", "Diploma", "Graduate", "Masters", "Others"];

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
  const [geo, setGeo] = useState({ lat: null, lng: null, accuracy: null, status: "idle" }); // mandatory — must be captured before submission

  useEffect(() => {
    listOpenPositions().then(setOpenings).catch(() => toast.error("Could not load open positions")).finally(() => setLoading(false));
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) { setGeo(g => ({ ...g, status: "error" })); return; }
    setGeo(g => ({ ...g, status: "requesting" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, status: "ok" }),
      () => setGeo(g => ({ ...g, status: "error" })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  // Auto-request as soon as the form is reachable — same pattern as the Agreements
  // signing flow. Here it IS required (blocks submission if not granted).
  useEffect(() => { if (!loading) requestLocation(); }, [loading]);

  const selectedOpening = openings.find(o => o.id === data.job_opening_id) || null;

  const onCv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(pdf|doc|docx|jpe?g)$/i.test(f.name)) { toast.error("CV must be a PDF, Word document, or JPG"); return; }
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
    if (!data.experience_years) { toast.error("Please select your total experience"); return; }
    if (!data.education) { toast.error("Please select your education qualification"); return; }
    if (!data.address_line.trim() || !data.city_town_area.trim() || !data.pin_code.trim() || !data.state.trim()) {
      toast.error("Please complete your full current address"); return;
    }
    if (geo.status !== "ok") {
      toast.error("Location access is required to submit — please allow location and try again.");
      if (geo.status !== "requesting") requestLocation();
      return;
    }
    if (!data.declaration) { toast.error("Please confirm the declaration before submitting"); return; }

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
        current_address: `${data.address_line.trim()}, ${data.city_town_area.trim()}, ${data.state.trim()} - ${data.pin_code.trim()}`,
        expected_salary: data.expected_salary ? Number(data.expected_salary) : null,
        cover_note: data.cover_note || null,
        cv_url, photo_url,
        latitude: geo.lat, longitude: geo.lng, location_accuracy: geo.accuracy,
      };
      const created = await submitApplication(payload);
      setDone({
        application_number: created.application_number,
        name: payload.name,
        position: selectedOpening?.title || "",
      });
      sendStatusEmail(created.id, "submitted"); // fire-and-forget — never blocks the confirmation screen
    } catch (err) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;

  if (done) {
    return (
      <div className="min-h-screen bg-[#F3F6FC] grid place-items-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 grid place-items-center" style={{ background: "#10B98118" }}>
            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
          </div>
          <h1 className="text-xl font-extrabold" style={{ color: ROYAL }}>Application received!</h1>
          <div className="text-left bg-slate-50 border border-slate-100 rounded-xl p-4 mt-4 space-y-1.5 text-sm">
            <div><span className="text-slate-400">Name:</span> <span className="font-semibold text-slate-800">{done.name}</span></div>
            <div><span className="text-slate-400">Applied For:</span> <span className="font-semibold text-slate-800">{done.position}</span></div>
            <div><span className="text-slate-400">Application No:</span> <span className="font-mono font-bold" style={{ color: ROYAL }}>{done.application_number}</span></div>
          </div>
          <p className="text-xs text-slate-500 mt-4">We'll email you at each step of the process. Thank you for applying to Sankalp Group.</p>
          <a href="/status" className="text-xs font-semibold mt-3 inline-block" style={{ color: ORANGE }}>Check your application status anytime →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F6FC]">
      {showCamera && <PhotoCapture onCapture={onCameraCapture} onClose={() => setShowCamera(false)} />}

      {/* ============ Header ============ */}
      <header className="bg-white sticky top-0 z-20 border-b border-slate-100">
        <div className="max-w-[1160px] mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={LOGO} alt="Sankalp Group" className="h-10 object-contain" />
          </div>
          <a href="/status" className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border" style={{ borderColor: `${ROYAL}30`, color: ROYAL }}>
            <Search className="w-4 h-4" /> Check Status
          </a>
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, #0A2E6E 0%, ${ROYAL} 55%, #123E96 100%)` }}>
        {/* diagonal accent stripes */}
        <div className="absolute -top-10 -left-10 w-72 h-72 opacity-90 pointer-events-none" style={{
          background: `repeating-linear-gradient(-45deg, ${ROYAL} 0 26px, transparent 26px 30px, ${ORANGE} 30px 46px, transparent 46px 50px)`,
          maskImage: "linear-gradient(135deg, black 40%, transparent 75%)",
          WebkitMaskImage: "linear-gradient(135deg, black 40%, transparent 75%)",
        }} />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "22px 22px",
        }} />
        <div className="relative max-w-[1160px] mx-auto px-5 py-14 md:py-20">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight max-w-2xl">
            Build Your Career With <span style={{ color: ORANGE }}>Sankalp Group</span>
          </h1>
          <p className="text-slate-200 mt-4 max-w-xl text-sm md:text-base">
            Explore opportunities, share your profile, and take the next step in your career with us.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Pill icon={TrendingUp} text="Growth Opportunities" />
            <Pill icon={Users} text="Professional Work Culture" />
            <Pill icon={Target} text="Build a Better Tomorrow" />
          </div>
        </div>
      </section>

      {/* ============ Form ============ */}
      <div className="max-w-[1160px] mx-auto px-5 -mt-8 md:-mt-10 pb-16 relative">
        {openings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center text-slate-500 border border-slate-100">There are no open positions right now. Please check back later.</div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5" style={{ background: `linear-gradient(90deg, ${ROYAL}, #1D5FC9)` }}>
              <div className="text-white font-extrabold text-lg">Sankalp Group — Job Application</div>
              <div className="text-blue-100 text-xs mt-0.5">Join our team and shape inspiring spaces.</div>
            </div>

            <div className="p-5 md:p-8 space-y-6">
              <Section n="01" icon={Briefcase} title="Position Details">
                <FI label="Position Applying For *">
                  <select required className={inputCls} value={data.job_opening_id}
                    onChange={e => { setData({ ...data, job_opening_id: e.target.value }); setConfirmedDespiteDup(false); }}>
                    <option value="">Select a position…</option>
                    {openings.map(o => <option key={o.id} value={o.id}>{o.title}{o.department ? ` — ${o.department}` : ""}</option>)}
                  </select>
                </FI>
                <div className="text-xs text-slate-400 -mt-3">Choose the role that matches your skills and career goals at Sankalp Group.</div>
                {selectedOpening && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                    {(selectedOpening.employment_type || selectedOpening.experience_required || selectedOpening.salary_range || selectedOpening.location || selectedOpening.work_type) && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {selectedOpening.employment_type && <div><span className="text-slate-400">Type:</span> <span className="font-medium">{selectedOpening.employment_type}</span></div>}
                        {selectedOpening.experience_required && <div><span className="text-slate-400">Experience:</span> <span className="font-medium">{selectedOpening.experience_required}</span></div>}
                        {selectedOpening.salary_range && <div><span className="text-slate-400">Salary:</span> <span className="font-medium">{selectedOpening.salary_range}</span></div>}
                        {selectedOpening.location && <div><span className="text-slate-400">Location:</span> <span className="font-medium">{selectedOpening.location}</span></div>}
                        {selectedOpening.work_type && <div className="col-span-2"><span className="text-slate-400">Work Type:</span> <span className="font-medium">{selectedOpening.work_type}</span></div>}
                      </div>
                    )}
                    {selectedOpening.description && (
                      <div className="text-sm text-slate-600 whitespace-pre-wrap pt-2 border-t border-slate-200">{selectedOpening.description}</div>
                    )}
                    <JobDetailList title="Skills Required" text={selectedOpening.skills} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <JobDetailList title="Key Responsibilities" text={selectedOpening.responsibilities} />
                      <JobDetailList title="Eligibility" text={selectedOpening.eligibility} />
                    </div>
                  </div>
                )}
              </Section>

              <Section n="02" icon={User} title="Personal Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FI label="Full Name *"><IconInput icon={User} required placeholder="Enter your full name" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></FI>
                  <FI label="Phone *"><IconInput icon={Phone} required placeholder="Enter your phone number" value={data.phone} onChange={e => { setData({ ...data, phone: e.target.value }); setConfirmedDespiteDup(false); }} /></FI>
                  <FI label="Email *"><IconInput icon={Mail} type="email" required placeholder="Enter your email address" value={data.email} onChange={e => { setData({ ...data, email: e.target.value }); setConfirmedDespiteDup(false); }} /></FI>
                  <FI label="Total Experience (Years) *">
                    <select required className={inputCls.replace("pl-10", "pl-3")} value={data.experience_years} onChange={e => setData({ ...data, experience_years: e.target.value })}>
                      <option value="">Select experience…</option>
                      {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </FI>
                </div>
              </Section>

              <Section n="03" icon={Building2} title="Professional Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FI label="Current / Last Company"><IconInput icon={Building2} placeholder="Enter your company name" value={data.current_company} onChange={e => setData({ ...data, current_company: e.target.value })} /></FI>
                  <FI label="Expected Salary (₹)"><IconInput icon={IndianRupee} type="number" min="0" placeholder="e.g. 6,00,000" value={data.expected_salary} onChange={e => setData({ ...data, expected_salary: e.target.value })} /></FI>
                  <FI label="Education Qualification *">
                    <select required className={inputCls.replace("pl-10", "pl-3")} value={data.education} onChange={e => setData({ ...data, education: e.target.value })}>
                      <option value="">Select qualification…</option>
                      {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </FI>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Current Address *</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                      <textarea required rows={2} className={`${inputCls} h-auto pl-10 pt-3`} placeholder="House / Flat No., Street, Landmark" value={data.address_line} onChange={e => setData({ ...data, address_line: e.target.value })} />
                    </div>
                    <IconInput icon={Building2} required placeholder="City / Town / Area" value={data.city_town_area} onChange={e => setData({ ...data, city_town_area: e.target.value })} />
                    <IconInput icon={MapPin} required placeholder="PIN Code" value={data.pin_code} onChange={e => setData({ ...data, pin_code: e.target.value })} />
                    <IconInput icon={MapPin} required placeholder="State" value={data.state} onChange={e => setData({ ...data, state: e.target.value })} />
                  </div>
                </div>
                <FI label="Cover Note (Optional)">
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                    <textarea rows={3} className={`${inputCls} h-auto pl-10 pt-3`} placeholder="Write something about yourself, your experience, or why you're a great fit…" value={data.cover_note} onChange={e => setData({ ...data, cover_note: e.target.value })} />
                  </div>
                </FI>
                {/* honeypot — hidden from real users via CSS, bots often fill every field */}
                <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                  <input tabIndex={-1} autoComplete="off" value={data.website} onChange={e => setData({ ...data, website: e.target.value })} />
                </div>
              </Section>

              <Section n="04" icon={FileText} title="Documents & Media">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Upload Your CV *</label>
                    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition hover:bg-slate-50" style={{ borderColor: `${ROYAL}40` }}>
                      <Upload className="w-6 h-6" style={{ color: ROYAL }} />
                      <div className="text-sm font-semibold" style={{ color: ROYAL }}>{cvFile ? cvFile.name : "Tap to choose file"}</div>
                      <div className="text-[11px] text-slate-400">PDF / DOC / DOCX / JPG • Max {MAX_CV_MB}MB</div>
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg" className="hidden" onChange={onCv} />
                    </label>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Profile Photo *</label>
                    <div className="flex items-center gap-4">
                      {photoDataUrl
                        ? <img src={photoDataUrl} alt="" className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: ROYAL }} />
                        : <div className="w-20 h-20 rounded-full bg-slate-100 grid place-items-center text-slate-400 shrink-0"><User className="w-8 h-8" /></div>}
                      <div className="flex flex-col gap-2 flex-1">
                        <label className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 cursor-pointer border" style={{ borderColor: `${ROYAL}30`, color: ROYAL }}>
                          <Upload className="w-4 h-4" /> Upload
                          <input type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
                        </label>
                        <button type="button" className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 border" style={{ borderColor: `${ROYAL}30`, color: ROYAL }} onClick={() => setShowCamera(true)}>
                          <Camera className="w-4 h-4" /> Take Photo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {dupWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  You already applied for this position on {new Date(dupWarning.applied_at).toLocaleDateString()} (Ref: {dupWarning.application_number}, status: {dupWarning.status}).
                  <div className="flex gap-2 mt-3">
                    <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ROYAL }} onClick={() => { setConfirmedDespiteDup(true); setDupWarning(null); }}>Submit anyway</button>
                    <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold border border-slate-200" onClick={() => setDupWarning(null)}>Cancel</button>
                  </div>
                </div>
              )}

              <Section n="05" icon={Shield} title="Confirm & Submit">
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-slate-600">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ROYAL }} />
                  Your information is secure with us and will only be used for recruitment purposes.
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: geo.status === "ok" ? "#059669" : "#DC2626" }}>
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {geo.status === "ok" ? "Location captured ✓ (required)"
                    : geo.status === "requesting" ? "Requesting location…"
                    : <button type="button" onClick={requestLocation} className="underline font-semibold">Location sharing is required — tap to allow</button>}
                </div>
                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" required checked={data.declaration} onChange={e => setData({ ...data, declaration: e.target.checked })} className="mt-0.5 shrink-0" />
                  I hereby declare that all the information provided above is true and correct to the best of my knowledge.
                </label>
                <button disabled={busy} className="w-full h-13 py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-70" style={{ background: `linear-gradient(90deg, ${ROYAL}, #1D5FC9)` }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Application <ArrowRight className="w-4 h-4" /></>}
                </button>
              </Section>
            </div>
          </form>
        )}
      </div>

      {/* ============ Footer ============ */}
      <footer style={{ background: ROYAL }} className="text-white">
        <div className="max-w-[1160px] mx-auto px-5 py-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-1.5"><img src={LOGO} alt="" className="h-8 object-contain" /></div>
              <div className="font-bold">Sankalp Group &amp; Business Solutions</div>
            </div>
            <div className="text-blue-100 text-xs mt-2 max-w-xs">Building inspiring spaces. Delivering trusted solutions.</div>
            <div className="flex gap-2 mt-3">
              {SOCIALS.map(({ Icon, href }, i) => (
                <a key={i} href={href} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-full bg-white grid place-items-center hover:opacity-80 transition"><Icon className="w-3.5 h-3.5" style={{ color: ROYAL }} /></a>
              ))}
            </div>
          </div>
          <div className="text-xs text-blue-50 space-y-1">
            <div className="font-bold text-[11px] tracking-wider mb-1" style={{ color: ORANGE }}>CONTACT US</div>
            <a href={GOOGLE_BUSINESS_URL} target="_blank" rel="noreferrer" className="block hover:underline">Kolkata, West Bengal, India</a>
            <div>+91 97482 97025</div>
            <div>care.sankalpgrp@gmail.com</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const inputCls = "w-full h-[52px] pl-10 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 text-sm transition bg-white";
function IconInput({ icon: Icon, className = "", ...props }) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input {...props} className={`${inputCls} ${className}`} style={{ "--tw-ring-color": `${ROYAL}30` }} />
    </div>
  );
}
const FI = ({ label, children }) => <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>{children}</div>;
const Pill = ({ icon: Icon, text }) => (
  <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1.5 text-xs font-medium text-white">
    <Icon className="w-3.5 h-3.5" style={{ color: ORANGE }} /> {text}
  </div>
);
function Section({ n, icon: Icon, title, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold shrink-0" style={{ background: ORANGE }}>{n}</div>
        <Icon className="w-4 h-4" style={{ color: ROYAL }} />
        <div className="font-bold text-slate-800">{title}</div>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${ORANGE}50, transparent)` }} />
      </div>
      <div className="space-y-4 pl-0 md:pl-1">{children}</div>
    </div>
  );
}
function JobDetailList({ title, text }) {
  if (!text) return null;
  const items = text.split("\n").map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="pt-2 border-t border-slate-200">
      <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: ROYAL }}>{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ORANGE }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
