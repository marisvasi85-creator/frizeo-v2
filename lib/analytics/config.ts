/** Meta Pixel (public — not a secret). Override via NEXT_PUBLIC_META_PIXEL_ID if needed. */
export const META_PIXEL_ID = "1332971279044385";

/** Microsoft Clarity project ID (public). Override via NEXT_PUBLIC_CLARITY_PROJECT_ID. */
export const CLARITY_PROJECT_ID = "y7yi0bu37w";

export type AnalyticsConfig = {
  metaPixelId: string;
  metaTestEventCode: string;
  gaMeasurementId: string;
  tiktokPixelId: string;
  gtmId: string;
  clarityProjectId: string;
  isConfigured: boolean;
};

export function getAnalyticsConfig(): AnalyticsConfig {
  const metaPixelId =
    process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || META_PIXEL_ID;
  const metaTestEventCode =
    process.env.NEXT_PUBLIC_META_TEST_EVENT_CODE?.trim() ?? "";
  const gaMeasurementId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  const tiktokPixelId =
    process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() ?? "";
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  const clarityProjectId =
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || CLARITY_PROJECT_ID;

  return {
    metaPixelId,
    metaTestEventCode,
    gaMeasurementId,
    tiktokPixelId,
    gtmId,
    clarityProjectId,
    isConfigured: Boolean(
      metaPixelId ||
        gaMeasurementId ||
        tiktokPixelId ||
        gtmId ||
        clarityProjectId,
    ),
  };
}
