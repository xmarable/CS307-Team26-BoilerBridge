import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { uploadImage } from "@/lib/cloudinary";
import User from "@/models/User";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const body = await req.json();
    const { name, username, school, location, profileImage } = body;

    const user = await db
      .collection("users")
      .findOne({ email: session.user.email });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updateData: any = {
      name,
      school,
      location,
      updatedAt: new Date(),
    };

    // Username Change Logic: 14 Day Restriction
    if (username && username !== user.username) {
      const lastChanged = user.usernameLastChanged
        ? new Date(user.usernameLastChanged)
        : null;
      const now = new Date();
      const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;

      if (
        lastChanged &&
        now.getTime() - lastChanged.getTime() < fourteenDaysInMs
      ) {
        const daysLeft = Math.ceil(
          (fourteenDaysInMs - (now.getTime() - lastChanged.getTime())) /
            (1000 * 60 * 60 * 24),
        );
        return NextResponse.json(
          { error: `You can change your username again in ${daysLeft} days.` },
          { status: 429 },
        );
      }

      // Check if new username is already taken
      const existing = await db.collection("users").findOne({ username });
      if (existing)
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 },
        );

      updateData.username = username;
      updateData.usernameLastChanged = new Date();
    }

    // Cloudinary Logic
    if (profileImage && profileImage.startsWith("data:image")) {
      try {
        updateData.image = await uploadImage(profileImage);
      } catch (err) {
        return NextResponse.json(
          { error: "Image upload failed" },
          { status: 500 },
        );
      }
    } else {
      updateData.image = profileImage;
    }

    const result = await User.findOneAndUpdate(
      { email: session.user.email },
      {
        $set: {
          name: updateData.name,
          school: updateData.school,
          location: updateData.location,
          image: updateData.image,
          username: updateData.username,
          usernameLastChanged: updateData.usernameLastChanged,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 },
    );
  }
}
