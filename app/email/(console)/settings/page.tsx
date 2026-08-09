import { getMarketingSenderDefaults } from "@/lib/frizeo-email/campaigns";
import { getMarketingProviderStatus } from "@/lib/frizeo-email/provider";

export default function EmailSettingsPage() {
  const provider = getMarketingProviderStatus();
  const sender = getMarketingSenderDefaults();

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
            <p className="mt-1 text-sm text-white/45">SMTP dedicat · Send Test</p>
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

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-medium">Sender defaults</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-white/40">Sender name</dt>
            <dd className="mt-1 text-white/80">{sender.senderName}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Sender email</dt>
            <dd className="mt-1 break-all text-white/80">
              {sender.senderEmail || "Not configured"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Reply-To</dt>
            <dd className="mt-1 break-all text-white/80">
              {sender.replyTo || "Not configured"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/50">
        Test Provider Connection și providerul de producție pentru batch-uri se
        finalizează în Faza 3. În această fază conexiunea este folosită numai de
        butonul Send Test.
      </section>
    </div>
  );
}
