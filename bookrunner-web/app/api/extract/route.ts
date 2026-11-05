
import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import { makePipelineDeps } from "@/lib/pipeline/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const note = body?.note;

    if (typeof note !== "string" || !note.trim()) {
      return NextResponse.json(
        { error: "Please provide some notes." },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const result = await runPipeline(
      note,
      today,
      makePipelineDeps()
    );

    return NextResponse.json(result);
  } catch (error) {
    // This is the important line for debugging!
    console.error("Extraction API failed:", error);

    return NextResponse.json(
      { error: "Unable to process notes right now" },
      { status: 500 }
    );
  }
}
