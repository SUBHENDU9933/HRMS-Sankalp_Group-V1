import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import SelfieCapture from "@/components/SelfieCapture";
import { createVisit, uploadDataUrl, uploadFile } from "@/lib/data";
import { ArrowLeft, Camera, MapPin, Upload, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

export default function AddVisit() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState("lead");
  const [showCapture, setShowCapture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfie, setSelfie] = useState(null);
  const [gps, setGps] = useState(null);
  const [sitePhotos, setSitePhotos] = useState([]);
  const [floorPlanUrl, setFloorPlanUrl] = useState("");
  const [status, setStatus] = useState("completed");
  const [notes, setNotes] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [requirement, setRequirement] = useState("");
  const [budget, setBudget] = useState("");
  const [measurement, setMeasurement] = useState("");
  const [reqSheet, setReqSheet] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectStatus, setProjectStatus] = useState("site_check");

  const onCapture = async (dataUrl, gpsData) => {
    setShowCapture(false);
    setBusy(true);
    try {
      const url = await uploadDataUrl(dataUrl, "visits/selfies");
      setSelfie(url); setGps(gpsData);
      toast.success("Selfie captured");
    } catch (e) { toast.error("Upload failed: " + e.message); }
    finally { setBusy(false); }
  };

  const onSitePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadFile(f, "visits/photos"));
      setSitePhotos(prev => [...prev, ...urls]);
      toast.success(`${urls.length} photo(s) uploaded`);
    } catch { toast.error("Photo upload failed"); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const onFloorPlan = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try { const url = await uploadFile(f, "visits/plans"); setFloorPlanUrl(url); toast.success("Floor plan uploaded"); }
    catch { toast.error("Upload failed"); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selfie) { toast.error("Please capture selfie proof"); return; }
    setBusy(true);
    try {
      const payload = {
        employee_id: user.id,
        visit_type: type, status, notes,
        selfie_url: selfie, latitude: gps?.latitude, longitude: gps?.longitude,
        site_photos: sitePhotos, floor_plan_url: floorPlanUrl,
      };
      if (type === "lead") Object.assign(payload, { lead_name: leadName, lead_phone: leadPhone, lead_location: leadLocation, customer_requirement: requirement, budget, measurement_details: measurement, requirement_sheet: reqSheet });
      else Object.assign(payload, { project_name: projectName, project_location: projectLocation, project_status: projectStatus });
      const v = await createVisit(payload);
      toast.success("Visit logged");
      nav(`/visits/${v.id}`);
    } catch (e) { toast.error(e.message || "Failed to save"); }
    finally { setBusy(false); }
  };

  return (
    <div className="sk-page max-w-3xl mx-auto" data-testid="add-visit-page">
      <Link to="/visits" className="text-sm text-slate-600 inline-flex items-center gap-1.5 hover:text-slate-900 mb-3"><ArrowLeft className="w-4 h-4" /> Cancel</Link>
      <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Log a Field Visit</h1>
      <p className="text-sm text-slate-500 mt-1 mb-5">Selfie + GPS proof is mandatory</p>
      <div className="grid grid-cols-2 gap-2 mb-5 sk-card p-1.5">
        <button type="button" onClick={() => setType("lead")} className={`py-2.5 rounded-lg font-semibold text-sm transition ${type === "lead" ? "bg-[#4DA3FF] text-white" : "text-slate-600 hover:bg-slate-50"}`}>Lead Visit</button>
        <button type="button" onClick={() => setType("project")} className={`py-2.5 rounded-lg font-semibold text-sm transition ${type === "project" ? "bg-[#FFA94D] text-white" : "text-slate-600 hover:bg-slate-50"}`}>Project Visit</button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <div className="sk-card p-5">
          <div className="font-heading font-bold mb-3">Selfie + GPS Proof <span className="text-red-500">*</span></div>
          {selfie ? (
            <div className="flex gap-3 items-start flex-wrap">
              <img src={selfie} alt="" className="w-40 h-40 object-cover rounded-xl border" />
              <div className="flex-1 min-w-[200px] space-y-2">
                {gps && <div className="gps-pill"><MapPin className="w-3.5 h-3.5 text-[#FFA94D]" />{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}</div>}
                <button type="button" onClick={() => setShowCapture(true)} className="sk-btn-ghost text-sm"><Camera className="w-4 h-4" /> Re-capture</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCapture(true)} className="sk-btn-accent w-full md:w-auto"><Camera className="w-4 h-4" /> Open Camera</button>
          )}
        </div>
        {type === "lead" ? (
          <div className="sk-card p-5 space-y-4">
            <div className="font-heading font-bold">Lead Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="Lead Name *"><input required value={leadName} onChange={e => setLeadName(e.target.value)} className="sk-input" /></F>
              <F label="Phone"><input value={leadPhone} onChange={e => setLeadPhone(e.target.value)} className="sk-input" /></F>
            </div>
            <F label="Location"><input value={leadLocation} onChange={e => setLeadLocation(e.target.value)} className="sk-input" /></F>
            <F label="Customer Requirement"><textarea rows={3} value={requirement} onChange={e => setRequirement(e.target.value)} className="sk-input" /></F>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="Budget"><input value={budget} onChange={e => setBudget(e.target.value)} className="sk-input" placeholder="e.g. 3-5 Lakh" /></F>
              <F label="Measurement Details"><input value={measurement} onChange={e => setMeasurement(e.target.value)} className="sk-input" /></F>
            </div>
            <F label="Requirement Sheet"><textarea rows={3} value={reqSheet} onChange={e => setReqSheet(e.target.value)} className="sk-input" /></F>
          </div>
        ) : (
          <div className="sk-card p-5 space-y-4">
            <div className="font-heading font-bold">Project Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="Project Name *"><input required value={projectName} onChange={e => setProjectName(e.target.value)} className="sk-input" /></F>
              <F label="Project Status">
                <select value={projectStatus} onChange={e => setProjectStatus(e.target.value)} className="sk-input">
                  <option value="site_check">Site check</option><option value="in_progress">In progress</option>
                  <option value="inspection">Inspection</option><option value="completed">Completed</option>
                </select>
              </F>
            </div>
            <F label="Location"><input value={projectLocation} onChange={e => setProjectLocation(e.target.value)} className="sk-input" /></F>
          </div>
        )}
        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Uploads</div>
          <F label="Site Photos">
            <label className="sk-btn-ghost cursor-pointer w-fit"><Upload className="w-4 h-4" /> Add photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={onSitePhotos} />
            </label>
            {sitePhotos.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                {sitePhotos.map((u, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={u} alt="" className="w-full h-full object-cover rounded-lg border" />
                    <button type="button" onClick={() => setSitePhotos(p => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white grid place-items-center"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </F>
          {type === "lead" && (
            <F label="Floor Plan">
              {floorPlanUrl ? (
                <div className="flex items-center gap-3">
                  <a href={floorPlanUrl} target="_blank" rel="noreferrer" className="text-[#4DA3FF] font-medium inline-flex items-center gap-1"><FileText className="w-4 h-4" /> View uploaded</a>
                  <button type="button" onClick={() => setFloorPlanUrl("")} className="text-xs text-red-500">Remove</button>
                </div>
              ) : (
                <label className="sk-btn-ghost cursor-pointer w-fit"><Upload className="w-4 h-4" /> Upload floor plan
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFloorPlan} />
                </label>
              )}
            </F>
          )}
        </div>
        <div className="sk-card p-5 space-y-4">
          <F label="Visit Status">
            <select value={status} onChange={e => setStatus(e.target.value)} className="sk-input">
              <option value="completed">Completed</option><option value="follow_up">Follow-up required</option>
            </select>
          </F>
          <F label="Notes"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="sk-input" /></F>
        </div>
        <div className="flex justify-end gap-2 pb-4">
          <Link to="/visits" className="sk-btn-ghost">Cancel</Link>
          <button disabled={busy} className="sk-btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} {busy ? "Saving…" : "Save Visit"}</button>
        </div>
      </form>
      {showCapture && <SelfieCapture employeeName={user.name} onCapture={onCapture} onClose={() => setShowCapture(false)} />}
    </div>
  );
}
const F = ({ label, children }) => <div><label className="sk-label">{label}</label>{children}</div>;
