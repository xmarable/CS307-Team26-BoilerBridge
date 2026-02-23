/* eslint-disable @typescript-eslint/no-unused-vars */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import UserImport from "../models/User";
import { validateLogin } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const User = (UserImport as any).default || UserImport;

const CONNECTION_CLEANUP_DELAY_MS = 500;

beforeAll(async () => {
    await dbConnect();
});

afterAll(async () => {
    if (User && typeof User.deleteMany() === "function") {
        await User.deleteMany();
    }

    await mongoose.connection.close();
    await new Promise(resolve => {
            setTimeout(resolve, CONNECTION_CLEANUP_DELAY_MS);
    });
})

describe('Login Test Suite', () => {
    it("should return user for correct credentials", async () => {
        const plainPass = "securePassword123";
        const hashedPass = await bcrypt.hash(plainPass, 10);
    })
})