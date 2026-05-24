import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { s3Client, S3_BUCKET_NAME, getS3PublicUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createId } from "@paralleldrive/cuid2";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.playerId) {
    return NextResponse.json({ error: "Unauthorized or no player linked" }, { status: 401 });
  }

  const playerId = session.user.playerId;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Must be an image." }, { status: 400 });
    }

    // Sanitize filename to avoid S3 path issues
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filename = `${playerId}/${createId()}-${sanitizedName}`;

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const publicUrl = getS3PublicUrl(filename);

    // Update Player and User in DB
    await db.player.update({
      where: { id: playerId },
      data: { 
        image: publicUrl,
        user: {
            update: {
                image: publicUrl
            }
        }
      },
    });

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (err) {
    console.error("[POST /api/players/me/avatar] Upload Error:", err);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}
