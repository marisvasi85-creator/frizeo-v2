import { getMarketingProviderStatus } from "@/lib/frizeo-email/provider";
import { isMarketingWorkerConfigured } from "@/lib/frizeo-email/workerAuth";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { isResendWebhookConfigured } from "@/lib/frizeo-email/webhooks";

export default function EmailSettingsPage() {
  const provider = getMarketingProviderStatus();
  const workerConfigured = isMarketingWorkerConfigured();
  const webhookConfigured = isResendWebhookConfigured();
  const webhookUrl = `${getAppUrl()}/api/webhooks/resend/marketing`;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Status read-only. Secretele se configurează exclusiv în Vercel.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Marketing email provider</h2>
            <p className="mt-1 text-sm text-white/45">
              Resend · teste și campanii
            </p>
          </div>
          <span
            className={`rounded-md px-2.5 py-1 text-xs ${
              provider.configured
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {provider.configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p className="text-sm text-white/60">{provider.message}</p>
        <p className="text-xs text-white/35">
          SMTP-ul de booking (`EMAIL_*`) rămâne separat și nu este folosit ca
          fallback.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Resend delivery webhooks</h2>
            <p className="mt-1 text-sm text-white/45">
              Delivery, opens, clicks, bounces și complaints
            </p>
          </div>
          <span
            className={`rounded-md px-2.5 py-1 text-xs ${
              webhookConfigured
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {webhookConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
        <div>
          <p className="text-xs text-white/40">Webhook URL</p>
          <code className="mt-1 block break-all rounded-md bg-black/30 px-3 py-2 text-xs text-white/75">
            {webhookUrl}
          </code>
        </div>
        <p className="text-xs text-white/35">
          Semnătura este verificată pe body-ul raw cu secretul dedicat
          RESEND_WEBHOOK_SECRET. Secretul nu este afișat.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">External campaign worker</h2>
            <p className="mt-1 text-sm text-white/45">
              Endpoint securizat pentru serviciul Cron Job extern
            </p>
          </div>
          <span
            className={`rounded-md px-2.5 py-1 text-xs ${
              workerConfigured
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {workerConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p className="text-xs text-white/35">
          Secretul dedicat este verificat exclusiv server-side și nu este afișat
          sau reutilizat pentru Resend ori Supabase.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-medium">Provider details</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs text-white/40">Provider</dt>
            <dd className="mt-1 text-white/80">Resend</dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Domain</dt>
            <dd className="mt-1 text-white/80">{provider.domain}</dd>
          </div>
        </dl>
        <p className="text-xs text-white/35">
          Adresele From și Reply-To sunt citite exclusiv server-side din Vercel
          și nu sunt afișate aici.
        </p>
      </section>

      <section className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50">
        Workerul procesează batch-uri mici, iar progresul campaniei se
        actualizează automat în interfață. Nu este folosit Vercel Cron.
      </section>
    </div>
  );
}
