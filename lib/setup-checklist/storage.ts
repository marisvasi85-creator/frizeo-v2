export type SetupChecklistStep = "services" | "schedule" | "notifications";

export type SetupChecklistState = {
  dismissed: boolean;
  completed: Partial<Record<SetupChecklistStep, boolean>>;
};

const STORAGE_PREFIX = "frizeo-setup-checklist-v1";

export const SETUP_CHECKLIST_STEPS: {
  id: SetupChecklistStep;
  title: string;
  description: string;
  href: string;
  cta: string;
}[] = [
  {
    id: "services",
    title: "Editează serviciile",
    description:
      "Am pus 3 exemple (Tuns, Barbă, Tuns + Barbă). Adaptează prețuri și durate.",
    href: "/admin/services",
    cta: "Deschide serviciile",
  },
  {
    id: "schedule",
    title: "Verifică programul",
    description:
      "Implicit: L–V 09:00–18:00, S 09:00–14:00. Schimbă după nevoile tale.",
    href: "/admin/settings",
    cta: "Deschide programul",
  },
  {
    id: "notifications",
    title: "Verifică notificările",
    description:
      "Confirmările pe email sunt deja active. Poți ajusta reminder-ele.",
    href: "/admin/notifications",
    cta: "Deschide notificările",
  },
];

const listeners = new Set<() => void>();
const snapshotCache = new Map<string, SetupChecklistState>();

export function setupChecklistStorageKey(barberId: string) {
  return `${STORAGE_PREFIX}:${barberId}`;
}

const EMPTY_STATE: SetupChecklistState = Object.freeze({
  dismissed: false,
  completed: Object.freeze({}),
});

export function emptySetupChecklistState(): SetupChecklistState {
  return EMPTY_STATE;
}

function readFromStorage(barberId: string): SetupChecklistState {
  if (typeof window === "undefined") return emptySetupChecklistState();

  try {
    const raw = localStorage.getItem(setupChecklistStorageKey(barberId));
    if (!raw) return emptySetupChecklistState();

    const parsed = JSON.parse(raw) as Partial<SetupChecklistState>;
    return {
      dismissed: Boolean(parsed.dismissed),
      completed: {
        services: Boolean(parsed.completed?.services),
        schedule: Boolean(parsed.completed?.schedule),
        notifications: Boolean(parsed.completed?.notifications),
      },
    };
  } catch {
    return emptySetupChecklistState();
  }
}

function emitChange() {
  for (const listener of listeners) listener();
}

function writeState(barberId: string, state: SetupChecklistState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      setupChecklistStorageKey(barberId),
      JSON.stringify(state),
    );
  }
  snapshotCache.set(barberId, state);
  emitChange();
  return state;
}

export function subscribeSetupChecklist(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(STORAGE_PREFIX)) return;
    snapshotCache.clear();
    onStoreChange();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getSetupChecklistSnapshot(barberId: string): SetupChecklistState {
  const cached = snapshotCache.get(barberId);
  if (cached) return cached;

  const state = readFromStorage(barberId);
  snapshotCache.set(barberId, state);
  return state;
}

export function getSetupChecklistServerSnapshot(): SetupChecklistState {
  return emptySetupChecklistState();
}

export function markSetupChecklistStep(
  barberId: string,
  step: SetupChecklistStep,
) {
  const current = getSetupChecklistSnapshot(barberId);
  if (current.completed[step]) return current;

  return writeState(barberId, {
    ...current,
    completed: { ...current.completed, [step]: true },
  });
}

export function dismissSetupChecklist(barberId: string) {
  const current = getSetupChecklistSnapshot(barberId);
  return writeState(barberId, { ...current, dismissed: true });
}

export function isSetupChecklistComplete(state: SetupChecklistState) {
  return SETUP_CHECKLIST_STEPS.every((step) => state.completed[step.id]);
}
