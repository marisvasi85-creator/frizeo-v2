import BookingClient from "@/app/booking/[barberId]/components/BookingClient";
import JsonLd from "@/app/components/JsonLd";
import PublicLocationCard from "@/app/components/location/PublicLocationCard";
import FloatingPublicBookingAssistant from "@/app/booking/_components/FloatingPublicBookingAssistant";
import Image from "next/image";
import { barberBookingJsonLd } from "@/lib/site/jsonLd";
import {
  resolveBarberLocation,
  formatLocationAddress,
} from "@/lib/location/resolveLocation";
import type { BarberLocationFields } from "@/lib/location/types";
import {
  isPublicBookingAssistantEnabled,
  isPublicBookingAssistantLlmConfigured,
} from "@/lib/public-assistant/config";

type Salon = {
  name?: string | null;
  slug: string;
  phone?: string | null;
  description?: string | null;
  logo_url?: string | null;
  address?: string | null;
  [key: string]: unknown;
};

type Barber = BarberLocationFields & {
  id: string;
  display_name?: string | null;
  slug?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
};

export default function BarberBookingView({
  salon,
  barber,
  barberSlug,
  embedAssistant = false,
}: {
  salon: Salon;
  barber: Barber;
  barberSlug: string;
  /** Only for /booking/[barberId] — salon layout already mounts the FAB */
  embedAssistant?: boolean;
}) {
  const barberName = barber.display_name || "Frizer";
  const bookingLocation = resolveBarberLocation(salon, barber);
  const showAssistant =
    embedAssistant && isPublicBookingAssistantEnabled();

  return (
    <>
      <JsonLd
        data={barberBookingJsonLd({
          salon: {
            name: String(salon.name || "Salon"),
            slug: salon.slug,
            phone: salon.phone,
            address: formatLocationAddress(salon) || salon.address,
            description: salon.description,
            logoUrl: salon.logo_url,
          },
          barberName,
          barberSlug,
        })}
      />
      <div className="bg-white min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {salon.logo_url && (
                <Image
                  src={salon.logo_url}
                  alt={`Logo ${salon.name}`}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-2xl object-cover"
                  priority
                />
              )}

              <div>
                <h1 className="text-3xl font-bold">{String(salon.name || "Salon")}</h1>

                {salon.phone && (
                  <p className="text-gray-600 mt-2">📞 {salon.phone}</p>
                )}
              </div>
            </div>

            {salon.description && (
              <p className="mt-4 text-gray-700">{salon.description}</p>
            )}
          </div>

          <div className="bg-white border rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              {barber.avatar_url ? (
                <Image
                  src={barber.avatar_url}
                  alt={`${barberName} — ${String(salon.name || "Salon")}`}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200" />
              )}

              <div>
                <h2 className="text-xl font-semibold">{barberName}</h2>

                {barber.bio && <p className="text-gray-600">{barber.bio}</p>}

                {barber.instagram_url && (
                  <a
                    href={barber.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm block"
                  >
                    Instagram
                  </a>
                )}
                {barber.facebook_url && (
                  <a
                    href={barber.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm block"
                  >
                    Facebook
                  </a>
                )}
                {barber.tiktok_url && (
                  <a
                    href={barber.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm block"
                  >
                    TikTok
                  </a>
                )}
              </div>
            </div>
          </div>

          <BookingClient barberId={barber.id} barberName={barberName} />

          {bookingLocation && (
            <div className="mt-8 max-w-xl mx-auto">
              <PublicLocationCard location={bookingLocation} />
            </div>
          )}
        </div>
      </div>

      {showAssistant && (
        <FloatingPublicBookingAssistant
          configured={isPublicBookingAssistantLlmConfigured()}
          salonSlug={salon.slug}
          salonName={String(salon.name || "Salon")}
          barberSlug={barber.slug || barberSlug}
        />
      )}
    </>
  );
}
