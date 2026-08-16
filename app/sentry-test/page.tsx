import { notFound } from "next/navigation";
import { SentryTestClient } from "./SentryTestClient";

export const dynamic = "force-dynamic";

export default function SentryTestPage() {
  if (process.env.SENTRY_ENABLE_TEST_ENDPOINT !== "true") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black">
      <SentryTestClient />
    </div>
  );
}
