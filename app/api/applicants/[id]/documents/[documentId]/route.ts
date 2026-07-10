import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2ObjectReadUrl } from "@/lib/r2-storage";

function contentTypeForDocument(filePath: string, contentType?: string | null) {
  if (contentType) return contentType;

  switch (path.extname(filePath).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".csv":
      return "text/csv; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const { id, documentId } = await context.params;
  const document = await prisma.applicantDocument.findFirst({
    where: {
      id: documentId,
      applicantId: id,
      applicant: {
        userId: sessionUser.id,
      },
    },
  });

  if (!document) {
    return new NextResponse("Document not found.", { status: 404 });
  }

  if (document.storageProvider === "r2") {
    if (!document.storageKey) {
      return new NextResponse("Document storage key is missing.", { status: 404 });
    }

    const signedUrl = await getR2ObjectReadUrl(document.storageKey);
    return NextResponse.redirect(signedUrl, 302);
  }

  if (!document.absolutePath) {
    return new NextResponse("Document path is missing.", { status: 404 });
  }

  try {
    const data = await fs.readFile(document.absolutePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForDocument(document.absolutePath, document.contentType),
        "Content-Disposition": `inline; filename="${document.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("File not found.", { status: 404 });
  }
}
