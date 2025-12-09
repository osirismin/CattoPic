import { NextResponse } from "next/server";

// Required for static export
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    apiUrl: process.env.API_URL || "",
    remotePatterns: process.env.NEXT_PUBLIC_REMOTE_PATTERNS || "",
  });
}
