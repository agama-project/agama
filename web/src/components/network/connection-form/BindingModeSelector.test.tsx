/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import BindingModeSelector from "./BindingModeSelector";

function TestForm() {
  const form = useAppForm({ ...defaultOptions });
  return <BindingModeSelector form={form} />;
}

describe("BindingModeSelector", () => {
  it("shows all options with their descriptions", async () => {
    const { user } = installerRender(<TestForm />);
    await user.click(screen.getByLabelText("Device binding"));
    screen.getByRole("option", { name: /^None.*all devices/ });
    screen.getByRole("option", { name: /^Chosen by name.*name in the system/ });
    screen.getByRole("option", { name: /^Chosen by MAC address.*physical address/ });
  });
});
