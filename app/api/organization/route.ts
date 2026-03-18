import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/organization-auth";
import { getDatabase } from "@/lib/mongodb";

type CreateOrganizationPayload = {
  organizationName?: string;
  schoolName?: string;
  name?: string;
  email?: string;
  phone?: string;
  state?: string;
  district?: string;
  pincode?: string;
  address?: string;
  password?: string;
};

type SchoolDocument = {
  uid: string;
  schoolName: string;
  name?: string;
  phone: string;
  state: string;
  district: string;
  pincode: string;
  address: string;
};

type OrganizationDocument = {
  uid: string;
  name: string;
  organizationName: string;
  email: string;
  schools: SchoolDocument[];
  passwordHash: string;
  createdAt: string;
  status: "active";
};

const COLLECTION_NAME = "organization";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;
const pincodePattern = /^\d{6}$/;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateOrganizationPayload;
    const name = normalizeString(payload.name);
    const organizationName = normalizeString(payload.organizationName);
    const schoolName = normalizeString(payload.schoolName);
    const email = normalizeString(payload.email).toLowerCase();
    const phone = normalizeString(payload.phone);
    const state = normalizeString(payload.state);
    const district = normalizeString(payload.district);
    const pincode = normalizeString(payload.pincode);
    const address = normalizeString(payload.address);
    const password = normalizeString(payload.password);

    const fieldErrors: Record<string, string> = {};

    if (!name) {
      fieldErrors.name = "Name is required.";
    }

    if (!organizationName) {
      fieldErrors.organizationName = "Organization name is required.";
    }

    if (!schoolName) {
      fieldErrors.schoolName = "School name is required.";
    }

    if (!emailPattern.test(email)) {
      fieldErrors.email = "Enter a valid email address.";
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

    if (password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters long.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          message: "Validation failed.",
          fieldErrors,
        },
        { status: 400 },
      );
    }

    const database = await getDatabase();

    try {
      await database.createCollection(COLLECTION_NAME);
    } catch (error) {
      const mongoError = error as { codeName?: string };

      if (mongoError.codeName !== "NamespaceExists") {
        throw error;
      }
    }

    const collection = database.collection<OrganizationDocument>(COLLECTION_NAME);
    const existingOrganization = await collection.findOne({ email });

    if (existingOrganization) {
      return NextResponse.json(
        {
          message: "An organization with this email already exists.",
          fieldErrors: {
            email: "This email is already registered.",
          },
        },
        { status: 409 },
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

    const organization: OrganizationDocument = {
      uid: randomUUID(),
      name,
      organizationName,
      email,
      schools: [school],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString().slice(0, 10),
      status: "active",
    };

    const result = await collection.insertOne(organization);

    return NextResponse.json(
      {
        message: "Organization created successfully.",
        organization: {
          _id: result.insertedId.toHexString(),
          ...organization,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create organization.";

    return NextResponse.json(
      {
        message,
      },
      { status: 500 },
    );
  }
}
