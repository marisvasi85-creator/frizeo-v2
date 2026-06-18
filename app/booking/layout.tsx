import Footer from "@/app/components/Footer";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen">
      {children}

      <Footer />
    </div>
  );
}