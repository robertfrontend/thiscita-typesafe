import { NextResponse } from "next/server";
import {
  analyzeProposalDocuments,
  extractProposalFile,
  ProposalDocumentError,
} from "../../lib/proposals.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const form = await request.formData();
    if (request.signal.aborted)
      return NextResponse.json(
        { error: "Analysis cancelled." },
        { status: 499 },
      );

    const baselineFile = form.get("document");
    const revisionFile = form.get("comparisonDocument");
    if (!(baselineFile instanceof File))
      return NextResponse.json(
        { error: "Choose a PDF, DOCX, or TXT proposal." },
        { status: 400 },
      );
    if (revisionFile !== null && !(revisionFile instanceof File))
      return NextResponse.json(
        { error: "The revised version must be a PDF, DOCX, or TXT proposal." },
        { status: 400 },
      );

    // Both files are extracted concurrently before the single TypeSafe request.
    const [baseline, revision] = await Promise.all([
      extractProposalFile(baselineFile, "The original proposal"),
      revisionFile
        ? extractProposalFile(revisionFile, "The revised proposal")
        : Promise.resolve(null),
    ]);
    if (request.signal.aborted)
      return NextResponse.json(
        { error: "Analysis cancelled." },
        { status: 499 },
      );

    return NextResponse.json(
      await analyzeProposalDocuments({
        baseline,
        revision,
        signal: request.signal,
        startedAt,
      }),
    );
  } catch (error) {
    if (request.signal.aborted)
      return NextResponse.json(
        { error: "Analysis cancelled." },
        { status: 499 },
      );
    if (error instanceof ProposalDocumentError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Proposal review failed", error);
    return NextResponse.json(
      { error: "The proposal could not be analyzed." },
      { status: 500 },
    );
  }
}
