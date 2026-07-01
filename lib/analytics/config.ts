export type AnalyticsConfig = {
  metaPixelId: string;
  metaTestEventCode: string;
  gaMeasurementId: string;
  tiktokPixelId: string;
  gtmId: string;
  isConfigured: boolean;
};

export function getAnalyticsConfig(): AnalyticsConfig {
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  const metaTestEventCode =
    process.env.NEXT_PUBLIC_META_TEST_EVENT_CODE?.trim() ?? "";
  const gaMeasurementId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  const tiktokPixelId =
    process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() ?? "";
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";

  return {
    metaPixelId,
    metaTestEventCode,
    gaMeasurementId,
    tiktokPixelId,
    gtmId,
    isConfigured: Boolean(
      metaPixelId || gaMeasurementId || tiktokPixelId || gtmId,
    ),
  };
}
