"use client";

import { AdminLabel, AdminSelect } from "../../components/AdminInput";
import FormWithSaveFeedback from "../../components/FormWithSaveFeedback";
import { saveBookingRules } from "../actions";

const NOTICE_OPTIONS = [
  { value: "0", label: "Fără restricție (doar nu în trecut)" },
  { value: "1", label: "1 oră înainte" },
  { value: "2", label: "2 ore înainte (recomandat)" },
  { value: "3", label: "3 ore înainte" },
  { value: "4", label: "4 ore înainte" },
  { value: "6", label: "6 ore înainte" },
  { value: "12", label: "12 ore înainte" },
  { value: "24", label: "24 ore înainte" },
];

type Props = {
  minBookingNoticeHours: number;
};

export default function BookingRulesForm({ minBookingNoticeHours }: Props) {
  return (
    <FormWithSaveFeedback
      action={saveBookingRules}
      className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4"
      saveLabel="Salvează regulile"
    >
      <div>
        <h2 className="text-lg font-semibold">Reguli programări online</h2>
        <p className="text-sm text-white/50 mt-1">
          Clienții nu pot rezerva în trecut. Poți seta cât timp înainte trebuie
          făcută programarea. Din admin poți programa oricând (exceptând trecutul).
        </p>
      </div>

      <div>
        <AdminLabel>Timp minim înainte de programare (clienți)</AdminLabel>

        <AdminSelect
          name="min_booking_notice_hours"
          defaultValue={String(minBookingNoticeHours)}
        >
          {NOTICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelect>
      </div>
    </FormWithSaveFeedback>
  );
}
