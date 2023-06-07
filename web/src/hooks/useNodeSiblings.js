/**
 * Returns two functions, one which adds given attributes to siblings
 * of the node passed as the hook parameter, and another one which removes attributes.
 *
 * @param {HTMLElement} node
 * @returns {Array}
 */
const useNodeSiblings = (node) => {
  if (!node) return [
    (a, b) => { return [a, b] },
    (a) => { return [a] }
  ];

  const siblings = [...node.parentNode.children].filter(n => n !== node);

  const addAttribute = (attribute, value) => {
    siblings.forEach(sibling => {
      sibling.setAttribute(attribute, value);
    });
  };

  const removeAttribute = (attribute) => {
    siblings.forEach(sibling => {
      sibling.removeAttribute(attribute);
    });
  };

  return [addAttribute, removeAttribute];
};

export default useNodeSiblings;
