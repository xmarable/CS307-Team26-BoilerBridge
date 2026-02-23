import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import UserImport from "../models/User";
import { validateLogin } from "@/lib/validateLogin";

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

        await new User({
            username: "login_test_user",
            email: "login_success@test.com",
            passwordHash: hashedPass,
        }).save();

        const result = await validateLogin("login_success@test.com", plainPass);

        expect(result).toBeDefined();
        expect(result.email).toBe("login_success@test.com");
    });

    it("should return null with incorrect password", async () => {
        const hashedPass = await bcrypt.hash("correctPass123", 10);

        await new User({
            username: "login_test_user",
            email: "incorrect_pass@test.com",
            passwordHash: hashedPass,
        }).save();

        const result = await validateLogin("incorrect_pass@test.com", "incorrectPass");

        expect(result).toBeNull();
    });

    it("should return null for an unregistered user", async () => {
        const result = await validateLogin("fever@dream.user", "hallucinatedPass")

        expect(result).toBeNull();
    });
});