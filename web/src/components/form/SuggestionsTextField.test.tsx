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
import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import SuggestionsTextField from "./SuggestionsTextField";

function ControlledSuggestionsTextField({
  initialValue = "",
  suggestions = [],
}: {
  initialValue?: string;
  suggestions?: string[];
}) {
  const [value, setValue] = React.useState(initialValue);

  return (
    <SuggestionsTextField
      id="test-field"
      value={value}
      suggestions={suggestions}
      onChange={(_event, newValue) => setValue(newValue)}
      aria-label="Test field"
    />
  );
}

describe("SuggestionsTextField", () => {
  it("renders a text input", () => {
    installerRender(<ControlledSuggestionsTextField />);
    expect(screen.getByLabelText("Test field")).toBeInTheDocument();
  });

  it("shows the current value", () => {
    installerRender(<ControlledSuggestionsTextField initialValue="Hello" />);
    expect(screen.getByLabelText("Test field")).toHaveValue("Hello");
  });

  it("renders suggestions in a datalist", () => {
    const suggestions = ["/boot", "/home", "/var"];
    installerRender(<ControlledSuggestionsTextField suggestions={suggestions} />);

    // Check datalist exists and is linked to input
    const input = screen.getByLabelText("Test field");
    const datalistId = input.getAttribute("list");
    expect(datalistId).toBe("test-field-datalist");

    const datalist = document.getElementById(datalistId);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.tagName).toBe("DATALIST");

    // Check all suggestions are rendered as options
    const options = datalist?.querySelectorAll("option");
    expect(options).toHaveLength(3);
    expect(options?.[0]).toHaveValue("/boot");
    expect(options?.[1]).toHaveValue("/home");
    expect(options?.[2]).toHaveValue("/var");
  });

  it("shows typed value immediately (internal state)", async () => {
    const handleChange = jest.fn();
    const { user } = installerRender(
      <SuggestionsTextField
        id="test-field"
        value=""
        onChange={handleChange}
        aria-label="Test field"
      />,
    );

    const input = screen.getByLabelText("Test field");

    // Type some text
    await user.type(input, "/home");

    // Internal state should show the typed value immediately
    expect(input).toHaveValue("/home");
  });

  it("syncs to parent on blur", async () => {
    const handleChange = jest.fn();
    const { user } = installerRender(
      <SuggestionsTextField
        id="test-field"
        value=""
        onChange={handleChange}
        aria-label="Test field"
      />,
    );

    const input = screen.getByLabelText("Test field");

    // Type some text
    await user.type(input, "/home");

    // Blur the input
    await user.tab();

    // onChange should be called with the typed value
    expect(handleChange).toHaveBeenCalled();
    expect(handleChange).toHaveBeenLastCalledWith(expect.anything(), "/home");
  });

  it("updates internal state when external value changes (unfocused)", async () => {
    const { rerender } = installerRender(
      <SuggestionsTextField
        id="test-field"
        value="/boot"
        onChange={jest.fn()}
        aria-label="Test field"
      />,
    );

    expect(screen.getByLabelText("Test field")).toHaveValue("/boot");

    // Change external value while unfocused
    rerender(
      <SuggestionsTextField
        id="test-field"
        value="/home"
        onChange={jest.fn()}
        aria-label="Test field"
      />,
    );

    expect(screen.getByLabelText("Test field")).toHaveValue("/home");
  });

  it("ignores external value changes while focused (real-world scenario)", async () => {
    // This tests the typical controlled component pattern where the parent
    // responds to onChange and sends back the same value. Focus tracking
    // prevents race conditions from the debounced onChange.
    const { user } = installerRender(<ControlledSuggestionsTextField initialValue="/boot" />);

    const input = screen.getByLabelText("Test field");
    expect(input).toHaveValue("/boot");

    // Focus the input
    await user.click(input);

    // Type something
    await user.type(input, "test");
    expect(input).toHaveValue("/boottest");

    // Blur the input
    await user.tab();

    // After blur, value should match what we typed
    await waitFor(() => {
      expect(input).toHaveValue("/boottest");
    });
  });

  it("clears the value when external value is cleared", async () => {
    const { rerender } = installerRender(
      <SuggestionsTextField
        id="test-field"
        value="/boot"
        onChange={jest.fn()}
        aria-label="Test field"
      />,
    );

    expect(screen.getByLabelText("Test field")).toHaveValue("/boot");

    // Clear external value
    rerender(
      <SuggestionsTextField
        id="test-field"
        value=""
        onChange={jest.fn()}
        aria-label="Test field"
      />,
    );

    expect(screen.getByLabelText("Test field")).toHaveValue("");
  });

  it("handles onBlur callback if provided", async () => {
    const handleBlur = jest.fn();
    const { user } = installerRender(
      <SuggestionsTextField
        id="test-field"
        value=""
        onChange={jest.fn()}
        onBlur={handleBlur}
        aria-label="Test field"
      />,
    );

    const input = screen.getByLabelText("Test field");

    // Click to focus, then tab to blur
    await user.click(input);
    await user.tab();

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it("works in a controlled form pattern", async () => {
    const { user } = installerRender(
      <ControlledSuggestionsTextField initialValue="" suggestions={["/boot", "/home", "/var"]} />,
    );

    const input = screen.getByLabelText("Test field");

    // Type a value and blur
    await user.type(input, "/home");
    await user.tab();
    expect(input).toHaveValue("/home");

    // Click back in, clear, type new value
    await user.click(input);
    await user.clear(input);
    await user.type(input, "/var");
    await user.tab();
    expect(input).toHaveValue("/var");
  });
});
