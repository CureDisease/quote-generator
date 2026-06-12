import "server-only";

// Native image media types the Anthropic API accepts.
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export interface ParsedDoc {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  // Extracted plain text (docx, eml, msg, txt). Empty for media docs.
  text: string;
  // PDFs and images are handed to Claude natively rather than text-extracted.
  media?: { kind: "pdf" | "image"; base64: string; mediaType: string };
  // Non-fatal note surfaced to the estimator (e.g. unsupported legacy format).
  warning?: string;
}

function ext(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

function imageMediaType(mime: string, e: string): string {
  if (IMAGE_TYPES.has(mime)) return mime;
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  return "image/png";
}

async function parseDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value.trim();
}

async function parseEml(buf: Buffer): Promise<string> {
  const { simpleParser } = await import("mailparser");
  const mail = await simpleParser(buf);
  const header = [
    mail.subject ? `Subject: ${mail.subject}` : "",
    mail.from?.text ? `From: ${mail.from.text}` : "",
    mail.to
      ? `To: ${Array.isArray(mail.to) ? mail.to.map((t) => t.text).join(", ") : mail.to.text}`
      : "",
    mail.date ? `Date: ${mail.date.toISOString()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const body = (mail.text || mail.html || "").toString().trim();
  return [header, body].filter(Boolean).join("\n\n").trim();
}

async function parseMsg(buf: Buffer): Promise<string> {
  const { default: MsgReader } = await import("@kenjiuno/msgreader");
  // Copy into a plain ArrayBuffer (MsgReader rejects SharedArrayBuffer-backed views).
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  const reader = new MsgReader(ab);
  const data = reader.getFileData();
  const header = [
    data.subject ? `Subject: ${data.subject}` : "",
    data.senderName || data.senderEmail
      ? `From: ${[data.senderName, data.senderEmail].filter(Boolean).join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const body = (data.body || "").toString().trim();
  return [header, body].filter(Boolean).join("\n\n").trim();
}

/**
 * Turn an uploaded file into either extracted text or a Claude-native media
 * block. Never throws on a single bad file — parsing problems are surfaced via
 * `warning` so one unreadable upload doesn't sink the whole intake.
 */
export async function parseUploadedFile(file: File): Promise<ParsedDoc> {
  const filename = file.name || "upload";
  const e = ext(filename);
  const mime = file.type || "";
  const buf = Buffer.from(await file.arrayBuffer());
  const base: ParsedDoc = {
    filename,
    mimeType: mime || guessMime(e),
    sizeBytes: buf.byteLength,
    text: "",
  };

  try {
    if (mime === "application/pdf" || e === "pdf") {
      return {
        ...base,
        media: { kind: "pdf", base64: buf.toString("base64"), mediaType: "application/pdf" },
      };
    }
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(e)) {
      return {
        ...base,
        media: {
          kind: "image",
          base64: buf.toString("base64"),
          mediaType: imageMediaType(mime, e),
        },
      };
    }
    if (
      e === "docx" ||
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return { ...base, text: await parseDocx(buf) };
    }
    if (e === "eml" || mime === "message/rfc822") {
      return { ...base, text: await parseEml(buf) };
    }
    if (e === "msg" || mime === "application/vnd.ms-outlook") {
      return { ...base, text: await parseMsg(buf) };
    }
    if (["txt", "md", "csv", "rtf"].includes(e) || mime.startsWith("text/")) {
      return { ...base, text: buf.toString("utf8").trim() };
    }
    if (e === "doc") {
      return {
        ...base,
        warning:
          "Legacy .doc isn't supported — please re-save as .docx or PDF for full extraction.",
      };
    }
    return {
      ...base,
      warning: `Unsupported file type (.${e || "unknown"}) — skipped during extraction.`,
    };
  } catch (err) {
    return {
      ...base,
      warning: `Couldn't read ${filename}: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }
}

function guessMime(e: string): string {
  switch (e) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "eml":
      return "message/rfc822";
    case "msg":
      return "application/vnd.ms-outlook";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
