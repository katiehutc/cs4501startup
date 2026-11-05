
import { NextResponse } from "next/server";
import { runPipeline } from "../../../lib/pipeline/run";
import { makePipelineDeps } from "../../../lib/pipeline/server";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request" },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("note" in body) ||
    typeof body.note !== "string" ||
    !body.note.trim()
  ) {
    return NextResponse.json(
      { error: "A non-empty note is required" },
      { status: 400 },
    );
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const deps = makePipelineDeps();

    const result = await runPipeline(body.note, today, deps);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Unable to process notes right now" },
      { status: 500 },
    );
  }
}
