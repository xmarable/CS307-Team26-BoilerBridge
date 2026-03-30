import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import dbConnect from "@/lib/dbConnect";

export async function GET() {
  return new Response(
    JSON.stringify({
      message: "Welcome to the Discover API route!",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
