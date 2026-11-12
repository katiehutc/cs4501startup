import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import ContactPage from "./page";
import { StoreProvider } from "@/lib/store";
import { CONTACTS, FIRMS } from "@/lib/mock-data";

const params = vi.hoisted(() => ({ id: "" }));

vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderContact(id: string) {
  params.id = id;
  render(
    <StoreProvider>
      <ContactPage />
    </StoreProvider>,
  );
}

describe("Contact page", () => {
  afterEach(() => cleanup());

  it("shows the contact's name and firm", () => {
    const contact = CONTACTS[0];
    const firm = FIRMS.find((f) => f.id === contact.firmId)!;
    renderContact(contact.id);
    expect(screen.getByRole("heading", { level: 1, name: contact.name })).toBeTruthy();
    expect(screen.getByText(new RegExp(firm.name))).toBeTruthy();
  });

  it("shows a not-found message with a way back for a bad id", () => {
    renderContact("does-not-exist");
    expect(screen.getByText("Contact not found")).toBeTruthy();
  });
});
