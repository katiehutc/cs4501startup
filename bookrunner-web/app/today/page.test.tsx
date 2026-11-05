import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import TodayPage from "./page";
import { TODAY, addDays } from "@/lib/dates";
import type { Task } from "@/lib/types";

const mockDispatch = vi.fn();

const mockState = {
  contacts: [],
  firms: [],
  drafts: [],
  tasks: [] as Task[],
};

vi.mock("@/lib/store", () => ({
  useStore: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  mockDispatch.mockClear();
});

describe("#50 Today page", () => {
  it("[ai] groups saved tasks into Overdue, Today, and This week", () => {
    mockState.tasks = [
      {
        id: "overdue",
        contactId: "alex",
        kind: "thank_you",
        due: addDays(TODAY, -2),
        label: "Thank-you to Alex",
      },
      {
        id: "today",
        contactId: "alex",
        kind: "follow_up",
        due: TODAY,
        label: "Follow up with Alex",
      },
      {
        id: "week",
        contactId: "alex",
        kind: "reach_out",
        due: addDays(TODAY, 3),
        label: "Reach out to Alex",
      },
    ];

    render(<TodayPage />);

    expect(
      within(screen.getByRole("region", { name: "Overdue" }))
        .getByText("Thank-you to Alex")
    ).toBeTruthy();

    expect(
      within(screen.getByRole("region", { name: "Today" }))
        .getByText("Follow up with Alex")
    ).toBeTruthy();

    expect(
      within(screen.getByRole("region", { name: "This week" }))
        .getByText("Reach out to Alex")
    ).toBeTruthy();
  });

  it("[ai] shows how many days late an overdue thank-you is", () => {
    mockState.tasks = [
      {
        id: "late-task",
        contactId: "alex",
        kind: "thank_you",
        due: addDays(TODAY, -3),
        label: "Thank-you to Alex",
      },
    ];

    render(<TodayPage />);

    expect(screen.getByText(/3 days late/)).toBeTruthy();
  });

  it("[ai] dispatches task completion when Done is clicked", () => {
    mockState.tasks = [
      {
        id: "task-1",
        contactId: "alex",
        kind: "thank_you",
        due: TODAY,
        label: "Thank-you to Alex",
      },
    ];

    render(<TodayPage />);

    screen.getByRole("button", { name: /mark.*done/i }).click();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "complete_task",
      id: "task-1",
    });
  });
});