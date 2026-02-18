// @vitest-environment jsdom
import "../setup";

import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../../../repository_after/frontend/src/App";

describe("UI email validation", () => {
  it("blocks hold submission when email is missing @ or dot", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Create a book so Place hold works
    await user.type(screen.getByLabelText("Title"), "Book");
    await user.clear(screen.getByLabelText("Copies"));
    await user.type(screen.getByLabelText("Copies"), "1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    // Scope to Place a hold card to avoid ambiguity
    const placeHoldHeading = screen.getByRole("heading", {
      name: "Place a hold",
    });
    const placeHoldCard = placeHoldHeading.closest(".card")!;
    const holdEmailInput =
      within(placeHoldCard).getByPlaceholderText("alice@example.com");

    await user.type(holdEmailInput, "aliceexamplecom");
    await user.click(screen.getByRole("button", { name: "Place hold" }));

    expect(await screen.findByText(/Invalid email/i)).toBeInTheDocument();
  });
});
