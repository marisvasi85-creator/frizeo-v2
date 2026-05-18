"use client";

export default function Pricing() {
  const buy = async (priceId: string) => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({ priceId }),
    });

    const data = await res.json();
    window.location.href = data.url;
  };

  return (
    <div className="max-w-4xl mx-auto p-10 grid grid-cols-3 gap-6">

      <div className="border p-6 rounded-xl">
        <h2>Basic</h2>
        <p>9€/lună</p>
        <button onClick={() => buy("price_basic")}>Alege</button>
      </div>

      <div className="border p-6 rounded-xl">
        <h2>Pro</h2>
        <p>19€/lună</p>
        <button onClick={() => buy("price_pro")}>Alege</button>
      </div>

    </div>
  );
}