"use client";

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number;
  max_barbers: number | null;
  max_bookings_per_month: number | null;
};

type Props = {
  planName: string;
  isSelected?: boolean;
  trialEarlyPurchase?: boolean;
  onSelectPlan: (plan: Plan) => void;
  plan: Plan;
};

export default function UpgradeButton({
  planName,
  isSelected = false,
  trialEarlyPurchase = false,
  onSelectPlan,
  plan,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelectPlan(plan)}
      className={`w-full py-2 rounded transition ${
        isSelected
          ? "bg-white text-black ring-2 ring-blue-400"
          : "bg-white text-black hover:bg-gray-200"
      }`}
    >
      {isSelected
        ? `Plan selectat — continuă mai jos`
        : trialEarlyPurchase
          ? `Cumpără ${planName}`
          : `Alege ${planName}`}
    </button>
  );
}
