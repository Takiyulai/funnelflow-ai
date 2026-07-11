"use client";

// components/funnel/TrackingPixels.tsx
// 🆕 VAGUE 1 / LOT 4 — Injection des pixels publicitaires sur les pages de
// tunnel PUBLIÉES uniquement (rendu par PublishedFunnelView ; jamais monté
// dans le dashboard/éditeur/preview).
//
// SÉCURITÉ : les identifiants viennent du contenu utilisateur → chaque ID est
// validé par un format STRICT avant d'être interpolé dans un script. Un ID
// invalide est simplement ignoré (aucune injection possible).

import Script from "next/script";
import type { Funnel } from "@/lib/funnels/types";

type Tracking = NonNullable<Funnel["tracking"]>;

const META_RE = /^\d{5,20}$/;
const GA4_RE = /^G-[A-Z0-9]{4,20}$/i;
const GTM_RE = /^GTM-[A-Z0-9]{4,10}$/i;
const TIKTOK_RE = /^[A-Z0-9]{8,32}$/i;

function clean(v: string | undefined, re: RegExp): string | null {
  const s = (v ?? "").trim();
  return s && re.test(s) ? s : null;
}

export function TrackingPixels({ tracking }: { tracking?: Tracking | null }) {
  if (!tracking) return null;

  const metaId = clean(tracking.metaPixelId, META_RE);
  const ga4Id = clean(tracking.ga4Id, GA4_RE);
  const gtmId = clean(tracking.gtmId, GTM_RE);
  const tiktokId = clean(tracking.tiktokPixelId, TIKTOK_RE);

  if (!metaId && !ga4Id && !gtmId && !tiktokId) return null;

  return (
    <>
      {metaId && (
        <Script id="ff-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaId}');fbq('track','PageView');`}
        </Script>
      )}

      {ga4Id && (
        <>
          <Script
            id="ff-ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ff-ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
          </Script>
        </>
      )}

      {gtmId && (
        <Script id="ff-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}

      {tiktokId && (
        <Script id="ff-tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)}(window,document,'ttq');ttq.load('${tiktokId}');ttq.page();`}
        </Script>
      )}
    </>
  );
}
