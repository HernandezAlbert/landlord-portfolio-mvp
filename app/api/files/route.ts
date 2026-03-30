import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { decodeFileAccessUrlPath, getAllowedDocumentRoots, isPathWithinRoot } from "@/lib/document-storage";

function contentTypeForExtension(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".pdf": return "application/pdf";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".txt": return "text/plain; charset=utf-8";
    case ".csv": return "text/csv; charset=utf-8";
    default: return "application/octet-stream";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const absolutePath = decodeFileAccessUrlPath(url.searchParams.get("path"));
  if (!absolutePath) {
    return new NextResponse("Invalid file path.", { status: 400 });
  }

  const roots = await getAllowedDocumentRoots();
  if (!roots.some((root) => isPathWithinRoot(absolutePath, root))) {
    return new NextResponse("File path is not allowed.", { status: 403 });
  }

  try {
    const data = await fs.readFile(absolutePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForExtension(absolutePath),
        "Content-Disposition": `inline; filename="${path.basename(absolutePath).replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse("File not found.", { status: 404 });
  }
}
