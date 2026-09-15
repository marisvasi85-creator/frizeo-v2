export type CatalogServiceFlags = {
  active?: boolean | null;
  deleted_at?: string | null;
};

export const CATALOG_SERVICE_DELETED_MESSAGE =
  "Serviciul a fost șters din listă. Programările existente rămân.";

export function isDeletedFromCatalog(
  service: CatalogServiceFlags | null | undefined,
): boolean {
  return Boolean(service?.deleted_at);
}

export function isBookableCatalogService(
  service: CatalogServiceFlags | null | undefined,
): boolean {
  if (!service || isDeletedFromCatalog(service)) return false;
  return service.active !== false;
}

export function catalogDeletePatch(now = new Date()) {
  return {
    deleted_at: now.toISOString(),
    active: false,
  };
}

/**
 * Existing bookings keep their original service after catalog delete.
 * Switching to a different service still requires a live catalog row.
 */
export function canUseServiceForExistingBooking(params: {
  service: CatalogServiceFlags | null | undefined;
  requestedServiceId: string | null | undefined;
  originalServiceId: string | null | undefined;
}): boolean {
  if (!params.service) return false;
  if (
    params.requestedServiceId &&
    params.originalServiceId &&
    params.requestedServiceId === params.originalServiceId
  ) {
    return true;
  }
  return isBookableCatalogService(params.service);
}
