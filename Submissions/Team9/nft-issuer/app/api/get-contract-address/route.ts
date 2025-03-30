import { NextResponse } from "next/server";

export async function GET() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    return NextResponse.json(
      { error: "Private key not found" },
      { status: 500 }
    );
  }

  return NextResponse.json({ contractAddress });
}
