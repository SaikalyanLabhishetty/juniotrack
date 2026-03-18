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

type OrganizationDocument = {
  uid: string;
  email: string;
  passwordHash?: string;
  schools?: Array<{
    uid?: string;
  }>;
};

const COLLECTION_NAME = "organization";
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
    const collection = database.collection<OrganizationDocument>(COLLECTION_NAME);
    const organization = await collection.findOne({ email });

    if (!organization?.passwordHash || !verifyPassword(password, organization.passwordHash)) {
      return NextResponse.json(
        {
          message: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    const schoolId =
      normalizeString(organization.schools?.[0]?.uid) ||
      normalizeString(organization.uid);

    const accessToken = createAccessToken({
      email: organization.email,
      uid: organization.uid,
      schoolId: schoolId || undefined,
    });

    const response = NextResponse.json(
      {
        message: "Login successful.",
        accessToken,
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

    return NextResponse.json(
      {
        message,
      },
      { status: 500 },
    );
  }
}
