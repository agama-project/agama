import { noop } from "~/utils";

/**
 * Function for adding an attribute to a sibling
 *
 * @typedef {function} addAttributeFn
 * @param {string} attribute - attribute name
 * @param {*} value - value to set
 */

/**
 * Function for removing an attribute from a sibling
 *
 * @typedef {function} removeAttributeFn
 * @param {string} attribute - attribute name
 */

/**
 * A hook for working with siblings of the node passed as parameter
 *
 * It returns an array with exactly two functions:
 *   - First for adding given attribute to siblings
 *   - Second for removing given attributes from siblings
 *
 * @param {HTMLElement} node
 * @returns {[addAttributeFn, removeAttributeFn]}
 */
const useNodeSiblings = (node) => {
  if (!node) return [noop, noop];

  const siblings = [...node.parentNode.children].filter((n) => n !== node);

  const addAttribute = (attribute, value) => {
    siblings.forEach((sibling) => {
      sibling.setAttribute(attribute, value);
    });
  };

  const removeAttribute = (attribute) => {
    siblings.forEach((sibling) => {
      sibling.removeAttribute(attribute);
    });
  };

  return [addAttribute, removeAttribute];
};

export default useNodeSiblings;
