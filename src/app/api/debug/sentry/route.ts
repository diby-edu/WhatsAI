import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
    console.log("Creation of a test error for Sentry...");
    throw new Error("🚨 TEST SENTRY: Ceci est une erreur de test depuis le VPS WhatsAI");
}
