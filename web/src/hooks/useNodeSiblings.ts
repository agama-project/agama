import { noop } from "radashi";

type AddAttributeFn = HTMLElement["setAttribute"];
type RemoveAttributeFn = HTMLElement["removeAttribute"];

/**
 * A hook for working with siblings of the node passed as parameter
 *
 * It returns an array with exactly two functions:
 *   - First for adding given attribute to siblings
 *   - Second for removing given attributes from siblings
 */
const useNodeSiblings = (node: HTMLElement): [AddAttributeFn, RemoveAttributeFn] => {
  if (!node) return [noop, noop];

  const siblings = [...node.parentNode.children].filter((n) => n !== node);

  const addAttribute: AddAttributeFn = (attribute, value) => {
    siblings.forEach((sibling) => {
      sibling.setAttribute(attribute, value);
    });
  };

  const removeAttribute: RemoveAttributeFn = (attribute: string) => {
    siblings.forEach((sibling) => {
      sibling.removeAttribute(attribute);
    });
  };

  return [addAttribute, removeAttribute];
};

export default useNodeSiblings;
