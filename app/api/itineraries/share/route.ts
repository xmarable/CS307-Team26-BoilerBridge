import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import SharedItineraryLink from "@/models/SharedItineraryLink";
import TravelGroup from "@/models/TravelGroup";
import Trip from "@/models/Trip";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const ShareItenerarySchema = z.object({
    groupId: z.string().min(1)
});

const GetIteneraryShareSchema = z.object({
    groupId: z.string().min(1)
});

const UpdateShareItenerarySchema = z.object({
  groupId: z.string().min(1),
  isActive: z.boolean(),
});

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const parsed = ShareItenerarySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Malformed" }, { status: 400 });
    }
    
    dbConnect();
    const userId = session.user.userId;
    const groupId = parsed.data.groupId;
    const group = await TravelGroup.findOne({ groupID: groupId, "membersList.userId": userId });
    if (!group) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const trip = await Trip.findOne({ groupID: groupId });
    if (!trip) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (trip.shareLink) {
        return NextResponse.json({ shareURL: trip.shareLink }, { status: 200 });
    }

    const token = randomBytes(24).toString("hex");
    const shared = await SharedItineraryLink.findOneAndUpdate(
        { groupId: groupId },
        {
            tripId: trip.tripId,
            token: token,
            isActive: true,
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    )

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const url = `${baseUrl}/shared/itinerary/${shared.token}`;
    trip.shareLink = url;
    await trip.save();

    return NextResponse.json({ shareURL: url }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = await UpdateShareItenerarySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Malformed" }, { status: 400 });
    }

    const userId = session.user.userId;
    const { groupId, isActive } = parsed.data;

    const group = await TravelGroup.findOne({ groupID: groupId, "membersList.userId": userId });
    if (!group) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const shared = await SharedItineraryLink.findOneAndUpdate(
        { groupId: groupId },
        { isActive: isActive },
    )
    if (!shared) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "success"}, { status: 200 })
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.userId;
    const groupId = req.nextUrl.searchParams.get("groupId");
    const group = await TravelGroup.findOne({ groupID: groupId, "membersList.userId": userId });
    if (!group) {
        return NextResponse.json({ error: "Group Not found" }, { status: 404 });
    }

    const shared = await SharedItineraryLink.findOne(
        { groupId: groupId }
    )
    if (!shared) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ isActive: shared.isActive }, { status: 200 })
}