// @vitest-environment jsdom
import "../setup";

import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../../../repository_after/frontend/src/App";

function getCardByHeading(name: string) {
  const heading = screen.getByRole("heading", { name });
  return heading.closest(".card")!;
}

describe("UI core flows", () => {
  it("lets user place holds and see queue ordered by position", async () => {
    const user = userEvent.setup();
    render(<App />);

    const booksCard = getCardByHeading("Books");
    await user.type(within(booksCard).getByLabelText("Title"), "Book A");
    await user.clear(within(booksCard).getByLabelText("Copies"));
    await user.type(within(booksCard).getByLabelText("Copies"), "1");
    await user.click(within(booksCard).getByRole("button", { name: "Create" }));
    await within(booksCard).findByText(/Created book/i);

    const holdCard = getCardByHeading("Place a hold");
    const holdEmail = within(holdCard).getByLabelText("Email");

    await user.type(holdEmail, "alice@example.com");
    await user.click(
      within(holdCard).getByRole("button", { name: "Place hold" }),
    );
    await screen.findByText(/Placed hold/i);

    await user.clear(holdEmail);
    await user.type(holdEmail, "bob@example.com");
    await user.click(
      within(holdCard).getByRole("button", { name: "Place hold" }),
    );
    await screen.findByText(/Placed hold/i);

    const queueCard = getCardByHeading("Queue");
    const qTable = within(queueCard).getByRole("table");

    // Find rows by email (Queue has an Email column)
    const aliceRow = within(qTable).getByRole("row", {
      name: /alice@example\.com/i,
    });
    const bobRow = within(qTable).getByRole("row", {
      name: /bob@example\.com/i,
    });

    // Avoid ambiguous "1" vs holdId "1": use the first cell (position column)
    const aliceCells = within(aliceRow).getAllByRole("cell");
    expect(aliceCells[0]).toHaveTextContent("1");

    const bobCells = within(bobRow).getAllByRole("cell");
    expect(bobCells[0]).toHaveTextContent("2");
  });

  it("freeze/unfreeze controls appear after loading holds (row located by book title)", async () => {
    const user = userEvent.setup();
    render(<App />);

    const booksCard = getCardByHeading("Books");
    await user.type(within(booksCard).getByLabelText("Title"), "Book B");
    await user.clear(within(booksCard).getByLabelText("Copies"));
    await user.type(within(booksCard).getByLabelText("Copies"), "1");
    await user.click(within(booksCard).getByRole("button", { name: "Create" }));
    await within(booksCard).findByText(/Created book/i);

    const holdCard = getCardByHeading("Place a hold");
    await user.type(
      within(holdCard).getByLabelText("Email"),
      "alice@example.com",
    );
    await user.click(
      within(holdCard).getByRole("button", { name: "Place hold" }),
    );
    await screen.findByText(/Placed hold/i);

    const holdsCard = getCardByHeading("User holds");
    const userEmail = within(holdsCard).getByLabelText("Email");

    await user.clear(userEmail);
    await user.type(userEmail, "alice@example.com");
    await user.click(within(holdsCard).getByRole("button", { name: "Load" }));

    const table = within(holdsCard).getByRole("table");

    // User holds table does NOT show email, so locate row by book title text in first column
    const row = await within(table).findByRole("row", { name: /Book B/i });

    const freezeBtn = within(row).getByRole("button", { name: "Freeze" });
    const unfreezeBtn = within(row).getByRole("button", { name: "Unfreeze" });

    expect(freezeBtn).toBeEnabled();
    expect(unfreezeBtn).toBeDisabled();

    await user.click(freezeBtn);
    expect(within(row).getByRole("button", { name: "Unfreeze" })).toBeEnabled();
  });
});
