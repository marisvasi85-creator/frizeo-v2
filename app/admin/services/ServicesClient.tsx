"use client";

import { updateServiceField } from "./actions";

type Service = {
  id: string;
  display_name: string;
  duration: number;
  price: number | null;
  sort_order: number | null;
  show_price: boolean;
  featured: boolean;
  active: boolean;
};

type Props = {
  services: Service[];
  tenantId: string;
};

export default function ServicesClient({ services }: Props) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Servicii</h1>

      <table border={1} cellPadding={8} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Nume</th>
            <th>Durată</th>
            <th>Preț</th>
            <th>Ordine</th>
            <th>Preț vizibil</th>
            <th>⭐ Recomandat</th>
            <th>Activ</th>
          </tr>
        </thead>

        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.display_name}</td>
              <td>{s.duration} min</td>
              <td>{s.price ?? "-"}</td>

              <td>
                <input
                  type="number"
                  defaultValue={s.sort_order ?? 0}
                  onBlur={(e) =>
                    updateServiceField(
                      s.id,
                      "sort_order",
                      Number(e.target.value)
                    )
                  }
                  style={{ width: 60 }}
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  defaultChecked={s.show_price}
                  onChange={(e) =>
                    updateServiceField(
                      s.id,
                      "show_price",
                      e.target.checked
                    )
                  }
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  defaultChecked={s.featured}
                  onChange={(e) =>
                    updateServiceField(
                      s.id,
                      "featured",
                      e.target.checked
                    )
                  }
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  defaultChecked={s.active}
                  onChange={(e) =>
                    updateServiceField(
                      s.id,
                      "active",
                      e.target.checked
                    )
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}