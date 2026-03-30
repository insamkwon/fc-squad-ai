import { NextRequest, NextResponse } from "next/server";

const NEXON_CDN_BASE =
  "https://fo4.dn.nexoncdn.co.kr/live/externalAssets/common";

/**
 * Proxy API for Nexon CDN player images.
 *
 * Fetches player face images from fo4.dn.nexoncdn.co.kr and streams
 * them to the client with aggressive caching.
 *
 * Uses SPID (season-specific player ID), not PID.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const spid = searchParams.get("spid");

  if (!spid || !/^\d+$/.test(spid)) {
    return NextResponse.json(
      { error: "Invalid or missing spid parameter" },
      { status: 400 },
    );
  }

  const imageUrl = `${NEXON_CDN_BASE}/players/p${spid}.png`;

  try {
    const res = await fetch(imageUrl);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status },
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    const cacheMaxAge = 60 * 60 * 24 * 7; // 7 days

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}, immutable`,
        "X-Image-Proxy": "true",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch player image" },
      { status: 502 },
    );
  }
}
