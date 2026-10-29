import { supabase } from "@/lib/supabase";

export async function getTrackingDashboard() {
  const { data, error } = await supabase.rpc("get_tracking_dashboard");
  if (error) throw error;
  return data || [];
}

export async function getTrackingHistory(employeeId, from, to) {
  const { data, error } = await supabase.rpc("get_tracking_history", {
    p_employee_id: employeeId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data || [];
}

export async function startTrackingShift({ siteLabel = null, latitude = null, longitude = null } = {}) {
  const { data, error } = await supabase.rpc("start_tracking_shift", {
    p_site_label: siteLabel,
    p_latitude: latitude,
    p_longitude: longitude,
  });
  if (error) throw error;
  return data;
}

export async function endTrackingShift({ shiftId, latitude = null, longitude = null }) {
  const { data, error } = await supabase.rpc("end_tracking_shift", {
    p_shift_id: shiftId,
    p_latitude: latitude,
    p_longitude: longitude,
  });
  if (error) throw error;
  return data;
}

export async function recordTrackingLocation({ shiftId, latitude, longitude, accuracy = null, capturedAt = new Date().toISOString() }) {
  const { data, error } = await supabase.rpc("record_employee_location", {
    p_shift_id: shiftId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_captured_at: capturedAt,
    p_accuracy_m: accuracy,
    p_speed_mps: null,
    p_heading_degrees: null,
    p_device_session_id: null,
  });
  if (error) throw error;
  return data;
}
