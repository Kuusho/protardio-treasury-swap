import { NextRequest, NextResponse } from "next/server";

// Quotient Query ID from Scatter dashboard
// This query checks: Reputation Score ≥ 0.50 AND Protardio Account Follower
const QUOTIENT_QUERY_ID = "5ae959a8-4283-48a6-b881-02b3d21c75d0";

// Minimum score threshold (from Scatter criteria: ≥ 0.50)
const MIN_QUOTIENT_SCORE = 0.5;

async function checkEligibility(fid: number) {
  const url = `https://api.quotient.social/v1/allowlist/${QUOTIENT_QUERY_ID}/users/${fid}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn("Quotient API Error:", response.status, response.statusText, text);
    throw new Error(`Quotient API returned ${response.status}`);
  }

  const data = await response.json();
  console.log("Quotient API Success for FID", fid, ":", data);

  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json(
        { success: false, error: "Missing fid parameter" },
        { status: 400 }
      );
    }

    const data = await checkEligibility(fid);

    // Response from Quotient includes:
    // - eligible: boolean (already computed by Quotient based on query criteria)
    // - quotient_score: number
    // - meets_reputation_threshold: boolean
    // - conditions: array of criteria checks

    return NextResponse.json({
      success: true,
      quotientScore: data.quotient_score ?? 0,
      minScore: MIN_QUOTIENT_SCORE,
      isEligible: data.eligible ?? false,
      meetsReputationThreshold: data.meets_reputation_threshold ?? false,
      conditions: data.conditions ?? [],
      username: data.username,
      primaryEthAddress: data.primary_eth_address
    });
  } catch (error) {
    console.error("Error in Quotient API route:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET method to check a specific FID via query param
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get("fid");

  if (!fid) {
    return NextResponse.json(
      { success: false, error: "Missing fid parameter" },
      { status: 400 }
    );
  }

  try {
    const data = await checkEligibility(parseInt(fid));

    return NextResponse.json({
      success: true,
      quotientScore: data.quotient_score ?? 0,
      minScore: MIN_QUOTIENT_SCORE,
      isEligible: data.eligible ?? false,
      meetsReputationThreshold: data.meets_reputation_threshold ?? false,
      conditions: data.conditions ?? [],
      username: data.username,
      primaryEthAddress: data.primary_eth_address
    });
  } catch (error) {
    console.error("Error in Quotient API route:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
