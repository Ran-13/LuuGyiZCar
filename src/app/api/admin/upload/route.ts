import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { UPLOAD_DIR, UPLOAD_PUBLIC_PREFIX } from "@/lib/ads";
import { requireAdminApi } from "@/lib/admin-guard";

export const runtime = "nodejs";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

/** Target max width for banner images — wider GIFs are scaled down. */
const MAX_WIDTH = 1920;

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

interface ParsedUpload {
  slot: string;
  mimeType: string;
  buffer: Buffer;
}

async function parseDirectUpload(request: Request): Promise<ParsedUpload> {
  if (!request.body) {
    throw new Error("Missing request body");
  }

  const slot = request.headers.get("x-upload-slot") ?? "banner";
  const mimeType = request.headers.get("x-upload-type") ?? request.headers.get("content-type") ?? "";

  if (!mimeType) {
    throw new Error("Missing upload content type");
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Missing file");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("File too large (max 100MB)");
  }

  return { slot, mimeType, buffer };
}

export async function POST(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let upload: ParsedUpload;
  try {
    upload = await parseDirectUpload(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid upload";
    const status = message.includes("too large") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  if (!ALLOWED.has(upload.mimeType)) {
    return NextResponse.json(
      { error: "Only GIF, JPG, PNG, or WebP allowed" },
      { status: 400 },
    );
  }

  const sniffed = sniffImageType(upload.buffer);
  if (!sniffed || sniffed !== upload.mimeType) {
    return NextResponse.json({ error: "File content is not a valid image" }, { status: 400 });
  }

  const slot = upload.slot.replace(/[^a-z0-9-]/gi, "");
  await mkdir(UPLOAD_DIR, { recursive: true });

  // ── Optimize the image for fast loading ────────────────────────────
  let optimized: Buffer;
  let ext: string;

  try {
    const img = sharp(upload.buffer, {
      // animated: true preserves all frames in GIFs / animated WebP
      animated: true,
      // Limit memory for very large animated GIFs
      limitInputPixels: 268402689, // ~16384 x 16384
    });

    const meta = await img.metadata();
    const isAnimated = (meta.pages ?? 1) > 1;

    if (isAnimated) {
      // Animated GIF/WebP → optimized animated WebP (typically 60-80% smaller)
      const pipeline = meta.width && meta.width > MAX_WIDTH
        ? img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : img;
      optimized = await pipeline
        .webp({ quality: 75, effort: 4, loop: meta.loop ?? 0 })
        .toBuffer();
      ext = "webp";
    } else if (sniffed === "image/gif" || sniffed === "image/png") {
      // Static GIF/PNG → WebP (much smaller, lossless-ish)
      const pipeline = meta.width && meta.width > MAX_WIDTH
        ? img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : img;
      optimized = await pipeline
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
      ext = "webp";
    } else if (sniffed === "image/jpeg") {
      // JPEG → optimized JPEG
      const pipeline = meta.width && meta.width > MAX_WIDTH
        ? img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : img;
      optimized = await pipeline
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      ext = "jpg";
    } else {
      // Already WebP — re-encode to ensure good compression
      const pipeline = meta.width && meta.width > MAX_WIDTH
        ? img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : img;
      optimized = await pipeline
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
      ext = "webp";
    }
  } catch {
    // If sharp fails (corrupt file, etc.), save the original
    optimized = upload.buffer;
    ext = EXT[sniffed];
  }

  const filename = `${slot}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), optimized);

  const sizeBefore = (upload.buffer.length / 1024).toFixed(0);
  const sizeAfter = (optimized.length / 1024).toFixed(0);

  const imageUrl = `${UPLOAD_PUBLIC_PREFIX}/${filename}`;
  return NextResponse.json(
    { imageUrl, optimized: { before: `${sizeBefore}KB`, after: `${sizeAfter}KB` } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
