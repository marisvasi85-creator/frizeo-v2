"use client";

import AddToHomeScreenPrompt from "@/app/components/pwa/AddToHomeScreenPrompt";
import RegisterServiceWorker from "@/app/components/pwa/RegisterServiceWorker";

export default function InstallAppPrompt() {
  return (
    <>
      <RegisterServiceWorker />
      <AddToHomeScreenPrompt />
    </>
  );
}
