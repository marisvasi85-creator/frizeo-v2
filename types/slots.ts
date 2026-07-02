export type Slot =
  | { type: "free"; time: string }
  | { type: "booking"; time: string; end: string; booking: any }
  | { type: "break"; start: string; end: string }
  | {
      type: "unavailable";
      time: string;
      reason: "past" | "notice";
    };