
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import CapturePage from "./page";
import { extractFromNotes } from "@/lib/extract";
import { toCaptureResult } from "@/lib/pipeline/capture-adapter";

const dispatch = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/store", () => ({
  useStore: () => ({ dispatch }),
}));

vi.mock("@/lib/extract", () => ({
  SAMPLE_NOTE: "talked w/ Chris, 1st yr analyst GS FIG NY",
  extractFromNotes: vi.fn(),
}));

const mockExtract = vi.mocked(extractFromNotes);

const proposals = [
  { id: "p-contact", kind: "new_contact" as const, title: "Chris · Analyst" },
  { id: "p-lead", kind: "new_lead" as const, title: "Dana · Associate" },
  { id: "p-follow", kind: "follow_up" as const, title: "Follow up with Chris" },
];


function result() {
  return {
    questions: [],
    proposals,
    extraction: {
      contact: {
        name: "Chris",
        title: "Analyst",
        firmText: "Goldman Sachs",
        group: "FIG",
        city: "New York",
      },
      chatDate: "2026-11-04",
      referrals: [
        {
          name: "Dana",
          title: "Associate",
          firmText: "Goldman Sachs",
          group: "FIG",
          city: "New York",
        },
      ],
      followUp: {
        afterDays: 21,
        reason: "Follow up in three weeks",
      },
      evidence: {},
    },
  };
}


async function extractNote() {
  fireEvent.change(screen.getByLabelText("What happened?"), {
    target: { value: "Coffee chat with Chris" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sort it out" }));
  await screen.findByText("Chris · Analyst");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("#49 Capture page", () => {
  it("[ai] lists every proposal with a checked checkbox", async () => {
    mockExtract.mockResolvedValue(result());
    render(<CapturePage />);

    await extractNote();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true);
  });

  it("[ai] saves only checked proposal kinds", async () => {
    mockExtract.mockResolvedValue(result());
    render(<CapturePage />);

    await extractNote();

    fireEvent.click(screen.getByRole("checkbox", { name: /Dana/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save 2 updates" }));

    
    expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
            type: "apply_extraction",
            firmId: "gs",
            accepted: ["new_contact", "follow_up"],
            acceptedIds: ["p-contact", "p-follow"],
        })
    );
  });

  it("[ai] shows validation attempts and corrected errors", async () => {
    mockExtract.mockResolvedValue({
      ...result(),
      attempts: 2,
      trace: [[{
        code: "firm_unknown",
        field: "contact.firmText",
        message: "Unknown firm",
      }]],
    } as Awaited<ReturnType<typeof extractFromNotes>>);

    render(<CapturePage />);
    await extractNote();

    expect(screen.getByText(/Checked in 2 attempts/i)).toBeTruthy();
    expect(screen.getByText(/Unknown firm/i)).toBeTruthy();
  });

  it("[ai] resubmits a selected answer to an ambiguous firm question", async () => {
    mockExtract
      .mockResolvedValueOnce({
        questions: [{
          id: "firm",
          prompt: 'Is "GS" Goldman Sachs or Guggenheim Securities?',
          options: [
            { label: "Goldman Sachs", value: "gs" },
            { label: "Guggenheim", value: "gugg" },
          ],
        }],
        proposals: [],
      })
      .mockResolvedValueOnce(result());

    render(<CapturePage />);

    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "Coffee chat with Chris at GS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sort it out" }));

    await screen.findByRole("button", { name: "Goldman Sachs" });
    fireEvent.click(screen.getByRole("button", { name: "Goldman Sachs" }));

    await waitFor(() => {
      expect(mockExtract).toHaveBeenCalledTimes(2);
    });

    expect(mockExtract.mock.calls[1][0]).toContain("Goldman Sachs");
  });

  it("[ai] saves the student's firm answer with the note, so the draft's evidence check passes later", async () => {
    mockExtract
      .mockResolvedValueOnce({
        questions: [{
          id: "firm",
          prompt: 'Is "GS" Goldman Sachs or Guggenheim Securities?',
          options: [
            { label: "Goldman Sachs", value: "Goldman Sachs" },
            { label: "Guggenheim", value: "Guggenheim Securities" },
          ],
        }],
        proposals: [],
      })
      .mockResolvedValueOnce(result());

    render(<CapturePage />);

    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "Coffee chat with Chris at GS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sort it out" }));
    fireEvent.click(await screen.findByRole("button", { name: "Goldman Sachs" }));
    await screen.findByText("Chris · Analyst");
    fireEvent.click(screen.getByRole("button", { name: "Save 3 updates" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Coffee chat with Chris at GS\nFirm: Goldman Sachs" }),
    );
  });

  it("[ai] saves the note as typed when no firm question was asked", async () => {
    mockExtract.mockResolvedValue(result());
    render(<CapturePage />);
    await extractNote();
    fireEvent.click(screen.getByRole("button", { name: "Save 3 updates" }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ note: "Coffee chat with Chris" }));
  });

  it("[ai] preserves notes and offers Try again after failure", async () => {
    mockExtract.mockRejectedValueOnce(new Error("Extraction failed"))
      .mockResolvedValueOnce(result());

    render(<CapturePage />);

    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "Coffee chat with Chris" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sort it out" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Extraction failed",
    );

    expect((screen.getByLabelText("What happened?") as HTMLTextAreaElement).value)
      .toBe("Coffee chat with Chris");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByText("Chris · Analyst");
    expect(mockExtract).toHaveBeenCalledTimes(2);
  });


it("[ai] saves only approved proposals from the real pipeline adapter", async () => {
  const pipelineResult = toCaptureResult({
    kind: "ok",
    extraction: {
      contact: {
        name: "Chris",
        title: "Analyst",
        firmText: "Goldman Sachs",
        group: "FIG",
        city: "New York",
      },
      chatDate: "2026-11-04",
      referrals: [
        {
          name: "Dana",
          title: "Associate",
          firmText: "Goldman Sachs",
          group: "FIG",
          city: "New York",
        },
      ],
      followUp: {
        afterDays: 21,
        reason: "Follow up in three weeks",
      },
      evidence: {},
    },
    draft: {
      contactId: "temporary",
      greetingName: "Chris",
      paragraphs: ["Thanks for chatting."],
      claims: [],
      signoff: "Best,",
      removed: [],
    },
    attempts: 1,
    trace: [],
  });

  mockExtract.mockResolvedValue(pipelineResult);
  render(<CapturePage />);

  fireEvent.change(screen.getByLabelText("What happened?"), {
    target: { value: "Coffee chat with Chris" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sort it out" }));

  await screen.findByText("Add referral: Dana");

  fireEvent.click(screen.getByRole("checkbox", { name: /Dana/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Draft thank-you/ }));

  fireEvent.click(screen.getByRole("button", { name: "Save 3 updates" }));

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "apply_extraction",
      firmId: "gs",
      accepted: ["new_contact", "log_chat", "follow_up"],
      acceptedIds: ["contact", "chat", "follow-up"],
    })
  );
});

});

describe("Capture note length", () => {
  afterEach(() => cleanup());

  it("[ai] stops typing past the limit, leaving room for the firm answer the page appends", async () => {
    const { MAX_NOTE_CHARS, NOTE_INPUT_MAX_CHARS } = await import("@/lib/limits");
    render(<CapturePage />);
    const box = screen.getByLabelText("What happened?");
    expect(box).toHaveProperty("maxLength", NOTE_INPUT_MAX_CHARS);
    expect(NOTE_INPUT_MAX_CHARS).toBeLessThan(MAX_NOTE_CHARS);
  });
});
