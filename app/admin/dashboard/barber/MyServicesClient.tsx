"use client";

import { toggleService, updateService } from "./actions";

export default function MyServicesClient({
  barberId,
  services,
}: {
  barberId: string;
  services: any[];
}) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Serviciile mele</h1>

      {services.map((s) => {
        const bs = s.barber_services?.[0];

        return (
          <div
            key={s.id}
            style={{ borderBottom: "1px solid #ddd", padding: 12 }}
          >
            <label>
              <input
                type="checkbox"
                checked={bs?.active ?? false}
                onChange={(e) =>
                  toggleService(barberId, s.id, e.target.checked)
                }
              />{" "}
              {s.name}
            </label>

            {bs?.active && (
              <div style={{ marginTop: 8 }}>
                <input
                  placeholder="Nume afișat"
                  defaultValue={bs.display_name ?? ""}
onBlur={(e) => {
  const value = e.target.value.trim();
  updateService(bs.id, {
    display_name: value === "" ? undefined : value,
  });
}}
                />

                <input
                  type="number"
                  placeholder="Durată (min)"
                  defaultValue={bs.duration ?? s.duration_minutes}
                  onBlur={(e) =>
                    updateService(bs.id, {
                      duration: Number(e.target.value),
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Preț"
                  defaultValue={bs.price ?? s.price}
                  onBlur={(e) =>
                    updateService(bs.id, {
                      price: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
