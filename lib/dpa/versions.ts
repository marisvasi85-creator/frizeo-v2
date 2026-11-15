import { DPA_CANONICAL_TEXT, DPA_VERSION, DPA_VERSION_DATE } from "@/lib/dpa/document";

export type DpaVersionRecord = {
  version: string;
  date: string;
  text: string;
};

const ACCEPTABLE: Record<string, DpaVersionRecord> = {
  [DPA_VERSION]: {
    version: DPA_VERSION,
    date: DPA_VERSION_DATE,
    text: DPA_CANONICAL_TEXT,
  },
};

export function dpaVersionRecord(version: string): DpaVersionRecord | null {
  return ACCEPTABLE[version] ?? null;
}
