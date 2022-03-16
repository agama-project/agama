import React from "react";

import { screen } from "@testing-library/react";
import { authRender } from "./test-utils";

import InstallationProgress from "./InstallationProgress";

describe("InstallationProgress", () => {
  it("uses 'Installing' as title", async () => {
    authRender(<InstallationProgress />);

    await screen.findByText("Installing");
  });

  it("shows progress bars", async () => {
    authRender(<InstallationProgress />);

    await screen.findByLabelText("Main progress bar");
  });

  it("shows disabled 'Finish' action", async () => {
    authRender(<InstallationProgress />);

    const button = await screen.findByRole("button", { name: /Finish/i });
    expect(button).toHaveAttribute("disabled");
  });
});
