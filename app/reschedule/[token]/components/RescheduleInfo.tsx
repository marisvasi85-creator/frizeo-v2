type Props = {
  booking: {
    client_name: string;
    date: string;
    start_time: string;
    end_time: string;
  };
};

export default function RescheduleInfo({ booking }: Props) {
  return (
    <div className="border rounded p-3 bg-gray-50">
      <p className="font-semibold">Programarea actuală</p>
      <p>👤 {booking.client_name}</p>
      <p>📅 {booking.date}</p>
      <p>⏰ {booking.start_time} – {booking.end_time}</p>
    </div>
  );
}
