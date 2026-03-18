"use client";

import { updateServiceField, deleteService } from "./actions";

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number | null;
  sort_order: number | null;
  show_price: boolean;
  featured: boolean;
  active: boolean;
};

type Props = {
  services: Service[];
};

export default function ServicesClient({ services }: Props) {
  return (
    <div className="space-y-6">

      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Durată</th>
            <th className="p-2">Preț</th>
            <th className="p-2">Ordine</th>
            <th className="p-2">Preț vizibil</th>
            <th className="p-2">⭐ Recomandat</th>
            <th className="p-2">Activ</th>
            <th className="p-2">Șterge</th>
          </tr>
        </thead>

        <tbody>
          {services.map((service) => (
            <tr key={service.id} className="border-t">

              {/* NAME */}
              <td className="p-2">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="name" />
                  <input
                    name="value"
                    defaultValue={service.name}
                    className="border p-1 rounded w-full"
                  />
                </form>
              </td>

              {/* DURATION */}
              <td className="p-2">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="duration" />
                  <input
                    type="number"
                    name="value"
                    defaultValue={service.duration}
                    className="border p-1 rounded w-full"
                  />
                </form>
              </td>

              {/* PRICE */}
              <td className="p-2">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="price" />
                  <input
                    type="number"
                    name="value"
                    defaultValue={service.price ?? ""}
                    className="border p-1 rounded w-full"
                  />
                </form>
              </td>

              {/* SORT ORDER */}
              <td className="p-2">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="sort_order" />
                  <input
                    type="number"
                    name="value"
                    defaultValue={service.sort_order ?? ""}
                    className="border p-1 rounded w-full"
                  />
                </form>
              </td>

              {/* SHOW PRICE */}
              <td className="p-2 text-center">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="show_price" />
                  <input
                    type="hidden"
                    name="value"
                    value={(!service.show_price).toString()}
                  />
                  <button type="submit">
                    {service.show_price ? "✅" : "❌"}
                  </button>
                </form>
              </td>

              {/* FEATURED */}
              <td className="p-2 text-center">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="featured" />
                  <input
                    type="hidden"
                    name="value"
                    value={(!service.featured).toString()}
                  />
                  <button type="submit">
                    {service.featured ? "⭐" : "—"}
                  </button>
                </form>
              </td>

              {/* ACTIVE */}
              <td className="p-2 text-center">
                <form action={updateServiceField}>
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="field" value="active" />
                  <input
                    type="hidden"
                    name="value"
                    value={(!service.active).toString()}
                  />
                  <button type="submit">
                    {service.active ? "🟢" : "🔴"}
                  </button>
                </form>
              </td>

              {/* DELETE */}
              <td className="p-2 text-center">
                <form action={deleteService}>
                  <input type="hidden" name="id" value={service.id} />
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑
                  </button>
                </form>
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}