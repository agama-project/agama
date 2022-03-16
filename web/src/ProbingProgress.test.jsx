import React from "react";

import { screen } from "@testing-library/react";
import { authRender } from "./test-utils";

import ProbingProgress from "./ProbingProgress";

describe("ProbingProgress", () => {
  it("uses 'Probing' as title", async () => {
    authRender(<ProbingProgress />);

    await screen.findByText("Probing");
  });

  it("shows progress bars", async () => {
    authRender(<ProbingProgress />);

    await screen.findByLabelText("Main progress bar");
  });

  it("does not show actions", async () => {
    authRender(<ProbingProgress />);

    const button = screen.queryByRole("navigation", { name: /Installer Actions/i });
    expect(button).toBeNull();
  });
});
