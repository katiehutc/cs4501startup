
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import CapturePage from "./page";
import { extractFromNotes } from "@/lib/extract";

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
        accepted: ["new_contact", "follow_up"],
      }),
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
});
