import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR, UPLOAD_PUBLIC_PREFIX } from "@/lib/ads";
import { requireAdminApi } from "@/lib/admin-guard";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

const EXT: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Magic-byte sniff so Content-Type spoofing cannot upload scripts as "images". */
function sniffImageType(buf: Buffer): keyof typeof EXT | null {
  if (buf.length >= 6) {
    const b0 = buf[0];
    const b1 = buf[1];
    const b2 = buf[2];
    // GIF87a / GIF89a
    if (
      b0 === 0x47 &&
      b1 === 0x49 &&
      b2 === 0x46 &&
      buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) &&
      buf[5] === 0x61
    ) {
      return "image/gif";
    }
  }
  // JPEG
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Only GIF, JPG, PNG, or WebP allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageType(buffer);
  if (!sniffed || sniffed !== file.type) {
    return NextResponse.json({ error: "File content is not a valid image" }, { status: 400 });
  }

  const slot = String(form.get("slot") ?? "banner").replace(/[^a-z0-9-]/gi, "");
  const ext = EXT[sniffed];
  const filename = `${slot}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const imageUrl = `${UPLOAD_PUBLIC_PREFIX}/${filename}`;
  return NextResponse.json(
    { imageUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
