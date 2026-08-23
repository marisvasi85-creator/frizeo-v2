type ExistingClientCandidate = {
  appointmentCount: number;
  accessStatus?: string | null;
};

export function isExistingClient({
  appointmentCount,
  accessStatus,
}: ExistingClientCandidate) {
  return appointmentCount > 0 || accessStatus === "approved";
}
