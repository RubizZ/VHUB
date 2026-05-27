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

    // Max file size: 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede pesar más de 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Must be an image." }, { status: 400 });
    }

    // Process image with sharp: resize and convert to webp
    const sharp = (await import("sharp")).default;
    const processedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Normalize filename to a clean ID + .webp
    const filename = `${playerId}/${createId()}.webp`;

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: filename,
        Body: processedBuffer,
        ContentType: "image/webp",
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
