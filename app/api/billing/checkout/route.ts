import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Missing planId" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Stripe checkout va fi implementat aici",
      planId,
    });

  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}