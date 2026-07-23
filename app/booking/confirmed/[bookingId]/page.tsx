import type { Metadata } from "next";
import BookingConfirmedClient from "./BookingConfirmedClient";
import { createPageMetadata } from "@/lib/site/pageMetadata";

type Props = {
  params: Promise<{
    bookingId: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookingId } = await params;
  const path = `/booking/confirmed/${bookingId}`;

  return createPageMetadata({
    title: "Programare confirmată",
    description: "Detaliile programării tale.",
    path,
    noIndex: true,
    pwa: {
      startUrl: path,
      variant: "booking",
    },
  });
}

export default async function Page({ params }: Props) {
  const { bookingId } = await params;

  return <BookingConfirmedClient bookingId={bookingId} />;
}
