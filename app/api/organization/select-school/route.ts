import { NextResponse } from "next/server";
import {
    ACCESS_TOKEN_TTL_SECONDS,
    createAccessToken,
} from "@/lib/organization-auth";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type SelectSchoolPayload = {
    schoolId?: string;
};

type OrganizationDocument = {
    uid: string;
    email?: string;
    schools?: Array<{
        uid?: string;
    }>;
};

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const payload = (await request.json()) as SelectSchoolPayload;
        const requestedSchoolId = normalizeString(payload.schoolId);

        if (!requestedSchoolId) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        schoolId: "School is required.",
                    },
                },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const organizations = database.collection<OrganizationDocument>(
            "organization",
        );
        const organization = await organizations.findOne(
            { uid: tokenPayload.uid },
            {
                projection: {
                    uid: 1,
                    email: 1,
                    schools: 1,
                },
            },
        );

        if (!organization) {
            return NextResponse.json(
                { message: "Organization not found." },
                { status: 404 },
            );
        }

        const organizationEmail = normalizeString(organization.email).toLowerCase();

        if (
            organizationEmail &&
            organizationEmail !== normalizeString(tokenPayload.email).toLowerCase()
        ) {
            return NextResponse.json(
                { message: "Only organization admins can switch schools." },
                { status: 403 },
            );
        }

        const schoolIds = Array.isArray(organization.schools) &&
            organization.schools.length > 0
            ? organization.schools
                  .map((school) => normalizeString(school.uid))
                  .filter(Boolean)
            : [normalizeString(organization.uid)];

        if (!schoolIds.includes(requestedSchoolId)) {
            return NextResponse.json(
                { message: "School not found in this organization." },
                { status: 404 },
            );
        }

        const accessToken = createAccessToken({
            email: organizationEmail || tokenPayload.email,
            uid: organization.uid,
            schoolId: requestedSchoolId,
        });

        const response = NextResponse.json(
            {
                message: "School switched successfully.",
                accessToken,
                schoolId: requestedSchoolId,
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
        const message =
            error instanceof Error ? error.message : "Unable to switch school.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
