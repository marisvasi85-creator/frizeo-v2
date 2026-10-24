import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  summarizePublicReviews,
  type PublicReviewSummary,
  type ReviewRecord,
} from "@/lib/reviews/eligibility";

export type SalonReview = {
  id: string;
  rating: number;
  author_name: string;
  comment: string | null;
  created_at: string;
};

export type SalonReviewSummary = {
  count: number;
  average: number | null;
  reviews: SalonReview[];
};

export type SalonReviewAdminItem = {
  id: string;
  rating: number;
  authorName: string;
  comment: string | null;
  createdAt: string;
  barberName: string | null;
  hiddenReason: "cancelled" | "unapproved" | null;
};

export type SalonReviewAdminList = {
  summary: SalonReviewSummary;
  visible: SalonReviewAdminItem[];
  hidden: SalonReviewAdminItem[];
};

const PAGE_SIZE = 1000;

let reviewsTableCached: boolean | null = null;

function isMissingReviewsTableError(error: {
  code?: string | null;
  message?: string | null;
} | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "42P01" || code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export async function hasSalonReviewsTable(): Promise<boolean> {
  if (reviewsTableCached !== null) return reviewsTableCached;
  const { error } = await supabaseAdmin
    .from("salon_reviews")
    .select("id")
    .limit(1);
  if (!error) {
    reviewsTableCached = true;
    return true;
  }
  if (isMissingReviewsTableError(error)) {
    reviewsTableCached = false;
    return false;
  }
  console.error("hasSalonReviewsTable:", error);
  return false;
}

type ReviewRow = {
  id: string;
  tenant_id: string;
  rating: number;
  author_name: string;
  comment: string | null;
  approved: boolean;
  created_at: string;
  booking_id: string | null;
  bookingStatus: string | null;
  barberId: string | null;
};

async function bookingsForTenant(
  tenantId: string,
  bookingIds: string[],
): Promise<Map<string, { status: string | null; barberId: string | null }> | null> {
  const unique = [...new Set(bookingIds.filter(Boolean))];
  const found = new Map<
    string,
    { status: string | null; barberId: string | null }
  >();
  if (unique.length === 0) return found;

  for (let index = 0; index < unique.length; index += PAGE_SIZE) {
    const slice = unique.slice(index, index + PAGE_SIZE);
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("id, status, barber_id")
      .eq("tenant_id", tenantId)
      .in("id", slice);

    if (error) {
      console.error("bookingsForTenant:", error);
      return null;
    }

    for (const booking of data ?? []) {
      found.set(booking.id as string, {
        status: (booking.status as string | null) ?? null,
        barberId: (booking.barber_id as string | null) ?? null,
      });
    }
  }

  return found;
}

async function loadTenantReviewRows(
  tenantId: string,
): Promise<ReviewRow[] | null> {
  if (!(await hasSalonReviewsTable())) return [];

  const rows: ReviewRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("salon_reviews")
      .select(
        "id, tenant_id, rating, author_name, comment, approved, created_at, booking_id",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("loadTenantReviewRows:", error);
      return null;
    }

    const batch = (data ?? []).filter((row) => row.tenant_id === tenantId);
    const bookings = await bookingsForTenant(
      tenantId,
      batch.flatMap((row) => (row.booking_id ? [row.booking_id] : [])),
    );
    if (!bookings) return null;

    rows.push(
      ...batch.map((row) => {
        const booking = row.booking_id ? bookings.get(row.booking_id) : null;
        return {
          id: row.id as string,
          tenant_id: row.tenant_id as string,
          rating: Number(row.rating),
          author_name: row.author_name as string,
          comment: (row.comment as string | null) ?? null,
          approved: Boolean(row.approved),
          created_at: row.created_at as string,
          booking_id: (row.booking_id as string | null) ?? null,
          bookingStatus: booking?.status ?? null,
          barberId: booking?.barberId ?? null,
        };
      }),
    );
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

function toRecord(
  row: ReviewRow,
  barberNames: Map<string, string>,
): ReviewRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    rating: Number(row.rating),
    authorName: row.author_name,
    comment: row.comment,
    createdAt: row.created_at,
    approved: row.approved,
    bookingStatus: row.bookingStatus,
    barberName: row.barberId
      ? (barberNames.get(row.barberId) ?? null)
      : null,
  };
}

async function barberNamesForTenant(
  tenantId: string,
  barberIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(barberIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .eq("tenant_id", tenantId)
    .in("id", unique);

  if (error) {
    console.error("barberNamesForTenant:", error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((barber) => [
      barber.id as string,
      (typeof barber.display_name === "string" && barber.display_name.trim()) ||
        "Frizer",
    ]),
  );
}

function toPublicSummary(summary: PublicReviewSummary): SalonReviewSummary {
  return {
    count: summary.count,
    average: summary.average,
    reviews: summary.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      author_name: review.authorName,
      comment: review.comment,
      created_at: review.createdAt,
    })),
  };
}

const emptySummary = (): SalonReviewSummary => ({
  count: 0,
  average: null,
  reviews: [],
});

export async function getSalonReviewSummary(
  tenantId: string,
  limit = 10,
): Promise<SalonReviewSummary> {
  const rows = await loadTenantReviewRows(tenantId);
  if (!rows) return emptySummary();

  const records = rows.map((row) => toRecord(row, new Map()));
  return toPublicSummary(summarizePublicReviews(records, tenantId, limit));
}

export async function listSalonReviewsForAdmin(
  tenantId: string,
): Promise<SalonReviewAdminList> {
  const rows = await loadTenantReviewRows(tenantId);
  if (!rows) return { summary: emptySummary(), visible: [], hidden: [] };

  const barberIds = rows.flatMap((row) =>
    row.barberId ? [row.barberId] : [],
  );
  const names = await barberNamesForTenant(tenantId, barberIds);
  const records = rows
    .map((row) => toRecord(row, names))
    .filter((review) => review.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const summary = toPublicSummary(
    summarizePublicReviews(records, tenantId, records.length),
  );
  const publicIds = new Set(summary.reviews.map((review) => review.id));

  const toItem = (review: ReviewRecord): SalonReviewAdminItem => ({
    id: review.id,
    rating: review.rating,
    authorName: review.authorName,
    comment: review.comment,
    createdAt: review.createdAt,
    barberName: review.barberName,
    hiddenReason: publicIds.has(review.id)
      ? null
      : review.approved
        ? "cancelled"
        : "unapproved",
  });

  return {
    summary,
    visible: records.filter((review) => publicIds.has(review.id)).map(toItem),
    hidden: records.filter((review) => !publicIds.has(review.id)).map(toItem),
  };
}
