import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Read the static banner image
    const imagePath = path.join(process.cwd(), 'public', 'assets', 'images', 'banner.jpg');
    const imageBuffer = await readFile(imagePath);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error serving OpenGraph image:', error);
    return new NextResponse('Image not found', { status: 404 });
  }
}