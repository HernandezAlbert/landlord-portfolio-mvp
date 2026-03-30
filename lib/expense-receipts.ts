import { unlink, writeFile } from "fs/promises";
import path from "path";
import { buildFileAccessUrl, ensureDirectoryExists, getDocumentStoragePath } from "@/lib/document-storage";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "receipt";
}

function legacyExpenseReceiptPath(receiptPath?: string | null) {
  if (!receiptPath?.startsWith("/uploads/expense-receipts/")) return null;
  return path.join(process.cwd(), "public", receiptPath.replace(/^\/+/, ""));
}

export async function saveExpenseReceipt(file: File | null | undefined) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) return null;

  const uploadDir = await getDocumentStoragePath("EXPENSE_RECEIPTS_DIR");
  await ensureDirectoryExists(uploadDir);
  const ext = path.extname(file.name || "") || ".bin";
  const base = path.basename(file.name || "receipt", ext);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName(base)}${ext}`;
  const absolutePath = path.join(uploadDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    receiptPath: buildFileAccessUrl(absolutePath),
    receiptStoragePath: absolutePath,
    receiptOriginalName: file.name || filename,
  };
}

export async function deleteExpenseReceiptByPath(receiptPath?: string | null, receiptStoragePath?: string | null) {
  const absolutePath = receiptStoragePath || legacyExpenseReceiptPath(receiptPath);
  if (!absolutePath) return;
  try {
    await unlink(absolutePath);
  } catch {
    // ignore missing files
  }
}
