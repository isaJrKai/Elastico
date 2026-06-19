import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const filePath = join(process.cwd(), "public", "ELASTICO-Source-Code-FINAL.zip");
  const buffer = readFileSync(filePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="ELASTICO-Source-Code-FINAL.zip"',
      "Content-Length": buffer.length.toString(),
    },
  });
}