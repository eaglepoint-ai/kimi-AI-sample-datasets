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

describe("UI refresh behavior", () => {
  it("updates queue after return assigns next eligible (alice frozen => bob fulfilled)", async () => {
    const user = userEvent.setup();
    render(<App />);

    const booksCard = getCardByHeading("Books");
    await user.type(within(booksCard).getByLabelText("Title"), "Book C");
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

    // Load Alice holds then freeze (row is found by book title, not email)
    const holdsCard = getCardByHeading("User holds");
    const userEmail = within(holdsCard).getByLabelText("Email");

    await user.clear(userEmail);
    await user.type(userEmail, "alice@example.com");
    await user.click(within(holdsCard).getByRole("button", { name: "Load" }));

    const holdsTable = within(holdsCard).getByRole("table");
    const aliceHoldRow = await within(holdsTable).findByRole("row", {
      name: /Book C/i,
    });

    await user.click(
      within(aliceHoldRow).getByRole("button", { name: "Freeze" }),
    );

    // Return copy
    await user.click(
      within(booksCard).getByRole("button", { name: "Return copy" }),
    );

    // Verify Bob fulfilled in queue
    const queueCard = getCardByHeading("Queue");
    const qTable = within(queueCard).getByRole("table");
    const bobRow = within(qTable).getByRole("row", {
      name: /bob@example\.com/i,
    });

    expect(within(bobRow).getByText("Yes")).toBeInTheDocument();
  });
});
