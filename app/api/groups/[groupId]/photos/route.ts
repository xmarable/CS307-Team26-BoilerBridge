import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import TravelGroup from "@/models/TravelGroup";
import z from "zod";
import { uploadImage } from "@/lib/cloudinary";
import { randomUUID } from "crypto";

const ImageSchema = z.object({
    images: z.array(z.string().trim()).min(1)
});

const ImageDeletionSchema = z.object({
    imageId: z.uuid()
});
 
async function verifyUser(params: Promise<any>) {
    // Verify user logged in
    const session = await getServerSession(authOptions);
    const userId = (session?.user)?.userId as string | undefined;
    if (!userId) {
        return null;
    }
    console.log(userId);

    // Verify user exists
    await dbConnect();
    const user = await User.findOne({ userId: userId });

    if (!user) {
        return null;
    }

    // Find group from id
    const { groupId } = await params;    
    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
        return null;
    }

    return { group, userId: userId };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const images = ImageSchema.safeParse(body);
    if (!images.success) {
        return NextResponse.json(
            { error: "Invalid upload", details: images.error.flatten() },
            { status: 400 }
        );
    }

    const newImages = images.data.images.map((i) => ({
        photoId: randomUUID(),
        uploaderID: info.userId,
        image: i
    }));

    for (const image of newImages) {
        try {
            const url = await uploadImage(image.image);

            image.image = url;
        } catch(e) {
            return NextResponse.json(
                { error: "Image upload failed"},
                { status: 500 }
            );
        }
    }

    info.group.photos.unshift(...newImages);
    await info.group.save();

    return NextResponse.json({ images: newImages }, { status: 200 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO better logic for getting images
    const images = info.group.photos ?? [];

    return NextResponse.json({ images: images }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const imageId = ImageDeletionSchema.safeParse(body);
    if (!imageId.success) {
        return NextResponse.json(
            { error: "Invalid deletion", details: imageId.error.flatten() },
            { status: 400 }
        );
    }

    // TODO logic for removing images
    const images = info.group.photos ?? [];
    info.group.photos = images.filter((img: any) => img.photoId.toString() !== imageId.data.imageId);
    
    await info.group.save();

    return NextResponse.json({ message: "Success" }, { status: 200 });
}