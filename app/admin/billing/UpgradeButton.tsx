"use client";

export default function UpgradeButton({
  planId,
}: {
  planId: string;
}) {
  async function handleUpgrade() {
    const res = await fetch(
      "/api/billing/checkout",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          planId,
        }),
      }
    );

    const data = await res.json();

    alert(data.message);
  }

  return (
    <button
      onClick={handleUpgrade}
      className="w-full bg-white text-black py-2 rounded"
    >
      Upgrade
    </button>
  );
}