export type Slot =
  | { type: "free"; time: string }
  | { type: "booking"; time: string; booking: any }
  | { type: "break"; start: string; end: string };