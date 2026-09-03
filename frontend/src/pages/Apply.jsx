import { useEffect, useState } from "react";
import {
  Upload, Camera, CheckCircle2, Loader2, Search, Briefcase, User, Phone, Mail,
  Building2, IndianRupee, GraduationCap, MapPin, MessageSquare, FileText,
  Shield, ArrowRight, TrendingUp, Users, Target, Facebook, Instagram, AtSign, Youtube,
  Sparkles, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { listOpenPositions, checkDuplicateApplication, submitApplication, uploadFile, sendStatusEmail } from "@/lib/recruitment";
import { uploadDataUrl } from "@/lib/supabase";
import PhotoCapture from "@/components/PhotoCapture";

const LOGO = "/sankalp-group-logo-email.png";
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
  job_opening_id: "", name: "", email: "", phone: "", experience_years: "", current_company: "", education: "",
  address_line: "", city_town_area: "", pin_code: "", state: "", expected_salary: "", cover_note: "", declaration: false, website: "",
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
  const [done, setDone] = useState(null);
  const [dupWarning, setDupWarning] = useState(null);
  const [confirmedDespiteDup, setConfirmedDespiteDup] = useState(false);
  const [geo, setGeo] = useState({ lat: null, lng: null, accuracy: null, status: "idle" });

  useEffect(() => {
    listOpenPositions().then(setOpenings).catch(() => toast.error("Could not load open positions")).finally(() => setLoading(false));
  }, []);
  const requestLocation = () => {
    if (!navigator.geolocation) { setGeo(g => ({ ...g, status: "error" })); return; }
    setGeo(g => ({ ...g, status: "requesting" }));
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, status: "ok" }),
      () => setGeo(g => ({ ...g, status: "error" })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  useEffect(() => { if (!loading) requestLocation(); }, [loading]);
  const selectedOpening = openings.find(o => o.id === data.job_opening_id) || null;
  const onCv = e => { const f = e.target.files?.[0]; if (!f) return; if (!/\.(pdf|doc|docx|jpe?g)$/i.test(f.name)) { toast.error("CV must be a PDF, Word document, or JPG"); return; } if (f.size > MAX_CV_MB * 1024 * 1024) { toast.error(`CV must be under ${MAX_CV_MB}MB`); return; } setCvFile(f); };
  const onPhotoFile = e => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith("image/")) { toast.error("Photo must be an image"); return; } if (f.size > MAX_PHOTO_MB * 1024 * 1024) { toast.error(`Photo must be under ${MAX_PHOTO_MB}MB`); return; } setPhotoFile(f); setPhotoDataUrl(URL.createObjectURL(f)); };
  const onCameraCapture = dataUrl => { setPhotoDataUrl(dataUrl); setPhotoFile(null); setShowCamera(false); };
  const checkDup = async () => { if (!data.job_opening_id || !data.email || !data.phone) return null; try { return await checkDuplicateApplication(data.job_opening_id, data.email.trim(), data.phone.trim()); } catch { return null; } };
  const submit = async e => {
    e.preventDefault();
    if (data.website) return;
    if (!cvFile) return toast.error("Please attach your CV");
    if (!photoDataUrl) return toast.error("Please add a photo (upload or capture)");
    if (!data.experience_years) return toast.error("Please select your total experience");
    if (!data.education) return toast.error("Please select your education qualification");
    if (!data.address_line.trim() || !data.city_town_area.trim() || !data.pin_code.trim() || !data.state.trim()) return toast.error("Please complete your full current address");
    if (geo.status !== "ok") { toast.error("Location access is required to submit — please allow location and try again."); if (geo.status !== "requesting") requestLocation(); return; }
    if (!data.declaration) return toast.error("Please confirm the declaration before submitting");
    if (!confirmedDespiteDup) { const dup = await checkDup(); if (dup) { setDupWarning(dup); return; } }
    setBusy(true);
    try {
      const cv_url = await uploadFile(cvFile, "recruitment/cv");
      const photo_url = photoFile ? await uploadFile(photoFile, "recruitment/photos") : await uploadDataUrl(photoDataUrl, "recruitment/photos");
      const payload = {
        job_opening_id: data.job_opening_id, name: data.name.trim(), email: data.email.trim().toLowerCase(), phone: data.phone.trim(),
        experience_years: data.experience_years ? Number(data.experience_years) : null, current_company: data.current_company || null,
        education: data.education || null, current_address: `${data.address_line.trim()}, ${data.city_town_area.trim()}, ${data.state.trim()} - ${data.pin_code.trim()}`,
        expected_salary: data.expected_salary ? Number(data.expected_salary) : null, cover_note: data.cover_note || null,
        cv_url, photo_url, latitude: geo.lat, longitude: geo.lng, location_accuracy: geo.accuracy,
      };
      const created = await submitApplication(payload);
      setDone({ application_number: created.application_number, name: payload.name, position: selectedOpening?.title || "" });
      sendStatusEmail(created.id, "submitted");
    } catch (err) { toast.error(err.message || "Submission failed. Please try again."); } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#F3F6FC] text-slate-500">Loading careers…</div>;
  if (done) return <SuccessScreen done={done} />;

  return <div className="min-h-screen bg-[#F3F6FC] text-slate-800">
    {showCamera && <PhotoCapture onCapture={onCameraCapture} onClose={() => setShowCamera(false)} />}
    <header className="bg-white border-b border-slate-100 relative z-20">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7 h-[78px] flex items-center justify-between">
        <a href="/apply" className="flex items-center"><img src={LOGO} alt="Sankalp Group & Business Solutions" className="w-[205px] md:w-[245px] h-auto object-contain" /></a>
        <a href="/status" className="inline-flex items-center gap-2 rounded-full border-2 px-4 md:px-5 py-2.5 text-xs md:text-sm font-bold bg-white hover:bg-blue-50 transition" style={{ borderColor: `${ROYAL}70`, color: ROYAL }}><Search className="w-4 h-4" /> Check Status</a>
      </div>
    </header>

    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-blue-50/40" />
      <div className="absolute right-0 top-0 w-full md:w-[55%] h-full bg-cover bg-center opacity-90" style={{ backgroundImage: "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,.82) 22%, rgba(255,255,255,.15) 65%), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=85')" }} />
      <div className="absolute left-0 top-0 w-40 h-24" style={{ background: `linear-gradient(135deg, ${ROYAL} 0 42%, transparent 42% 100%)` }} />
      <div className="absolute left-0 top-0 w-56 h-28" style={{ background: `linear-gradient(135deg, transparent 0 30%, ${ORANGE} 30% 47%, transparent 47% 100%)` }} />
      <div className="relative max-w-[1180px] mx-auto px-5 md:px-7 py-12 md:py-16 min-h-[330px] flex items-center">
        <div className="max-w-[610px] pt-3">
          <div className="text-xs font-extrabold uppercase tracking-[.2em] mb-3" style={{ color: ORANGE }}><Sparkles className="inline w-4 h-4 mr-1 -mt-1" /> Sankalp Group Careers</div>
          <h1 className="text-4xl md:text-6xl font-black leading-[1.03] tracking-tight" style={{ color: ROYAL }}>Build Your Career With<br /><span>Sankalp Group</span></h1>
          <div className="h-1 w-16 my-4 rounded-full" style={{ background: ORANGE }} />
          <p className="text-base md:text-lg text-slate-600 max-w-xl">Explore opportunities, share your profile, and take the next step in your career with us.</p>
          <div className="flex flex-wrap gap-2.5 mt-6"><Pill icon={TrendingUp} text="Growth Opportunities" /><Pill icon={Users} text="Professional Work Culture" /><Pill icon={Target} text="Build a Better Tomorrow" /></div>
        </div>
      </div>
    </section>

    <main className="relative max-w-[1120px] mx-auto px-4 md:px-7 -mt-7 md:-mt-9 pb-14">
      {openings.length === 0 ? <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-12 text-center">There are no open positions right now. Please check back later.</div> :
      <form onSubmit={submit} className="bg-white rounded-[24px] shadow-[0_20px_60px_rgba(13,71,161,.12)] border border-blue-100 overflow-hidden">
        <div className="relative mx-auto max-w-[600px] -mt-0 md:-mt-1 px-5 py-4 text-center text-white" style={{ background: `linear-gradient(100deg, ${ROYAL}, #1D5FC9)` }}>
          <div className="text-xl font-black">Sankalp Group — Job Application</div><div className="text-blue-100 text-xs mt-1">Join our team and shape inspiring spaces.</div>
        </div>
        <div className="p-5 md:p-8 space-y-5">
          <Section n="01" icon={Briefcase} title="Position Details">
            <FI label="Position Applying For *"><div className="relative"><select required className={selectCls} value={data.job_opening_id} onChange={e => { setData({ ...data, job_opening_id: e.target.value }); setConfirmedDespiteDup(false); }}><option value="">Select a position…</option>{openings.map(o => <option key={o.id} value={o.id}>{o.title}{o.department ? ` — ${o.department}` : ""}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400" /></div></FI>
            <div className="text-xs text-slate-500">Choose the role that matches your skills and career goals at Sankalp Group.</div>
            {selectedOpening && <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-3"><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">{selectedOpening.employment_type && <Meta label="Type" value={selectedOpening.employment_type} />}{selectedOpening.experience_required && <Meta label="Experience" value={selectedOpening.experience_required} />}{selectedOpening.salary_range && <Meta label="Salary" value={selectedOpening.salary_range} />}{selectedOpening.location && <Meta label="Location" value={selectedOpening.location} />}</div>{selectedOpening.description && <div className="text-sm text-slate-600 whitespace-pre-wrap pt-2 border-t border-blue-100">{selectedOpening.description}</div>}<JobDetailList title="Skills Required" text={selectedOpening.skills} /><div className="grid md:grid-cols-2 gap-4"><JobDetailList title="Key Responsibilities" text={selectedOpening.responsibilities} /><JobDetailList title="Eligibility" text={selectedOpening.eligibility} /></div></div>}
          </Section>
          <Section n="02" icon={User} title="Personal Information">
            <div className="grid md:grid-cols-2 gap-4"><FI label="Full Name *"><IconInput icon={User} required placeholder="Enter your full name" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></FI><FI label="Phone *"><IconInput icon={Phone} required placeholder="Enter your phone number" value={data.phone} onChange={e => { setData({ ...data, phone: e.target.value }); setConfirmedDespiteDup(false); }} /></FI><FI label="Email *"><IconInput icon={Mail} type="email" required placeholder="Enter your email address" value={data.email} onChange={e => { setData({ ...data, email: e.target.value }); setConfirmedDespiteDup(false); }} /></FI><FI label="Total Experience (Years) *"><select required className={plainSelectCls} value={data.experience_years} onChange={e => setData({ ...data, experience_years: e.target.value })}><option value="">Select experience…</option>{EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></FI></div>
          </Section>
          <Section n="03" icon={Building2} title="Professional Information">
            <div className="grid md:grid-cols-2 gap-4"><FI label="Current / Last Company"><IconInput icon={Building2} placeholder="Enter your company name" value={data.current_company} onChange={e => setData({ ...data, current_company: e.target.value })} /></FI><FI label="Expected Salary (₹)"><IconInput icon={IndianRupee} type="number" min="0" placeholder="e.g. 6,00,000" value={data.expected_salary} onChange={e => setData({ ...data, expected_salary: e.target.value })} /></FI><FI label="Education Qualification *"><select required className={plainSelectCls} value={data.education} onChange={e => setData({ ...data, education: e.target.value })}><option value="">Select qualification…</option>{EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></FI></div>
            <FI label="Current Address *"><div className="grid md:grid-cols-2 gap-4"><TextIcon icon={MapPin} required rows={2} className="md:col-span-2" placeholder="House / Flat No., Street, Landmark" value={data.address_line} onChange={e => setData({ ...data, address_line: e.target.value })} /><IconInput icon={Building2} required placeholder="City / Town / Area" value={data.city_town_area} onChange={e => setData({ ...data, city_town_area: e.target.value })} /><IconInput icon={MapPin} required placeholder="PIN Code" value={data.pin_code} onChange={e => setData({ ...data, pin_code: e.target.value })} /><IconInput icon={MapPin} required placeholder="State" value={data.state} onChange={e => setData({ ...data, state: e.target.value })} /></div></FI>
            <FI label="Cover Note (Optional)"><TextIcon icon={MessageSquare} rows={3} placeholder="Write something about yourself, your experience, or why you're a great fit…" value={data.cover_note} onChange={e => setData({ ...data, cover_note: e.target.value })} /></FI>
            <div className="absolute -left-[9999px]" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={data.website} onChange={e => setData({ ...data, website: e.target.value })} /></div>
          </Section>
          <Section n="04" icon={FileText} title="Documents & Media">
            <div className="grid md:grid-cols-2 gap-6"><div><FI label="Upload Your CV *"><label className="min-h-[150px] flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer hover:bg-blue-50/50 transition" style={{ borderColor: `${ROYAL}55` }}><Upload className="w-7 h-7" style={{ color: ROYAL }} /><div className="text-sm font-extrabold" style={{ color: ROYAL }}>{cvFile ? cvFile.name : "Upload your CV"}</div><div className="text-xs text-slate-400">Drag & drop your CV here or</div><span className="px-5 py-2 rounded-full text-white text-xs font-bold" style={{ background: ROYAL }}>Choose File</span><div className="text-[10px] text-slate-400">PDF / DOC / DOCX / JPG • Max {MAX_CV_MB}MB</div><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg" className="hidden" onChange={onCv} /></label></FI></div><div><FI label="Profile Photo *"><div className="flex items-center gap-5 min-h-[150px]">{photoDataUrl ? <img src={photoDataUrl} alt="Profile preview" className="w-24 h-24 rounded-full object-cover border-4 border-blue-50" /> : <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-blue-50 grid place-items-center text-slate-400"><User className="w-10 h-10" /></div>}<div className="flex-1 space-y-2"><label className="w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 cursor-pointer text-xs font-bold" style={{ borderColor: `${ROYAL}35`, color: ROYAL }}><Upload className="w-4 h-4" /> Upload Photo<input type="file" accept="image/*" className="hidden" onChange={onPhotoFile} /></label><button type="button" onClick={() => setShowCamera(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" style={{ borderColor: `${ROYAL}35`, color: ROYAL }}><Camera className="w-4 h-4" /> Take Photo</button></div></div></FI></div></div>
          </Section>
          {dupWarning && <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">You already applied for this position on {new Date(dupWarning.applied_at).toLocaleDateString()} (Ref: {dupWarning.application_number}, status: {dupWarning.status}).<div className="flex gap-2 mt-3"><button type="button" className="rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: ROYAL }} onClick={() => { setConfirmedDespiteDup(true); setDupWarning(null); }}>Submit anyway</button><button type="button" className="rounded-xl px-4 py-2 text-xs font-bold border bg-white" onClick={() => setDupWarning(null)}>Cancel</button></div></div>}
          <Section n="05" icon={Shield} title="Confirm & Submit"><div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-slate-600"><Shield className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ROYAL }} /> Your information is secure with us and will only be used for recruitment purposes.</div><div className="flex items-center gap-2 text-xs font-semibold" style={{ color: geo.status === "ok" ? "#059669" : "#DC2626" }}><MapPin className="w-4 h-4" />{geo.status === "ok" ? "Location captured ✓ (required)" : geo.status === "requesting" ? "Requesting location…" : <button type="button" className="underline" onClick={requestLocation}>Location sharing is required — tap to allow</button>}</div><label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" required checked={data.declaration} onChange={e => setData({ ...data, declaration: e.target.checked })} className="mt-0.5" /> I hereby declare that all the information provided above is true and correct to the best of my knowledge.</label><button disabled={busy} className="w-full py-4 rounded-xl text-white font-black flex items-center justify-center gap-2 text-base disabled:opacity-60 hover:brightness-105 transition" style={{ background: `linear-gradient(90deg, ${ROYAL}, #1D5FC9)` }}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Submit Application <ArrowRight className="w-5 h-5" /></>}</button></Section>
        </div>
      </form>}
    </main>
    <footer className="text-white" style={{ background: `linear-gradient(120deg, #06295E, ${ROYAL})` }}><div className="max-w-[1180px] mx-auto px-5 md:px-7 py-9 grid md:grid-cols-3 gap-7 items-center"><div><img src={LOGO} alt="Sankalp Group" className="w-[210px] bg-white rounded-lg p-2" /><div className="text-xs text-blue-100 mt-3">Sankalp Group & Business Solutions<br />Building Dreams. Creating Spaces.<br />Careers • Opportunities • Growth</div></div><div className="text-sm md:text-center"><div className="font-extrabold mb-2" style={{ color: ORANGE }}>CONTACT US</div><a href={GOOGLE_BUSINESS_URL} target="_blank" rel="noreferrer" className="text-blue-100 hover:text-white">Kolkata, West Bengal, India</a><div className="text-blue-100 mt-1">+91 97482 97025</div><div className="text-blue-100">care.sankalpgrp@gmail.com</div></div><div className="md:text-right"><div className="font-extrabold mb-2">Follow Us</div><div className="flex md:justify-end gap-2">{SOCIALS.map(({ Icon, href }, i) => <a key={i} href={href} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white grid place-items-center hover:scale-105 transition"><Icon className="w-4 h-4" style={{ color: ROYAL }} /></a>)}</div></div></div><div className="border-t border-white/10 text-center text-[11px] text-blue-100 py-4">© 2026 Sankalp Group. All rights reserved. <span className="mx-2">|</span> Privacy Policy <span className="mx-2">|</span> Terms & Conditions</div></footer>
  </div>;
}

function SuccessScreen({ done }) { return <div className="min-h-screen bg-[#F3F6FC] grid place-items-center px-4"><div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border border-blue-100"><img src={LOGO} alt="Sankalp Group" className="w-[210px] mx-auto mb-6" /><div className="w-16 h-16 rounded-full mx-auto mb-4 grid place-items-center bg-emerald-50"><CheckCircle2 className="w-9 h-9 text-emerald-500" /></div><h1 className="text-2xl font-black" style={{ color: ROYAL }}>Application received!</h1><div className="text-left bg-blue-50/60 border border-blue-100 rounded-2xl p-4 mt-5 space-y-2 text-sm"><div><span className="text-slate-400">Name:</span> <b>{done.name}</b></div><div><span className="text-slate-400">Applied For:</span> <b>{done.position}</b></div><div><span className="text-slate-400">Application No:</span> <span className="font-mono font-black" style={{ color: ROYAL }}>{done.application_number}</span></div></div><p className="text-xs text-slate-500 mt-5">We'll email you at each step of the process. Thank you for applying to Sankalp Group.</p><a href="/status" className="inline-flex items-center gap-1 text-xs font-bold mt-3" style={{ color: ORANGE }}>Check application status <ArrowRight className="w-3.5 h-3.5" /></a></div></div>; }
const inputCls = "w-full h-[52px] pl-10 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm transition bg-white";
const selectCls = "w-full h-[52px] pl-4 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm bg-white appearance-none";
const plainSelectCls = "w-full h-[52px] px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm bg-white";
const FI = ({ label, children }) => <div className="space-y-1.5"><label className="text-xs font-bold text-slate-600">{label}</label>{children}</div>;
function IconInput({ icon: Icon, ...props }) { return <div className="relative"><Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" /><input {...props} className={inputCls} /></div>; }
function TextIcon({ icon: Icon, className = "", ...props }) { return <div className="relative"><Icon className="w-4 h-4 absolute left-3 top-3.5 text-blue-400" /><textarea {...props} className={`${inputCls} h-auto pl-10 pt-3 ${className}`} /></div>; }
function Pill({ icon: Icon, text }) { return <div className="inline-flex items-center gap-2 bg-white/90 border border-blue-100 rounded-full px-3.5 py-2 text-xs font-bold" style={{ color: ROYAL }}><Icon className="w-4 h-4" style={{ color: ORANGE }} />{text}</div>; }
function Section({ n, icon: Icon, title, children }) { return <div className="rounded-2xl border border-blue-100 bg-white p-4 md:p-5 shadow-[0_5px_20px_rgba(13,71,161,.035)]"><div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-black shrink-0" style={{ background: ORANGE }}>{n}</div><div className="w-9 h-9 rounded-xl bg-blue-50 grid place-items-center shrink-0"><Icon className="w-5 h-5" style={{ color: ROYAL }} /></div><div className="font-black text-lg" style={{ color: ROYAL }}>{title}</div><div className="flex-1 h-px ml-1" style={{ background: `linear-gradient(90deg, ${ORANGE}80, transparent)` }} /></div>{children}</div>; }
function Meta({ label, value }) { return <div className="bg-white rounded-lg border border-blue-100 px-3 py-2"><div className="text-[10px] text-slate-400 uppercase font-bold">{label}</div><div className="font-semibold text-slate-700 mt-0.5 truncate">{value}</div></div>; }
function JobDetailList({ title, text }) { if (!text) return null; const items = text.split("\n").map(s => s.trim()).filter(Boolean); return <div className="pt-2 border-t border-blue-100"><div className="text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: ROYAL }}>{title}</div><ul className="space-y-1">{items.map((it,i)=><li key={i} className="text-xs text-slate-600 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ORANGE }} />{it}</li>)}</ul></div>; }
