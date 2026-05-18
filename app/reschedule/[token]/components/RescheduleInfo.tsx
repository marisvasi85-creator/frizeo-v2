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
    <div className="border rounded-2xl p-5 bg-gray-50 shadow-sm space-y-2">

      <h3 className="text-lg font-semibold">
        Programarea ta
      </h3>

      <div className="text-sm text-gray-600 space-y-1">
        <p><span className="font-medium">👤 Nume:</span> {booking.client_name}</p>
        <p><span className="font-medium">📅 Data:</span> {booking.date}</p>
        <p>
          <span className="font-medium">⏰ Ora:</span>{" "}
          {booking.start_time} - {booking.end_time}
        </p>
      </div>

    </div>
  );
}