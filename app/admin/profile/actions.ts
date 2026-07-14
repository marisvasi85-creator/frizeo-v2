"use server";

import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  hasLocationMigration,
  locationMigrationErrorMessage,
} from "@/lib/location/hasLocationMigration";
import { locationFieldsFromFormData } from "@/lib/location/resolveLocation";
import type { SaveFormState } from "../components/saveFormState";
import {
  hasSocialLinksMigration,
  socialLinksMigrationMessage,
} from "@/lib/social/hasSocialLinksMigration";
import { normalizeSocialUrl } from "@/lib/social/normalizeSocialUrl";

function isMissingLocationColumnError(message?: string) {
  return (
    !!message &&
    (message.includes("location_") ||
      message.includes("use_salon_location") ||
      message.includes("schema cache") ||
      message.includes("column"))
  );
}

export async function updateProfile(
  _prev: SaveFormState,
  formData: FormData
): Promise<SaveFormState> {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const display_name = formData.get("display_name") as string;
    const phone = formData.get("phone") as string;
    const bio = (formData.get("bio") as string) || null;
    const instagramRaw = (formData.get("instagram_url") as string) || "";
    const facebookRaw = (formData.get("facebook_url") as string) || "";
    const tiktokRaw = (formData.get("tiktok_url") as string) || "";

    const instagram = normalizeSocialUrl("instagram", instagramRaw);
    if (instagram.error) {
      return { success: false, error: `Instagram: ${instagram.error}` };
    }

    const socialReady = await hasSocialLinksMigration();
    let facebook_url: string | null = null;
    let tiktok_url: string | null = null;

    if (socialReady) {
      const facebook = normalizeSocialUrl("facebook", facebookRaw);
      if (facebook.error) {
        return { success: false, error: `Facebook: ${facebook.error}` };
      }

      const tiktok = normalizeSocialUrl("tiktok", tiktokRaw);
      if (tiktok.error) {
        return { success: false, error: `TikTok: ${tiktok.error}` };
      }

      facebook_url = facebook.url;
      tiktok_url = tiktok.url;
    }

    const instagram_url = instagram.url;

    const locationReady = await hasLocationMigration();
    const useSalonLocation =
      (formData.get("use_salon_location") as string) === "true";
    const location = locationReady ? locationFieldsFromFormData(formData) : {};

    const updatePayload: Record<string, unknown> = {
      display_name,
      phone,
      bio,
      instagram_url,
    };

    if (socialReady) {
      Object.assign(updatePayload, { facebook_url, tiktok_url });
    }

    if (locationReady) {
      Object.assign(updatePayload, {
        use_salon_location: useSalonLocation,
        ...(useSalonLocation
          ? {
              location_address_line: null,
              location_city: null,
              location_county: null,
              location_postal_code: null,
              location_maps_url: null,
              location_latitude: null,
              location_longitude: null,
            }
          : location),
      });
    }

    const { data, error } = await supabaseAdmin
      .from("barbers")
      .update(updatePayload)
      .eq("id", barber.id)
      .select("id")
      .single();

    if (error) {
      if (isMissingLocationColumnError(error.message)) {
        return {
          success: false,
          error: locationMigrationErrorMessage(),
        };
      }

      if (
        error.message?.includes("facebook_url") ||
        error.message?.includes("tiktok_url")
      ) {
        return {
          success: false,
          error: socialLinksMigrationMessage(),
        };
      }

      console.error("UPDATE PROFILE:", error);
      return { success: false, error: "Nu s-a putut salva profilul." };
    }

    if (!data) {
      return { success: false, error: "Nu s-a putut salva profilul." };
    }

    revalidatePath("/admin/profile");
    revalidatePath(`/booking/${barber.id}`);
    return { success: true };
  } catch (err) {
    console.error("UPDATE PROFILE:", err);
    return { success: false, error: "Nu s-a putut salva profilul." };
  }
}
