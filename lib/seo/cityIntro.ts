import { getMarketingAIProvider } from "@/lib/marketing-ai/providers";
import { supabaseAdmin } from "@/lib/supabase/admin";

let citySeoTableCached: boolean | null = null;

export async function hasCitySeoPagesTable(): Promise<boolean> {
  if (citySeoTableCached !== null) return citySeoTableCached;
  const { error } = await supabaseAdmin
    .from("city_seo_pages")
    .select("city_slug")
    .limit(1);
  citySeoTableCached = !error;
  return citySeoTableCached;
}

function templateIntro(cityName: string, salonCount: number): string {
  const n =
    salonCount === 1
      ? "un salon"
      : `${salonCount} saloane`;
  return `Cauți o frizerie sau un barbershop în ${cityName}? Pe Frizeo găsești ${n} cu programare online — alegi frizerul, serviciul și ora, fără telefon.`;
}

async function generateAiIntro(
  cityName: string,
  salonCount: number,
  salonNames: string[]
): Promise<string | null> {
  const provider = getMarketingAIProvider();
  if (!provider.isConfigured() || provider.id === "template") {
    return null;
  }

  try {
    const raw = await provider.complete({
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "Ești copywriter SEO pentru Frizeo (programări online frizerii RO). Scrie 2-3 propoziții în română, naturale, fără exagerări tip „mii de clienți”. Fără markdown, fără ghilimele.",
        },
        {
          role: "user",
          content: `Oraș: ${cityName}. Număr saloane pe Frizeo: ${salonCount}. Exemple: ${salonNames.slice(0, 5).join(", ") || "—"}. Scrie un intro scurt pentru pagina „Frizerii în ${cityName}".`,
        },
      ],
    });

    const text = raw.trim().replace(/^["«]|["»]$/g, "");
    if (text.length < 40 || text.length > 600) return null;
    return text;
  } catch (err) {
    console.error("generateAiIntro:", err);
    return null;
  }
}

/** Cached city intro — AI once, then template fallback. No doorway spam pages. */
export async function getCityIntro(input: {
  citySlug: string;
  cityName: string;
  salonCount: number;
  salonNames: string[];
}): Promise<{ intro: string; source: string }> {
  const fallback = templateIntro(input.cityName, input.salonCount);

  if (!(await hasCitySeoPagesTable())) {
    return { intro: fallback, source: "template" };
  }

  const { data: existing } = await supabaseAdmin
    .from("city_seo_pages")
    .select("intro, source")
    .eq("city_slug", input.citySlug)
    .maybeSingle();

  if (existing?.intro?.trim()) {
    return {
      intro: existing.intro.trim(),
      source: existing.source || "cached",
    };
  }

  const ai = await generateAiIntro(
    input.cityName,
    input.salonCount,
    input.salonNames
  );
  const intro = ai || fallback;
  const source = ai ? "ai" : "template";

  await supabaseAdmin.from("city_seo_pages").upsert(
    {
      city_slug: input.citySlug,
      city_name: input.cityName,
      intro,
      source,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "city_slug" }
  );

  return { intro, source };
}
