import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseMarketingSegmentDefinition } from "@/lib/frizeo-email/segmentDefinition";
import type {
  MarketingSegment,
  MarketingSegmentDefinition,
  MarketingSegmentMember,
  MarketingSegmentSummary,
} from "@/lib/frizeo-email/types";

export type SaveMarketingSegmentInput = {
  name: string;
  description: string;
  category: string;
  definition: MarketingSegmentDefinition;
};

function summaryRows(value: unknown): MarketingSegmentSummary[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const item = row as MarketingSegmentSummary & { contacts_count: number | string };
    return { ...item, contacts_count: Number(item.contacts_count || 0) };
  });
}

function memberRows(value: unknown): MarketingSegmentMember[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const item = row as MarketingSegmentMember & {
      bookings_count: number | string;
      total_count: number | string;
    };
    return {
      ...item,
      bookings_count: Number(item.bookings_count || 0),
      total_count: Number(item.total_count || 0),
    };
  });
}

export async function listMarketingSegments(): Promise<MarketingSegmentSummary[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "marketing_list_segments_with_counts",
  );
  if (error) throw new Error(error.message);
  return summaryRows(data);
}

export async function getMarketingSegment(
  id: string,
): Promise<MarketingSegment | null> {
  const { data, error } = await supabaseAdmin
    .from("marketing_segments")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingSegment | null) ?? null;
}

export async function getMarketingSegmentByKey(
  key: string | null | undefined,
): Promise<MarketingSegment | null> {
  if (!key) return null;
  const { data, error } = await supabaseAdmin
    .from("marketing_segments")
    .select("*")
    .eq("segment_key", key)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingSegment | null) ?? null;
}

export async function listMarketingSegmentMembers(
  id: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ members: MarketingSegmentMember[]; total: number }> {
  const { data, error } = await supabaseAdmin.rpc("marketing_segment_members", {
    p_segment_id: id,
    p_limit: Math.min(Math.max(options.limit ?? 100, 1), 500),
    p_offset: Math.max(options.offset ?? 0, 0),
  });
  if (error) throw new Error(error.message);
  const members = memberRows(data);
  return { members, total: members[0]?.total_count ?? 0 };
}

export async function previewMarketingSegment(
  definition: MarketingSegmentDefinition,
  limit = 10,
): Promise<{ members: MarketingSegmentMember[]; total: number }> {
  const parsed = parseMarketingSegmentDefinition(definition);
  if (!parsed.ok) throw new Error(parsed.error);
  const { data, error } = await supabaseAdmin.rpc("marketing_preview_segment", {
    p_definition: parsed.definition,
    p_limit: Math.min(Math.max(limit, 1), 100),
  });
  if (error) throw new Error(error.message);
  const members = memberRows(data);
  return { members, total: members[0]?.total_count ?? 0 };
}

export async function createMarketingSegment(
  input: SaveMarketingSegmentInput,
  createdBy: string,
): Promise<MarketingSegment> {
  const parsed = parseMarketingSegmentDefinition(input.definition);
  if (!parsed.ok) throw new Error(parsed.error);
  const { data, error } = await supabaseAdmin
    .from("marketing_segments")
    .insert({
      name: input.name,
      description: input.description,
      category: input.category,
      definition: parsed.definition,
      segment_key: null,
      is_system_segment: false,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Există deja un segment custom cu acest nume.");
    }
    throw new Error(error?.message || "Nu am putut crea segmentul.");
  }
  return data as MarketingSegment;
}

export async function updateMarketingSegment(
  id: string,
  input: SaveMarketingSegmentInput,
): Promise<MarketingSegment | null> {
  const parsed = parseMarketingSegmentDefinition(input.definition);
  if (!parsed.ok) throw new Error(parsed.error);
  const { data, error } = await supabaseAdmin
    .from("marketing_segments")
    .update({
      name: input.name,
      description: input.description,
      category: input.category,
      definition: parsed.definition,
    })
    .eq("id", id)
    .eq("is_system_segment", false)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw new Error("Există deja un segment custom cu acest nume.");
    }
    throw new Error(error.message);
  }
  return (data as MarketingSegment | null) ?? null;
}

export async function duplicateMarketingSegment(
  id: string,
  createdBy: string,
): Promise<MarketingSegment | null> {
  const source = await getMarketingSegment(id);
  if (!source) return null;

  let name = `${source.name} — copie`;
  for (let suffix = 2; suffix <= 20; suffix += 1) {
    const { data, error } = await supabaseAdmin
      .from("marketing_segments")
      .insert({
        name,
        description: source.description,
        category: "custom",
        definition: source.definition,
        segment_key: null,
        is_system_segment: false,
        created_by: createdBy,
      })
      .select("*")
      .single();
    if (!error && data) return data as MarketingSegment;
    if (error?.code !== "23505") {
      throw new Error(error?.message || "Nu am putut duplica segmentul.");
    }
    name = `${source.name} — copie ${suffix}`;
  }
  throw new Error("Există prea multe copii cu același nume.");
}

export async function deleteMarketingSegment(
  id: string,
  deletedBy: string,
): Promise<"archived" | "not_found" | "protected"> {
  const segment = await getMarketingSegment(id);
  if (!segment) return "not_found";
  if (segment.is_system_segment) return "protected";

  const { data, error } = await supabaseAdmin
    .from("marketing_segments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq("id", id)
    .eq("is_system_segment", false)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? "archived" : "not_found";
}
