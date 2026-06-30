export type AnalyticsConfig = {
  metaPixelId: string;
  gaMeasurementId: string;
  gtmId: string;
  isConfigured: boolean;
};

export function getAnalyticsConfig(): AnalyticsConfig {
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  const gaMeasurementId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";

  return {
    metaPixelId,
    gaMeasurementId,
    gtmId,
    isConfigured: Boolean(metaPixelId || gaMeasurementId || gtmId),
  };
}
