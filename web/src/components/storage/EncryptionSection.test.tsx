/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import EncryptionSection from "./EncryptionSection";
import { STORAGE } from "~/routes/paths";

const mockUseConfigModel = jest.fn();
jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockUseConfigModel(),
}));

describe("EncryptionSection", () => {
  describe("if encryption is enabled", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue({
        encryption: {
          method: "luks2",
          password: "12345",
        },
      });
    });

    it("renders encryption as enabled", () => {
      installerRender(<EncryptionSection />);
      screen.getByText(/is enabled/);
    });

    describe("and uses TPM", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          encryption: {
            method: "tpmFde",
            password: "12345",
          },
        });
      });

      it("renders encryption as TPM enabled", () => {
        installerRender(<EncryptionSection />);
        screen.getByText(/using TPM/);
      });
    });
  });

  describe("if encryption is disabled", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue({});
    });

    it("renders encryption as disabled", () => {
      installerRender(<EncryptionSection />);
      screen.getByText(/is disabled/);
    });
  });

  it("renders a link for navigating to encryption settings", () => {
    installerRender(<EncryptionSection />);
    const editLink = screen.getByRole("link", { name: "Change" });
    expect(editLink).toHaveAttribute("href", STORAGE.editEncryption);
  });
});
