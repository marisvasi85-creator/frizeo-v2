import * as Sentry from "@sentry/nextjs";
import { getSharedSentryOptions } from "@/lib/sentry/shared";

Sentry.init({
  ...getSharedSentryOptions(),
});
