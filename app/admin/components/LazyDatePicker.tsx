"use client";

import dynamic from "next/dynamic";
import "react-datepicker/dist/react-datepicker.css";

const ReactDatePicker = dynamic(
  () => import("react-datepicker").then((mod) => mod.default as never),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
    ),
  },
);

export default function LazyDatePicker(props: Record<string, unknown>) {
  const DatePicker = ReactDatePicker as unknown as React.ComponentType<
    Record<string, unknown>
  >;
  return <DatePicker {...props} />;
}
