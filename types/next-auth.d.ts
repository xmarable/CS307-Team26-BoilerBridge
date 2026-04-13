

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userId: string;
      username?: string | null;
      isStudentVerified?: boolean;
      eduEmail?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    userId: string;
    username?: string | null;
    isStudentVerified?: boolean;
    eduEmail?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    userId: string;
    username?: string | null;
    isStudentVerified?: boolean;
    eduEmail?: string | null;
  }
}
