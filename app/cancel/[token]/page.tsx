"use client";

import { useParams } from "next/navigation";
import CancelClient from "./CancelClient";

export default function Page() {
  const params = useParams();
  const token = params?.token as string;

  if (!token) {
    return <div>Missing token</div>;
  }

  return <CancelClient token={token} />;
}