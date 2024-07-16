import { renderHook } from "@testing-library/react";
import useNodeSiblings from "./useNodeSiblings";

// Mocked HTMLElement for testing
const mockNode = {
  parentNode: {
    children: [
      { setAttribute: jest.fn(), removeAttribute: jest.fn() }, // sibling 1
      { setAttribute: jest.fn(), removeAttribute: jest.fn() }, // sibling 2
      { setAttribute: jest.fn(), removeAttribute: jest.fn() }, // sibling 3
    ],
  },
};

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
    const { result } = renderHook(() => useNodeSiblings(mockNode));
    const [addAttribute] = result.current;
    const attributeName = "attribute";
    const attributeValue = "value";

    addAttribute(attributeName, attributeValue);

    expect(mockNode.parentNode.children[0].setAttribute).toHaveBeenCalledWith(
      attributeName,
      attributeValue,
    );
    expect(mockNode.parentNode.children[1].setAttribute).toHaveBeenCalledWith(
      attributeName,
      attributeValue,
    );
    expect(mockNode.parentNode.children[2].setAttribute).toHaveBeenCalledWith(
      attributeName,
      attributeValue,
    );
  });

  it("should remove attribute from all siblings when removeAttribute is called", () => {
    const { result } = renderHook(() => useNodeSiblings(mockNode));
    const [, removeAttribute] = result.current;
    const attributeName = "attribute";

    removeAttribute(attributeName);

    expect(mockNode.parentNode.children[0].removeAttribute).toHaveBeenCalledWith(attributeName);
    expect(mockNode.parentNode.children[1].removeAttribute).toHaveBeenCalledWith(attributeName);
    expect(mockNode.parentNode.children[2].removeAttribute).toHaveBeenCalledWith(attributeName);
  });
});
