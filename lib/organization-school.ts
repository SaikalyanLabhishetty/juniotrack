import type { Db } from "mongodb";

export type OrganizationSchool = {
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
    schools?: OrganizationSchool[];
    organizationName?: string;
    name?: string;
    phone?: string;
    state?: string;
    district?: string;
    pincode?: string;
    address?: string;
};

const ORGANIZATION_COLLECTION = "organization";

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function buildLegacySchool(organization: OrganizationDocument): OrganizationSchool | null {
    const schoolName =
        normalizeString(organization.organizationName) ||
        normalizeString(organization.name);
    const phone = normalizeString(organization.phone);
    const state = normalizeString(organization.state);
    const district = normalizeString(organization.district);
    const pincode = normalizeString(organization.pincode);
    const address = normalizeString(organization.address);

    if (!schoolName && !phone && !state && !district && !pincode && !address) {
        return null;
    }

    return {
        uid: normalizeString(organization.uid),
        schoolName,
        name: schoolName,
        phone,
        state,
        district,
        pincode,
        address,
    };
}

export async function getPrimaryOrganizationSchool(
    database: Db,
    organizationId: string,
): Promise<OrganizationSchool | null> {
    const organizations = database.collection<OrganizationDocument>(
        ORGANIZATION_COLLECTION,
    );
    const organization = await organizations.findOne(
        { uid: organizationId },
        {
            projection: {
                uid: 1,
                schools: 1,
                organizationName: 1,
                name: 1,
                phone: 1,
                state: 1,
                district: 1,
                pincode: 1,
                address: 1,
            },
        },
    );

    if (!organization) {
        return null;
    }

    const firstSchool = Array.isArray(organization.schools)
        ? organization.schools[0]
        : undefined;

    if (firstSchool) {
        const schoolName =
            normalizeString(firstSchool.schoolName) ||
            normalizeString(firstSchool.name);

        return {
            uid: normalizeString(firstSchool.uid) || normalizeString(organization.uid),
            schoolName,
            name: schoolName,
            phone: normalizeString(firstSchool.phone),
            state: normalizeString(firstSchool.state),
            district: normalizeString(firstSchool.district),
            pincode: normalizeString(firstSchool.pincode),
            address: normalizeString(firstSchool.address),
        };
    }

    return buildLegacySchool(organization);
}

export async function resolveSchoolId(
    database: Db,
    organizationId: string,
    tokenSchoolId?: string,
) {
    const normalizedTokenSchoolId = normalizeString(tokenSchoolId);

    if (normalizedTokenSchoolId) {
        return normalizedTokenSchoolId;
    }

    const school = await getPrimaryOrganizationSchool(database, organizationId);

    return school?.uid ?? "";
}

export function buildSchoolScopeQuery(schoolId: string): Record<string, unknown> {
    const normalizedSchoolId = normalizeString(schoolId);

    if (!normalizedSchoolId) {
        return {};
    }

    return {
        $or: [
            { schoolId: normalizedSchoolId },
            { schoolId: { $exists: false } },
            { schoolId: "" },
        ],
    };
}
