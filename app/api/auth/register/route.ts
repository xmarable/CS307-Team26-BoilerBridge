import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { z } from "zod";

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(64)
});

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }
    else {
      const { username, email, password } = validation.data;

      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username }]
      });

      if (existingUser) {
        return NextResponse.json({ error: "User already exists" }, { status: 409 });
      }
      else {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
          username: username,
          email: email.toLowerCase(),
          passwordHash: passwordHash,
          school: "Purdue University"
        });

        await newUser.save();

        return NextResponse.json({ message: "Account created" }, { status: 201 });
      }
    }
  }
  catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}