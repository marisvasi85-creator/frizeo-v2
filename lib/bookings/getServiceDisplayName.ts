export function getServiceDisplayName(service?: {
  display_name?: string | null;
  name?: string | null;
} | null): string {
  const label = service?.display_name?.trim() || service?.name?.trim();
  return label || "Serviciu";
}
