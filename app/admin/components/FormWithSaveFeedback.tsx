"use client";

import { useActionState, type ReactNode } from "react";
import FormSaveButton from "./FormSaveButton";
import {
  initialSaveFormState,
  type SaveFormState,
} from "./saveFormState";

type Props = {
  action: (
    prevState: SaveFormState,
    formData: FormData
  ) => Promise<SaveFormState>;
  children: ReactNode;
  className?: string;
  saveLabel?: string;
};

export default function FormWithSaveFeedback({
  action,
  children,
  className,
  saveLabel,
}: Props) {
  const [state, formAction] = useActionState(action, initialSaveFormState);

  return (
    <form action={formAction} className={className}>
      {state.error && (
        <p className="text-red-400 text-sm">{state.error}</p>
      )}

      {children}

      <FormSaveButton saved={state.success} label={saveLabel} />
    </form>
  );
}
