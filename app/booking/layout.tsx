import BookingFooter from "@/app/components/BookingFooter";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen min-w-0 max-w-[100vw] overflow-x-clip">
      {children}

      <BookingFooter />
    </div>
  );
}