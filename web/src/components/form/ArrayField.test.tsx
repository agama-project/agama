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
import { parsePasteEntries } from "~/components/form/ArrayField";

type TestFormProps = {
  defaultValues?: string[];
  validateOnChange?: (v: string) => string | undefined;
  validateOnSubmit?: (v: string) => string | undefined;
  skipDuplicates?: boolean;
  helperText?: string;
  /** Simulates a TanStack Form field-level error returned by onSubmitAsync. */
  fieldError?: string;
  splitPasteOn?: RegExp | string;
  maxEntryWidth?: number;
};

function TestForm({
  defaultValues = [],
  validateOnChange,
  validateOnSubmit,
  skipDuplicates = false,
  helperText,
  fieldError,
  splitPasteOn,
  maxEntryWidth,
}: TestFormProps) {
  const form = useAppForm({
    defaultValues: { tags: defaultValues },
    validators: {
      onSubmitAsync: fieldError ? async () => ({ fields: { tags: fieldError } }) : undefined,
    },
  });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.AppField name="tags">
          {(field) => (
            <field.ArrayField
              label="Tags"
              validateOnChange={validateOnChange}
              validateOnSubmit={validateOnSubmit}
              skipDuplicates={skipDuplicates}
              helperText={helperText}
              splitPasteOn={splitPasteOn}
              maxEntryWidth={maxEntryWidth}
            />
          )}
        </form.AppField>
        <button type="submit">Submit</button>
        <button type="button">Other</button>
      </form>
    </form.AppForm>
  );
}

describe("ArrayField", () => {
  it("renders label", () => {
    installerRender(<TestForm />);
    screen.getByText("Tags");
  });

  it("always provides screen reader instructions via aria-describedby", () => {
    installerRender(<TestForm />);
    const input = screen.getByRole("textbox", { name: "Tags" });
    const instructions = screen.getByText(/Escape to exit/);
    const instructionsId = instructions.closest("[id]")?.id;
    expect(input.getAttribute("aria-describedby")).toContain(instructionsId);
  });

  it("does not show sighted instructions on empty field", () => {
    installerRender(<TestForm />);
    expect(
      screen.queryByText("Enter or Tab to add", { selector: ":not([class*='screenReader'])" }),
    ).not.toBeInTheDocument();
  });

  it("shows sighted instructions when field has draft content", async () => {
    const { user } = installerRender(<TestForm />);
    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.type(input, "a");
    screen.getByText("Enter or Tab to add");
  });

  it("shows sighted instructions when field has entries", () => {
    installerRender(<TestForm defaultValues={["alpha"]} />);
    screen.getByText("Enter or Tab to add, Backspace or Delete to remove, arrow keys to navigate");
  });

  it("renders given existing values", () => {
    installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
    screen.getByText("alpha");
    screen.getByText("beta");
  });

  describe("adding entries", () => {
    it("adds a value on Enter", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(screen.getByRole("textbox", { name: "Tags" }), "gamma");
      await user.keyboard("{Enter}");
      screen.getByText("gamma");
    });

    it("adds a value on Tab", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(screen.getByRole("textbox", { name: "Tags" }), "delta");
      await user.tab();
      screen.getByText("delta");
    });

    it("commits the draft on blur", async () => {
      const { user } = installerRender(<TestForm />);
      await user.type(screen.getByRole("textbox", { name: "Tags" }), "epsilon");
      await user.click(screen.getByRole("button", { name: "Other" }));
      screen.getByText("epsilon");
    });

    it("does not commit an empty draft on blur", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.click(screen.getByRole("button", { name: "Other" }));
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });
  });

  describe("removing entries", () => {
    it("removes a value via the entry removal button", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("button", { name: "Remove alpha" }));
      expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    });
  });

  describe("editing entries", () => {
    it("moves an entry to the draft input when clicked", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      const input = screen.getByRole("textbox", { name: "Tags" });
      await user.click(screen.getByRole("option", { name: "alpha" }));
      expect(screen.queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();
      expect(input).toHaveValue("alpha");
    });

    it("puts the active entry back in the input on Enter", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      const input = screen.getByRole("textbox", { name: "Tags" });
      await user.click(input);
      await user.keyboard("{ArrowLeft}{Enter}");
      expect(screen.queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();
      expect(input).toHaveValue("alpha");
    });

    it("puts the active entry back in the input on Space", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      const input = screen.getByRole("textbox", { name: "Tags" });
      await user.click(input);
      await user.keyboard("{ArrowLeft}");
      await user.keyboard(" ");
      expect(screen.queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();
      expect(input).toHaveValue("alpha");
    });
  });

  describe("validateOnChange", () => {
    const validateOnChange = (v: string) =>
      v.startsWith("x") ? "Must not start with x" : undefined;

    it("marks an invalid entry immediately after adding", () => {
      installerRender(<TestForm defaultValues={["xbad"]} validateOnChange={validateOnChange} />);
      expect(screen.getByRole("option", { name: /invalid/ })).toBeInTheDocument();
    });

    it("shows the error block when there are invalid entries", () => {
      installerRender(<TestForm defaultValues={["xbad"]} validateOnChange={validateOnChange} />);
      screen.getByText(/Select entries to edit or remove them/);
    });

    it("removes all invalid entries when clicking the clear button", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={["ok", "xbad"]} validateOnChange={validateOnChange} />,
      );
      await user.click(screen.getByRole("button", { name: /remove all invalid entries/i }));
      screen.getByText("ok");
      expect(screen.queryByText("xbad")).not.toBeInTheDocument();
    });

    it("opens an invalid entry for editing on Delete instead of removing it", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={["xbad"]} validateOnChange={validateOnChange} />,
      );
      const input = screen.getByRole("textbox", { name: "Tags" });
      await user.click(input);
      await user.keyboard("{ArrowLeft}{Delete}");
      expect(screen.queryByRole("option", { name: "xbad" })).not.toBeInTheDocument();
      expect(input).toHaveValue("xbad");
    });
  });

  describe("validateOnSubmit", () => {
    const validateOnSubmit = (v: string) =>
      v.startsWith("x") ? "Must not start with x" : undefined;

    it("does not mark entries as invalid before submitting", () => {
      installerRender(<TestForm defaultValues={["xbad"]} validateOnSubmit={validateOnSubmit} />);
      expect(screen.queryByRole("option", { name: /invalid/ })).not.toBeInTheDocument();
    });

    it("marks entries as invalid after a failed submit", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={["xbad"]}
          validateOnSubmit={validateOnSubmit}
          fieldError="Some entries are not valid"
        />,
      );
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByRole("option", { name: /invalid/ });
    });

    it("shows the error block after a failed submit", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={["xbad"]}
          validateOnSubmit={validateOnSubmit}
          fieldError="Some entries are not valid"
        />,
      );
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText(/Select entries to edit or remove them/);
    });

    it("removes all invalid entries after a failed submit", async () => {
      const { user } = installerRender(
        <TestForm
          defaultValues={["ok", "xbad"]}
          validateOnSubmit={validateOnSubmit}
          fieldError="Some entries are not valid"
        />,
      );
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await user.click(await screen.findByRole("button", { name: /remove all invalid entries/i }));
      screen.getByText("ok");
      expect(screen.queryByText("xbad")).not.toBeInTheDocument();
    });
  });

  describe("helperText", () => {
    it("shows helper text always, even when there are no errors", () => {
      installerRender(<TestForm helperText="Some hint" />);
      screen.getByText(/Some hint/);
    });

    it("shows helper text alongside the error block when there are invalid entries", () => {
      const validateOnChange = (v: string) => (v === "bad" ? "Invalid" : undefined);
      installerRender(
        <TestForm
          defaultValues={["bad"]}
          validateOnChange={validateOnChange}
          helperText="Some hint"
        />,
      );
      screen.getByText(/Some hint/);
    });
  });

  describe("skipDuplicates", () => {
    it("does not add an entry already in the list", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} skipDuplicates />);
      await user.type(screen.getByRole("textbox", { name: "Tags" }), "alpha");
      await user.keyboard("{Enter}");
      expect(screen.getAllByText("alpha")).toHaveLength(1);
    });

    it("skips duplicates when pasting", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} skipDuplicates />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.paste("alpha beta");
      expect(screen.getAllByRole("option")).toHaveLength(2);
      screen.getByText("beta");
    });
  });

  describe("paste", () => {
    it("adds multiple entries from a paste", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.paste("alpha beta gamma");
      screen.getByText("alpha");
      screen.getByText("beta");
      screen.getByText("gamma");
    });

    it("does not intercept a single-token paste", async () => {
      const { user } = installerRender(<TestForm />);
      const input = screen.getByRole("textbox", { name: "Tags" });
      await user.click(input);
      await user.paste("alpha");
      expect(input).toHaveValue("alpha");
      expect(screen.queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("does not activate navigation on Backspace when the draft is not empty", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.type(screen.getByRole("textbox", { name: "Tags" }), "partial");
      await user.keyboard("{Backspace}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("does not activate navigation on ArrowLeft when the draft is not empty", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.type(screen.getByRole("textbox", { name: "Tags" }), "partial");
      await user.keyboard("{ArrowLeft}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("activates the last entry on Backspace when the draft is empty", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("activates the last entry on ArrowLeft when the draft is empty", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{ArrowLeft}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("removes the active entry on Delete", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{ArrowLeft}{Delete}");
      expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    });

    it("removes the active entry on Backspace", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{ArrowLeft}{Backspace}");
      expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    });

    it("moves to the previous entry on ArrowLeft", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}");
      expect(screen.getByRole("option", { name: "beta" })).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{ArrowLeft}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("moves to the previous entry on ArrowUp", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}{ArrowUp}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("moves to the next entry on ArrowRight", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}{ArrowLeft}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("option", { name: "beta" })).toHaveAttribute("aria-selected", "true");
    });

    it("moves to the next entry on ArrowDown", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}{ArrowLeft}{ArrowDown}");
      expect(screen.getByRole("option", { name: "beta" })).toHaveAttribute("aria-selected", "true");
    });

    it("deactivates navigation on ArrowRight at the last entry", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}{ArrowRight}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("jumps to the first entry on Home", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}{Home}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("jumps to the last entry on End", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha", "beta"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{ArrowLeft}{Home}{End}");
      expect(screen.getByRole("option", { name: "beta" })).toHaveAttribute("aria-selected", "true");
    });

    it("deactivates navigation on Escape", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}{Escape}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("deactivates navigation on Tab", async () => {
      const { user } = installerRender(<TestForm defaultValues={["alpha"]} />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.keyboard("{Backspace}");
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await user.tab();
      expect(screen.getByRole("option", { name: "alpha" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });
  });

  describe("paste", () => {
    it("adds multiple entries from a paste", async () => {
      const { user } = installerRender(<TestForm />);
      await user.click(screen.getByRole("textbox", { name: "Tags" }));
      await user.paste("alpha beta gamma");
      screen.getByText("alpha");
      screen.getByText("beta");
      screen.getByText("gamma");
    });

    it("does not intercept a single-token paste", async () => {
      const { user } = installerRender(<TestForm />);
      const input = screen.getByRole("textbox", { name: "Tags" });
      await user.click(input);
      await user.paste("alpha");
      expect(input).toHaveValue("alpha");
      expect(screen.queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();
    });
  });

  describe("maxEntryWidth", () => {
    it("renders entries as plain text when maxEntryWidth is not provided", () => {
      installerRender(<TestForm defaultValues={["very-long-entry-name"]} />);
      const entry = screen.getByRole("option");
      expect(entry).toHaveAccessibleName("very-long-entry-name");
      expect(entry.querySelector("span[class*='truncate']")).not.toBeInTheDocument();
    });

    it("wraps entries in truncate component when maxEntryWidth is provided", () => {
      installerRender(<TestForm defaultValues={["very-long-entry-name"]} maxEntryWidth={10} />);
      const entry = screen.getByRole("option");
      const truncateSpan = entry.querySelector("span[class*='truncate']");
      expect(truncateSpan).toBeInTheDocument();
    });

    it("preserves full text in aria-label when truncated", () => {
      installerRender(<TestForm defaultValues={["very-long-entry-name"]} maxEntryWidth={10} />);
      const entry = screen.getByRole("option");
      expect(entry).toHaveAccessibleName("very-long-entry-name");
    });

    it("preserves full text in aria-label for invalid entries when truncated", () => {
      const validateOnChange = (v: string) => (v === "invalid-entry" ? "Bad value" : undefined);
      installerRender(
        <TestForm
          defaultValues={["invalid-entry"]}
          validateOnChange={validateOnChange}
          maxEntryWidth={10}
        />,
      );
      const entry = screen.getByRole("option");
      expect(entry).toHaveAccessibleName("invalid-entry is invalid: Bad value");
    });

    it("renders remove button with full text when truncated", () => {
      installerRender(<TestForm defaultValues={["very-long-entry-name"]} maxEntryWidth={10} />);
      screen.getByRole("button", { name: "Remove very-long-entry-name" });
    });
  });
});

// parsePasteEntries is tested directly because ArrayField uses <input type="text">
// internally (despite managing multiple values in state). Text inputs strip
// newlines per HTML spec when setting the value property, making it impossible to
// integration-test paste splitting with newline patterns like splitPasteOn="\n".
// Reference: https://html.spec.whatwg.org/multipage/input.html#text-(type=text)-state-and-search-state-(type=search)
describe("parsePasteEntries", () => {
  describe("default splitting (whitespace and commas)", () => {
    it("splits on spaces", () => {
      expect(parsePasteEntries("alpha beta gamma")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("splits on commas", () => {
      expect(parsePasteEntries("alpha,beta,gamma")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("splits on mixed whitespace and commas", () => {
      expect(parsePasteEntries("alpha, beta gamma,delta")).toEqual([
        "alpha",
        "beta",
        "gamma",
        "delta",
      ]);
    });

    it("filters out blank entries", () => {
      expect(parsePasteEntries("alpha  beta   gamma")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("trims whitespace from entries", () => {
      expect(parsePasteEntries("  alpha  ,  beta  ")).toEqual(["alpha", "beta"]);
    });

    it("returns empty array for blank input", () => {
      expect(parsePasteEntries("")).toEqual([]);
      expect(parsePasteEntries("   ")).toEqual([]);
    });
  });

  describe("custom splitPasteOn pattern", () => {
    it("splits on newlines when given \\n", () => {
      expect(parsePasteEntries("alpha\nbeta\ngamma", "\n")).toEqual(["alpha", "beta", "gamma"]);
    });

    it("splits on custom regex pattern", () => {
      expect(parsePasteEntries("alpha|beta|gamma", /\|/)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("preserves spaces within entries when splitting on newlines", () => {
      const input = "ssh-ed25519 AAAAC3Nz user@laptop\nssh-rsa AAAAB3Nz user@desktop";
      expect(parsePasteEntries(input, "\n")).toEqual([
        "ssh-ed25519 AAAAC3Nz user@laptop",
        "ssh-rsa AAAAB3Nz user@desktop",
      ]);
    });

    it("filters blank entries when splitting with custom pattern", () => {
      expect(parsePasteEntries("alpha\n\nbeta\n", "\n")).toEqual(["alpha", "beta"]);
    });

    it("trims whitespace from entries even with custom pattern", () => {
      expect(parsePasteEntries("  alpha  \n  beta  ", "\n")).toEqual(["alpha", "beta"]);
    });
  });
});
