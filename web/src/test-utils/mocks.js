import React from "react";

/**
 * Creates a function to register callbacks
 *
 * It can be useful to mock functions that might receive a callback that you can
 * execute on-demand during the test.
 *
 * @return a tuple with the mocked function and the list of callbacks.
 */
const createCallbackMock = () => {
  const callbacks = [];
  const on = (callback) => {
    callbacks.push(callback);
    return () => {
      const position = callbacks.indexOf(callback);
      if (position > -1) callbacks.splice(position, 1);
    };
  };
  return [on, callbacks];
};

/**
 * Returns fake component with given content
 *
 * @param {React.ReactNode} content - content for the fake component
 * @param {object} [options] - Options for building the fake component
 * @param {string} [options.wrapper="div"] - the HTML element to be used for wrapping given content
 *
 * @return a function component
 */
const mockComponent = (content, { wrapper } = { wrapper: "div" }) => {
  const Wrapper = wrapper;
  return () => <Wrapper>{content}</Wrapper>;
};

export { createCallbackMock, mockComponent };
