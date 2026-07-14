import BookingFooter from "@/app/components/BookingFooter";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen">
      {children}

      <BookingFooter />
    </div>
  );
}