import dbConnect from "./dbConnect";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function validateLogin(email: string, password: string) {
    await dbConnect();
    const user = await User.findOne({ email: email });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;
    
    return user;
}