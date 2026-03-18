import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type CreateSchoolPayload = {
    schoolName?: string;
    phone?: string;
    state?: string;
    district?: string;
    pincode?: string;
    address?: string;
};

type SchoolDocument = {
    uid: string;
    schoolName: string;
    name: string;
    phone: string;
    state: string;
    district: string;
    pincode: string;
    address: string;
};

type OrganizationDocument = {
    uid: string;
    email?: string;
    schools?: SchoolDocument[];
};

const phonePattern = /^\d{10}$/;
const pincodePattern = /^\d{6}$/;

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

        const payload = (await request.json()) as CreateSchoolPayload;
        const schoolName = normalizeString(payload.schoolName);
        const phone = normalizeString(payload.phone);
        const state = normalizeString(payload.state);
        const district = normalizeString(payload.district);
        const pincode = normalizeString(payload.pincode);
        const address = normalizeString(payload.address);

        const fieldErrors: Record<string, string> = {};

        if (!schoolName) {
            fieldErrors.schoolName = "School name is required.";
        }

        if (!phonePattern.test(phone)) {
            fieldErrors.phone = "Phone number must be exactly 10 digits.";
        }

        if (!state) {
            fieldErrors.state = "State is required.";
        }

        if (!district) {
            fieldErrors.district = "District is required.";
        }

        if (!pincodePattern.test(pincode)) {
            fieldErrors.pincode = "Pincode must be exactly 6 digits.";
        }

        if (!address) {
            fieldErrors.address = "Address is required.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
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
                { message: "Only organization admins can add schools." },
                { status: 403 },
            );
        }

        const school: SchoolDocument = {
            uid: randomUUID(),
            schoolName,
            name: schoolName,
            phone,
            state,
            district,
            pincode,
            address,
        };

        const updateResult = await organizations.updateOne(
            { uid: organization.uid },
            { $push: { schools: school } },
        );

        if (!updateResult.matchedCount) {
            return NextResponse.json(
                { message: "Organization not found." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                message: "School added successfully.",
                school,
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to add school.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
