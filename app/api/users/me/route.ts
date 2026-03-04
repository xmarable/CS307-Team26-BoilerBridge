import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { uploadImage } from "@/lib/cloudinary";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("boilerbridge"); // database name goes here
    const body = await req.json();
    const { name, school, location, profileImage } = body;

    let imageUrl = profileImage;

    // Upload to Cloudinary if it's a new base64 string
    if (profileImage && profileImage.startsWith("data:image")) {
      imageUrl = await uploadImage(profileImage);
    }

    const result = await db.collection("users").findOneAndUpdate(
      { email: session.user.email },
      {
        $set: {
          name,
          school,
          location,
          image: imageUrl,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
