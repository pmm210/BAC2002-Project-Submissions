"use client";

import { useState } from "react";

export default function CheckoutPage() {
  const [studentId, setStudentId] = useState<number | null>(null);
  const [status, setStatus] = useState("Idle");

  const handleApplyDiscount = async () => {
    setStatus("🔄 Generating proof and verifying offchain...");

    try {
      const response = await fetch("/api/generate-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      const { success, a, b, c, input } = await response.json();
      if (!success) throw new Error("Proof generation failed");

      console.log("🧾 studentId:", studentId);
      console.log("🧪 Proof a:", a);
      console.log("🧪 Proof b:", b);
      console.log("🧪 Proof c:", c);
      console.log("📤 input:", input);

      // Offchain check: last element is 1 => valid, 0 => invalid
      const publicOutput = BigInt(input[2]);
      console.log("📤 Public output:", publicOutput.toString());

      if (publicOutput === BigInt("1")) {
        setStatus("✅ Proof indicates a valid student ID. Discount applied.");
      } else if (publicOutput === BigInt("0")) {
        setStatus("❌ Proof indicates an invalid student ID. Discount not applied.");
      } else {
        setStatus("⚠️ Unexpected public output: " + publicOutput.toString());
      }
    } catch (error: any) {
      console.error("❌ Error during proof generation:", error);
      setStatus("❌ Error: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          ZKP Discount Checkout
        </h1>
        <p className="text-gray-600 mb-6">
          Enter a student ID and generate a Zero-Knowledge Proof offchain. The
          proof output will indicate if the ID is valid or invalid.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Student ID
        </label>
        <input
          type="number"
          className="border border-gray-300 px-3 py-2 rounded w-full mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="e.g. 1000"
          value={studentId ?? ""}
          onChange={(e) => setStudentId(Number(e.target.value))}
        />

        <button
          onClick={handleApplyDiscount}
          className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Apply Discount
        </button>

        <p className="mt-4 text-gray-700">
          <span className="font-semibold">Status:</span> {status}
        </p>
      </div>
    </div>
  );
}
