import React from "react";

import { screen } from "@testing-library/react";
import { authRender } from "./test-utils";

import ProgressReport from "./ProgressReport";

describe("ProbingProgress", () => {
  // TODO: complete testing where the substep bar must be shown

  it("shows progress bars", async () => {
    authRender(<ProgressReport />);

    await screen.findByLabelText("Main progress bar");
  });
});
