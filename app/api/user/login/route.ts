import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  verifyPassword,
} from "@/lib/organization-auth";
import { getDatabase } from "@/lib/mongodb";

type LoginPayload = {
  email?: string;
  password?: string;
};

type UserDocument = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: "teacher" | "parent";
  organizationId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const COLLECTION_NAME = "users";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const email = normalizeString(payload.email).toLowerCase();
    const password = normalizeString(payload.password);

    const fieldErrors: Record<string, string> = {};

    if (!emailPattern.test(email)) {
      fieldErrors.email = "Enter a valid email address.";
    }

    if (password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters long.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          fieldErrors,
          message: "Validation failed.",
        },
        { status: 400 },
      );
    }

    const database = await getDatabase();
    const collection = database.collection<UserDocument>(COLLECTION_NAME);
    const user = await collection.findOne({ email });

    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // Use organizationId as the token uid so all protected org-scoped routes work correctly.
    const accessToken = createAccessToken({
      email: user.email,
      uid: user.organizationId,
    });

    const response = NextResponse.json(
      {
        accessToken,
        message: "Login successful.",
        user: {
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          uid: user.uid,
        },
      },
      { status: 200 },
    );

    response.cookies.set({
      httpOnly: true,
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
      name: "access_token",
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: accessToken,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to login.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
