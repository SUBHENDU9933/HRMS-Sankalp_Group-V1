import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getVisit, deleteVisit } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils-app";
import { ArrowLeft, MapPin, Phone, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function VisitDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [v, setV] = useState(null);

  useEffect(() => { getVisit(id).then(setV).catch(() => nav("/visits")); }, [id, nav]);

  const del = async () => {
    if (!window.confirm("Delete this visit permanently?")) return;
    await deleteVisit(id);
    toast.success("Visit deleted");
    nav("/visits");
  };

  if (!v) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="sk-page space-y-5 max-w-4xl" data-testid="visit-detail">
      <div className="flex items-center justify-between">
        <Link to="/visits" className="text-sm text-slate-600 inline-flex items-center gap-1.5 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Back to visits</Link>
        {isAdmin && <button onClick={del} className="text-sm text-red-600 hover:text-red-700 inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Delete</button>}
      </div>
      <div className="sk-card p-5 md:p-6">
        <div className="flex items-center gap-2">
          <span className={`sk-badge ${v.visit_type === "lead" ? "sk-badge-info" : "sk-badge-warning"}`}>{v.visit_type === "lead" ? "Lead Visit" : "Project Visit"}</span>
          <span className={`sk-badge ${v.status === "completed" ? "sk-badge-success" : "sk-badge-warning"}`}>{v.status === "completed" ? "Completed" : "Follow-up required"}</span>
        </div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold mt-2">{v.visit_type === "lead" ? v.lead_name : v.project_name || "Untitled"}</h1>
        <div className="text-sm text-slate-500 mt-1">{fmtDateTime(v.visit_date)} · {v.employee_name}</div>
      </div>
      {v.selfie_url && (
        <div className="sk-card p-5">
          <div className="font-heading font-bold mb-3">Selfie Proof</div>
          <img src={v.selfie_url} alt="" className="w-full max-w-md rounded-xl border" />
          <div className="flex flex-wrap gap-2 mt-3">
            {v.latitude != null && <span className="gps-pill"><MapPin className="w-3.5 h-3.5 text-[#FFA94D]" />{v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}</span>}
            {v.location_address && <span className="gps-pill">{v.location_address}</span>}
            {v.latitude && <a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="gps-pill bg-[#4DA3FF]/10 text-[#4DA3FF] border-[#4DA3FF]/20 hover:bg-[#4DA3FF]/20">Open in Maps</a>}
          </div>
        </div>
      )}
      {v.visit_type === "lead" ? (
        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Lead Details</div>
          <Row label="Customer" value={v.lead_name} />
          <Row label="Phone" value={v.lead_phone} icon={Phone} />
          <Row label="Location" value={v.lead_location} icon={MapPin} />
          <Row label="Budget" value={v.budget} />
          <Row label="Customer Requirement" value={v.customer_requirement} multiline />
          <Row label="Measurement" value={v.measurement_details} multiline />
          <Row label="Requirement Sheet" value={v.requirement_sheet} multiline />
        </div>
      ) : (
        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Project Details</div>
          <Row label="Project Name" value={v.project_name} />
          <Row label="Location" value={v.project_location} icon={MapPin} />
          <Row label="Status" value={v.project_status?.replace("_", " ")} />
          <Row label="Notes" value={v.notes} multiline />
        </div>
      )}
      {v.site_photos?.length > 0 && (
        <div className="sk-card p-5">
          <div className="font-heading font-bold mb-3">Site Photos ({v.site_photos.length})</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {v.site_photos.map((p, i) => <a key={i} href={p} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border"><img src={p} alt="" className="w-full h-full object-cover" /></a>)}
          </div>
        </div>
      )}
      {v.floor_plan_url && (
        <div className="sk-card p-5">
          <div className="font-heading font-bold mb-3">Floor Plan</div>
          <a href={v.floor_plan_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#4DA3FF] font-medium"><FileText className="w-4 h-4" /> Open floor plan</a>
        </div>
      )}
      {v.notes && v.visit_type === "lead" && <div className="sk-card p-5"><div className="font-heading font-bold mb-1">Notes</div><div className="text-sm text-slate-700 whitespace-pre-wrap">{v.notes}</div></div>}
    </div>
  );
}
const Row = ({ label, value, icon: Icon, multiline }) => {
  if (!value) return null;
  return (
    <div className="flex gap-3 items-start">
      <div className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500 pt-0.5">{label}</div>
      <div className={`text-sm text-slate-800 flex-1 ${multiline ? "whitespace-pre-wrap" : ""}`}>{Icon && <Icon className="w-3.5 h-3.5 inline-block mr-1 text-slate-400" />}{value}</div>
    </div>
  );
};
