import { NextResponse } from "next/server";
import User from "@/models/User";

// Temporary placeholder to satisfy TypeScript/Next.js build
export async function GET() {
  return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
}
