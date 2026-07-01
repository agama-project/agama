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

import { _ } from "~/i18n";
import { useFieldLabel } from "~/hooks/use-field-label";

describe("useFieldLabel", () => {
  it("derives the label id from the field name", () => {
    expect(useFieldLabel("hostnameMode").labelId).toBe("hostnameMode-label");
  });

  describe("with no options", () => {
    it("sets no aria attributes, leaving FormGroup to associate the label", () => {
      const { labelProps } = useFieldLabel("hostnameMode");
      expect(labelProps["aria-label"]).toBeUndefined();
      expect(labelProps["aria-labelledby"]).toBeUndefined();
    });
  });

  describe("with labelPrefixedBy", () => {
    it("prepends the given ids before the field's own label id", () => {
      const { labelProps } = useFieldLabel("mode", { labelPrefixedBy: "hostname-legend" });
      expect(labelProps["aria-labelledby"]).toBe("hostname-legend mode-label");
    });

    it("keeps the order of multiple space-separated ids", () => {
      const { labelProps } = useFieldLabel("password", {
        labelPrefixedBy: "auth-section root-legend",
      });
      expect(labelProps["aria-labelledby"]).toBe("auth-section root-legend password-label");
    });
  });

  describe("with aria-labelledby", () => {
    it("uses it as-is, replacing the field's own label", () => {
      const { labelProps } = useFieldLabel("size", { "aria-labelledby": "name unit" });
      expect(labelProps["aria-labelledby"]).toBe("name unit");
    });

    it("takes precedence over labelPrefixedBy", () => {
      const { labelProps } = useFieldLabel("size", {
        "aria-labelledby": "name unit",
        labelPrefixedBy: "ignored-legend",
      });
      expect(labelProps["aria-labelledby"]).toBe("name unit");
    });
  });

  describe("with aria-label", () => {
    it("passes the literal name through", () => {
      const { labelProps } = useFieldLabel("search", { "aria-label": _("Filter the list") });
      expect(labelProps["aria-label"]).toBe("Filter the list");
    });
  });
});
