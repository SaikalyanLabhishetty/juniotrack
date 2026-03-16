import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type UserDocument = {
    uid: string;
    role: "teacher" | "parent";
    organizationId: string;
    status: "active" | "inactive";
};

type ClassDocument = {
    uid: string;
    className: string;
    section: string;
    organizationId: string;
};

export async function GET(request: NextRequest) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const database = await getDatabase();
        const usersCollection = database.collection<UserDocument>("users");
        const classesCollection = database.collection<ClassDocument>("classes");
        const studentsCollection = database.collection("students");

        // Execute queries concurrently
        const [
            totalTeachers,
            totalParents,
            totalStudents,
            classesData,
            studentsByClassDist
        ] = await Promise.all([
            // 1. Total active teachers
            usersCollection.countDocuments({
                organizationId: tokenPayload.uid,
                role: "teacher",
                status: "active"
            }),
            // 2. Total active parents
            usersCollection.countDocuments({
                organizationId: tokenPayload.uid,
                role: "parent",
                status: "active"
            }),
            // 3. Total students
            studentsCollection.countDocuments({
                organizationId: tokenPayload.uid,
            }),
            // 4. Fetch all classes for the org
            classesCollection.find({
                organizationId: tokenPayload.uid,
            }).toArray(),
            // 5. Aggregate student count by class
            studentsCollection.aggregate([
                { $match: { organizationId: tokenPayload.uid } },
                { $group: { _id: "$classId", count: { $sum: 1 } } }
            ]).toArray()
        ]);

        // Map the aggregate data back to readable class names
        const classMap = new Map(
            classesData.map((c) => [c.uid, `${c.className} ${c.section}`])
        );

        const studentsByClass = studentsByClassDist.map((item) => ({
            className: classMap.get(item._id) || "Unknown Class",
            count: item.count
        })).sort((a, b) => a.className.localeCompare(b.className));

        return NextResponse.json({
            stats: {
                totalTeachers,
                totalParents,
                totalStudents,
                studentsByClass
            }
        });

    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch dashboard stats.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
