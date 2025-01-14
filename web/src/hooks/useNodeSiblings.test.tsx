import React from "react";
import { screen, renderHook } from "@testing-library/react";
import useNodeSiblings from "./useNodeSiblings";
import { plainRender } from "~/test-utils";

const TestingComponent = () => (
  <div>
    <article>
      <section aria-label="First sibling" data-foo="bar" />
      <section aria-label="Second sibling" />
      <section aria-label="Third sibling" data-foo="bar" />
    </article>
    <section aria-label="Not a sibling" data-foo="bar" />
  </div>
);

describe("useNodeSiblings", () => {
  it("should return noop functions when node is not provided", () => {
    const { result } = renderHook(() => useNodeSiblings(null));
    const [addAttribute, removeAttribute] = result.current;

    expect(addAttribute).toBeInstanceOf(Function);
    expect(removeAttribute).toBeInstanceOf(Function);
    expect(addAttribute).toEqual(expect.any(Function));
    expect(removeAttribute).toEqual(expect.any(Function));

    // Call the noop functions to ensure they don't throw any errors
    expect(() => addAttribute("attribute", "value")).not.toThrow();
    expect(() => removeAttribute("attribute")).not.toThrow();
  });

  it("should add attribute to all siblings when addAttribute is called", () => {
    plainRender(<TestingComponent />);
    const targetNode = screen.getByRole("region", { name: "Second sibling" });
    const firstSibling = screen.getByRole("region", { name: "First sibling" });
    const thirdSibling = screen.getByRole("region", { name: "Third sibling" });
    const noSibling = screen.getByRole("region", { name: "Not a sibling" });
    const { result } = renderHook(() => useNodeSiblings(targetNode));
    const [addAttribute] = result.current;
    const attributeName = "attribute";
    const attributeValue = "value";

    expect(firstSibling).not.toHaveAttribute(attributeName, attributeValue);
    expect(thirdSibling).not.toHaveAttribute(attributeName, attributeValue);
    expect(noSibling).not.toHaveAttribute(attributeName, attributeValue);

    addAttribute(attributeName, attributeValue);

    expect(firstSibling).toHaveAttribute(attributeName, attributeValue);
    expect(thirdSibling).toHaveAttribute(attributeName, attributeValue);
    expect(noSibling).not.toHaveAttribute(attributeName, attributeValue);
  });

  it("should remove attribute from all siblings when removeAttribute is called", () => {
    plainRender(<TestingComponent />);
    const targetNode = screen.getByRole("region", { name: "Second sibling" });
    const firstSibling = screen.getByRole("region", { name: "First sibling" });
    const thirdSibling = screen.getByRole("region", { name: "Third sibling" });
    const noSibling = screen.getByRole("region", { name: "Not a sibling" });
    const { result } = renderHook(() => useNodeSiblings(targetNode));
    const [, removeAttribute] = result.current;

    expect(firstSibling).toHaveAttribute("data-foo", "bar");
    expect(thirdSibling).toHaveAttribute("data-foo", "bar");
    expect(noSibling).toHaveAttribute("data-foo", "bar");

    removeAttribute("data-foo");

    expect(firstSibling).not.toHaveAttribute("data-foo", "bar");
    expect(thirdSibling).not.toHaveAttribute("data-foo", "bar");
    expect(noSibling).toHaveAttribute("data-foo", "bar");
  });
});
