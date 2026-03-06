import { NextRequest } from "next/server"
import z from "zod";

const ForgotPassSchema = z.object({
    email: z.string().email()
})

export function POST(req: NextRequest) {
    const body = req.json();
    const email = ForgotPassSchema.safeParse(body)
}