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
import { Button, DescriptionList } from "@patternfly/react-core";
import { plainRender } from "~/test-utils";
import SettingValue from "~/components/core/SettingValue";

const renderSetting = (props: React.ComponentProps<typeof SettingValue>) =>
  plainRender(
    <DescriptionList>
      <SettingValue {...props} />
    </DescriptionList>,
  );

describe("SettingValue", () => {
  it("reads as a term and what it is set to", () => {
    renderSetting({ term: "Encryption", value: "Disabled" });

    expect(screen.getByRole("term")).toHaveTextContent("Encryption");
    expect(screen.getByRole("definition")).toHaveTextContent("Disabled");
  });

  it("keeps a control given as the value operable", () => {
    renderSetting({ term: "Encryption", value: <Button variant="link">Disabled</Button> });

    expect(screen.getByRole("button", { name: "Disabled" })).toBeInTheDocument();
  });

  describe("with an explanation", () => {
    it("reads it after the value", () => {
      renderSetting({
        term: "Encryption",
        value: "Disabled",
        explanation: "The new system will not ask for a password to start.",
      });

      expect(screen.getByRole("definition")).toHaveTextContent(
        "DisabledThe new system will not ask for a password to start.",
      );
    });
  });

  describe("with a mark", () => {
    it("leaves the term to say what the setting is", () => {
      renderSetting({ term: "Encryption", value: "Disabled", icon: "lock" });

      expect(screen.getByRole("term")).toHaveTextContent(/^Encryption$/);
    });
  });
});
