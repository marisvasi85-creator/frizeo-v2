"use client";

import { useTransition } from "react";
import {
  updateServiceField,
  deleteService,
  updateServiceOrder,
} from "./actions";
import AddServiceModal from "./components/AddServiceModal";

import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

type Service = {
  id: string;
  name: string;
  duration: number | null;
  price: number | null;
  sort_order: number | null;
  show_price: boolean | null;
  featured: boolean | null;
  active: boolean;
};

export default function ServicesClient({
  services,
}: {
  services: Service[];
}) {
  const [pending, startTransition] = useTransition();

  function update(id: string, field: string, value: any) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", id);
      formData.append("field", field);
      formData.append("value", value);
      await updateServiceField(formData);
    });
  }

  function remove(id: string) {
    if (!confirm("Sigur vrei să ștergi serviciul?")) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", id);
      await deleteService(formData);
    });
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = services.findIndex(
      (s) => s.id === active.id
    );
    const newIndex = services.findIndex(
      (s) => s.id === over.id
    );

    const newItems = [...services];
    const [moved] = newItems.splice(oldIndex, 1);
    newItems.splice(newIndex, 0, moved);

    updateServiceOrder(newItems.map((i) => i.id));
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Servicii</h1>
        <AddServiceModal />
      </div>

      {/* LIST */}
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={services.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {services.map((s) => (
              <SortableItem key={s.id} id={s.id}>
                <div className="bg-[#161618] border border-white/10 p-4 rounded-xl flex flex-col gap-4">

                  {/* TOP */}
                  <div className="flex justify-between items-start gap-3">

                    <div className="flex-1 space-y-2">

                      {/* NAME */}
                      <input
                        defaultValue={s.name}
                        onBlur={(e) =>
                          update(s.id, "name", e.target.value)
                        }
                        className="bg-transparent border border-white/10 px-3 py-2 rounded w-full text-sm"
                      />

                      {/* ROW */}
                      <div className="flex flex-wrap gap-2">

                        <input
                          type="number"
                          defaultValue={s.duration ?? ""}
                          onBlur={(e) =>
                            update(
                              s.id,
                              "duration",
                              e.target.value
                            )
                          }
                          placeholder="Durată"
                          className="bg-transparent border border-white/10 px-3 py-2 rounded w-28 text-sm"
                        />

                        <input
                          type="number"
                          defaultValue={s.price ?? ""}
                          onBlur={(e) =>
                            update(
                              s.id,
                              "price",
                              e.target.value
                            )
                          }
                          placeholder="Preț"
                          className="bg-transparent border border-white/10 px-3 py-2 rounded w-28 text-sm"
                        />

                        <input
                          type="number"
                          defaultValue={s.sort_order ?? ""}
                          onBlur={(e) =>
                            update(
                              s.id,
                              "sort_order",
                              e.target.value
                            )
                          }
                          placeholder="Ordine"
                          className="bg-transparent border border-white/10 px-3 py-2 rounded w-24 text-sm"
                        />

                      </div>
                    </div>

                    {/* DELETE */}
                    <button
                      onClick={() => remove(s.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Șterge
                    </button>
                  </div>

                  {/* TOGGLES */}
                  <div className="flex flex-wrap gap-6 text-sm">

                    <Toggle
                      label="Activ"
                      value={s.active}
                      onClick={() =>
                        update(
                          s.id,
                          "active",
                          (!s.active).toString()
                        )
                      }
                    />

                    <Toggle
                      label="Afișează preț"
                      value={!!s.show_price}
                      onClick={() =>
                        update(
                          s.id,
                          "show_price",
                          (!s.show_price).toString()
                        )
                      }
                    />

                    <Toggle
                      label="Recomandat"
                      value={!!s.featured}
                      onClick={() =>
                        update(
                          s.id,
                          "featured",
                          (!s.featured).toString()
                        )
                      }
                    />

                  </div>
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* EMPTY */}
      {services.length === 0 && (
        <div className="text-white/60 text-sm">
          Nu ai servicii încă. Adaugă primul serviciu.
        </div>
      )}
    </div>
  );
}

/* SORTABLE ITEM */
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners}>
        {children}
      </div>
    </div>
  );
}

/* TOGGLE */
function Toggle({
  label,
  value,
  onClick,
}: {
  label: string;
  value: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-2">
      <div
        className={`w-10 h-5 rounded-full transition ${
          value ? "bg-green-500" : "bg-gray-600"
        }`}
      >
        <div
          className={`w-4 h-4 bg-white rounded-full mt-[2px] transition ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </div>

      <span className="text-white/70">{label}</span>
    </button>
  );
}