// @vitest-environment jsdom
import "../setup";

import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../../../repository_after/frontend/src/App";
import { getState } from "../msw/state";

function getCardByHeading(name: string) {
  const heading = screen.getByRole("heading", { name });
  return heading.closest(".card")!;
}

describe("UI real-time available copies updates", () => {
  it("auto-refresh updates available copies after out-of-band state change", async () => {
    const user = userEvent.setup();
    render(<App />);

    const booksCard = getCardByHeading("Books");

    await user.type(within(booksCard).getByLabelText("Title"), "Realtime Book");
    await user.clear(within(booksCard).getByLabelText("Copies"));
    await user.type(within(booksCard).getByLabelText("Copies"), "1");
    await user.click(within(booksCard).getByRole("button", { name: "Create" }));
    await within(booksCard).findByText(/Created book/i);

    // Faster polling interval for test stability.
    await user.selectOptions(screen.getByDisplayValue("2.5s"), "1500");

    // Confirm initial available copies shown as 1.
    const initialRow = within(booksCard)
      .getAllByRole("row")
      .find((r) => within(r).queryByText("Realtime Book"));
    expect(initialRow).toBeTruthy();
    const initialCells = within(initialRow!).getAllByRole("cell");
    expect(initialCells[3]).toHaveTextContent("1");

    // Simulate external backend update (e.g., another client operation).
    const state = getState();
    const book = state.books.find((b) => b.title === "Realtime Book");
    if (!book) throw new Error("Book not found in mocked backend state");
    book.copiesAvailable = 0;

    await waitFor(
      () => {
        const updatedRow = within(booksCard)
          .getAllByRole("row")
          .find((r) => within(r).queryByText("Realtime Book"));
        if (!updatedRow) throw new Error("Updated row not found");
        const updatedCells = within(updatedRow).getAllByRole("cell");
        expect(updatedCells[3]).toHaveTextContent("0");
      },
      { timeout: 5000 },
    );
  });
});
