export type MarketingTestimonialUserType = "independent" | "barbershop";

export type MarketingTestimonialStatus = "pending" | "approved" | "rejected";

export type MarketingTestimonial = {
  id: string;
  rating: number;
  author_name: string;
  salon_name: string | null;
  city: string | null;
  user_type: MarketingTestimonialUserType;
  body: string;
  photo_url: string | null;
  display_consent: boolean;
  status: MarketingTestimonialStatus;
  created_at: string;
  reviewed_at: string | null;
};
