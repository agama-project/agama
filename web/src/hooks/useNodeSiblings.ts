import { noop } from "~/utils";

/**
 * A hook for working with siblings of the node passed as parameter
 *
 * It returns an array with exactly two functions:
 *   - First for adding given attribute to siblings
 *   - Second for removing given attributes from siblings
 */
const useNodeSiblings = (
  node: HTMLElement,
): [(attribute: string, value) => void, (attribute: string) => void] => {
  if (!node) return [noop, noop];

  const siblings = [...node.parentNode.children].filter((n) => n !== node);

  const addAttribute = (attribute: string, value) => {
    siblings.forEach((sibling) => {
      sibling.setAttribute(attribute, value);
    });
  };

  const removeAttribute = (attribute: string) => {
    siblings.forEach((sibling) => {
      sibling.removeAttribute(attribute);
    });
  };

  return [addAttribute, removeAttribute];
};

export default useNodeSiblings;
