"use client";

import { useEffect, useState } from "react";

type Booking = {
  id: string;
  client_name: string;
  start_time: string;
  date: string;
};

export default function BarberDashboard() {
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetch("/api/bookings/list")
      .then((r) => r.json())
      .then((d) => setTodayBookings(d.bookings || []));
  }, []);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>
        <p className="text-gray-500">
          Programările tale de azi
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Astăzi" value={todayBookings.length} />
        <StatCard title="Următoarea" value={getNext(todayBookings)} />
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href="/admin/calendar"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          📅 Calendar
        </a>

        <a
          href="/admin/bookings"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          📋 Toate programările
        </a>

        <a
          href="/admin/services"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          ✂️ Servicii
        </a>

        <a
          href="/admin/settings"
          className="bg-white border rounded-xl p-4 hover:bg-gray-50"
        >
          ⚙️ Setări
        </a>
      </div>

      {/* LISTA PROGRAMĂRI */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-medium mb-3">Programări azi</h2>

        {todayBookings.length === 0 && (
          <p className="text-sm text-gray-500">
            Nu ai programări azi
          </p>
        )}

        <div className="space-y-2">
          {todayBookings.map((b) => (
            <div
              key={b.id}
              className="flex justify-between items-center border rounded-lg p-3"
            >
              <span>{b.client_name}</span>
              <span className="font-medium">
                {b.start_time.slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 🔥 COMPONENTE AJUTĂTOARE

function StatCard({ title, value }: any) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function getNext(bookings: Booking[]) {
  const now = new Date();

  const next = bookings.find((b) => {
    const t = new Date(`${b.date}T${b.start_time}`);
    return t > now;
  });

  return next ? next.start_time.slice(0, 5) : "-";
}