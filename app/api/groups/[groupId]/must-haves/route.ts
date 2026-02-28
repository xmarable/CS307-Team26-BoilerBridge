/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import mongoose from "mongoose";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import TravelGroup from "@/models/TravelGroup";
import MustHave from "@/models/MustHave";

function isMemberOrLeader(group: any, userMongoId: string) {
  const leader = group?.leaderID?.toString() === userMongoId;
  const member =
    Array.isArray(group?.membersList) &&
    group.membersList.some((id: any) => id?.toString() === userMongoId);
  return leader || member;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CreateMustHaveSchema = z.object({
  tripId: z.string().optional(),
  placeId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  notes: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  status: z.enum(["proposed", "approved", "rejected"]).optional(),
});

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
  ) {
    try {
      const session = await getServerSession(authOptions);
      const rawId = session?.user && "id" in session.user ? (session.user as any).id : undefined;
      const userMongoId = typeof rawId === "string" ? rawId : undefined;
  
      if (!userMongoId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
  
      const { groupId } = await params;
      if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
        return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
      }
  
      await dbConnect();
  
      const group: any = await TravelGroup.findById(groupId).lean();
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      if (!isMemberOrLeader(group, userMongoId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
  
      const body = await req.json();
      const parsed = CreateMustHaveSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid payload", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
  
      const data = parsed.data;
  
      // ---- Dedup logic ----
      // Prevent duplicates by:
      // 1) same placeId (if provided)
      // OR
      // 2) same name + address (case-insensitive) if both provided
      const dedupOr: any[] = [];
  
      if (data.placeId) {
        dedupOr.push({ placeId: data.placeId });
      }
  
      if (data.name && data.address) {
        const nameRe = new RegExp(`^${escapeRegex(data.name.trim())}$`, "i");
        const addressRe = new RegExp(`^${escapeRegex(data.address.trim())}$`, "i");
        dedupOr.push({ name: nameRe, address: addressRe });
      }
  
      if (dedupOr.length > 0) {
        const existing = await MustHave.findOne({
          groupId,
          $or: dedupOr,
        }).lean();
  
        if (existing) {
          return NextResponse.json(
            { error: "Duplicate must-have", duplicateOf: existing },
            { status: 409 }
          );
        }
      }
  
      const created = await MustHave.create({
        groupId,
        tripId: data.tripId,
        placeId: data.placeId,
        name: data.name,
        category: data.category,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        notes: data.notes,
        priority: data.priority ?? 3,
        addedBy: userMongoId,
        status: data.status ?? "proposed",
      });
  
      return NextResponse.json({ mustHave: created }, { status: 201 });
    } catch (err: any) {
      console.error("POST must-haves error:", err);
      return NextResponse.json(
        { error: "Server error", details: err?.message ?? String(err) },
        { status: 500 }
      );
    }
  }
