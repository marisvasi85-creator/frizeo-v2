"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import BookingAccessPrompt from "./BookingAccessPrompt";
import type {
  BookingAccessMode,
  PublicAccessStatus,
} from "@/lib/barber-access/types";

type Props = {
  barber: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    instagram_url: string | null;
  };
  salonName: string;
  bookingHref: string;
  accessMode: BookingAccessMode;
};

export default function PublicBarberCard({
  barber,
  salonName,
  bookingHref,
  accessMode,
}: Props) {
  const [identifiedStatus, setIdentifiedStatus] =
    useState<PublicAccessStatus | null>(null);

  const available = accessMode === "open" || identifiedStatus === "approved";
  const pending = identifiedStatus === "pending";
  const statusLabel = available
    ? "Disponibil"
    : pending
      ? "Cerere în așteptare"
      : accessMode === "approval_required"
        ? "Acces pe bază de aprobare"
        : "Închis pentru clienți noi";

  return (
    <article className="rounded-2xl border border-frz-line bg-frz-card p-5 transition hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {barber.avatar_url ? (
            <Image
              src={barber.avatar_url}
              alt={`${barber.display_name} — ${salonName}`}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 shrink-0 rounded-full bg-frz-fog" />
          )}

          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{barber.display_name}</h3>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                available
                  ? "bg-frz-success-soft text-frz-success"
                  : pending
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-frz-fog text-frz-muted"
              }`}
            >
              {statusLabel}
            </span>

            {barber.bio && (
              <p className="mt-2 text-sm text-frz-muted">{barber.bio}</p>
            )}

            {accessMode === "approval_required" && !available && !pending && (
              <p className="mt-2 text-sm text-frz-muted">
                Acest profesionist acceptă clienți noi pe bază de solicitare.
              </p>
            )}

            {barber.instagram_url && (
              <a
                href={barber.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-frz-accent"
              >
                Instagram
              </a>
            )}
          </div>
        </div>

        <div className="shrink-0 sm:ml-auto">
          {accessMode === "open" ? (
            <Link
              href={bookingHref}
              className="inline-flex w-full justify-center rounded-xl bg-frz-ink px-4 py-2 text-sm font-medium text-frz-ink-contrast sm:w-auto"
            >
              Alege
            </Link>
          ) : (
            <BookingAccessPrompt
              barberId={barber.id}
              mode={accessMode}
              presentation="modal"
              bookingHref={bookingHref}
              onStatusChange={setIdentifiedStatus}
            />
          )}
        </div>
      </div>
    </article>
  );
}
