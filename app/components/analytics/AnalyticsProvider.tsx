"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { getAnalyticsConfig } from "@/lib/analytics/config";
import { hasAnalyticsConsent, onConsentChange } from "@/lib/analytics/consent";
import { markAnalyticsReady, trackPageView } from "@/lib/analytics/track";

function AnalyticsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = getAnalyticsConfig();
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const loadedCount = useRef(0);
  const scriptTargets = useRef(0);
  const skipInitialPageView = useRef(true);

  useLayoutEffect(() => {
    setConsent(hasAnalyticsConsent());
  }, []);

  useEffect(() => {
    return onConsentChange(() => setConsent(hasAnalyticsConsent()));
  }, []);

  useEffect(() => {
    if (!consent || !ready) return;
    if (skipInitialPageView.current) {
      skipInitialPageView.current = false;
      return;
    }
    trackPageView(pathname, searchParams.toString());
  }, [pathname, searchParams, consent, ready]);

  function onScriptLoaded() {
    loadedCount.current += 1;
    if (loadedCount.current < scriptTargets.current) return;

    markAnalyticsReady();
    setReady(true);
  }

  if (!consent || !config.isConfigured) return null;

  if (config.gtmId) {
    scriptTargets.current = 1;
    return (
      <>
        <Script id="gtm-loader" strategy="afterInteractive" onLoad={onScriptLoaded}>
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${config.gtmId}');
          `}
        </Script>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${config.gtmId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
      </>
    );
  }

  const usesMeta = Boolean(config.metaPixelId);
  const usesGa = Boolean(config.gaMeasurementId);
  scriptTargets.current = (usesMeta ? 1 : 0) + (usesGa ? 1 : 0);

  return (
    <>
      {usesMeta && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive" onLoad={onScriptLoaded}>
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              (function () {
                var params = new URLSearchParams(window.location.search);
                var testCode = params.get('test_event_code') || ${JSON.stringify(config.metaTestEventCode)};
                var pixelId = ${JSON.stringify(config.metaPixelId)};
                if (testCode) {
                  fbq('init', pixelId, {}, { test_event_code: testCode });
                } else {
                  fbq('init', pixelId);
                }
                fbq('track', 'PageView');
                window.__frizeoMetaReady = true;
              })();
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${config.metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {usesGa && (
        <>
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', ${JSON.stringify(config.gaMeasurementId)}, { send_page_view: false });
              gtag('event', 'page_view', {
                page_path: window.location.pathname + window.location.search,
              });
              window.__frizeoGaReady = true;
            `}
          </Script>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.gaMeasurementId}`}
            strategy="afterInteractive"
            onLoad={onScriptLoaded}
          />
        </>
      )}
    </>
  );
}

export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsInner />
    </Suspense>
  );
}
