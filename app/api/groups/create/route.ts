import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import { z } from "zod";

const createGroupSchema = z.object({
  groupName: z.string().min(1, "Group name is required").trim(),
  description: z.string().trim().optional(),
});

function cookiesAndHeadersFromRequest(req: Request): { cookies: Record<string, string>; headers: Record<string, string> } {
  const cookieHeader = req.headers.get("cookie");
  const cookies: Record<string, string> = cookieHeader
    ? Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const [key, ...v] = c.trim().split("=");
          return [key ?? "", decodeURIComponent(v.join("=").trim())];
        })
      )
    : {};
  const headers: Record<string, string> = Object.fromEntries(req.headers.entries());
  return { cookies, headers };
}

export async function POST(req: Request) {
  try {
    const { cookies, headers } = cookiesAndHeadersFromRequest(req);
    // Use a minimal request/response shape compatible with NextAuth's AuthHandler.
    const session = await (getServerSession as any)(
      { cookies, headers },
      {
        getHeader() {},
        setCookie() {},
        setHeader() {},
      },
      authOptions
    );
    const userId = session?.user && "id" in session.user ? session.user.id : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to create a group" },
        { status: 401 }
      );
    }

    await dbConnect();

    const body = await req.json();
    const validation = createGroupSchema.safeParse(body);

    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "Invalid input data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { groupName, description } = validation.data;
    const leaderId = userId;

    const newGroup = new TravelGroup({
      groupName,
      ...(description !== undefined && description !== "" && { description }),
      leaderID: leaderId,
      membersList: [leaderId],
      ledger: [],
      chatLogs: [],
    });

    await newGroup.save();

    return NextResponse.json(
      {
        message: "Group created",
        group: {
          _id: newGroup._id.toString(),
          groupID: newGroup.groupID,
          groupName: newGroup.groupName,
          description: newGroup.description,
          leaderID: newGroup.leaderID.toString(),
          membersList: newGroup.membersList.map((id: { toString(): string }) => id.toString()),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/groups/create error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
