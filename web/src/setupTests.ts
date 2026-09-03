// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from "util";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (!globalThis.TextEncoder || !globalThis.TextDecoder) {
  globalThis.TextEncoder = NodeTextEncoder as typeof TextEncoder;
  globalThis.TextDecoder = NodeTextDecoder as typeof TextDecoder;
}

// jsdom does not implement matchMedia; provide a minimal stub so theming code
// (which reads prefers-color-scheme) works in tests.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom does not implement scrollIntoView, and components that keep an active
// option or section in view call it. A no-op keeps them from throwing; tests
// that need to assert the calls can still install their own spy.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

jest.mock("~/context/installerL10n");

// Avoid creating a real xterm.js instance or opening a real WebSocket
// whenever the terminal context is used in a test. See
// use-terminal-session.test.ts for the tests that exercise the real hook.
jest.mock("~/hooks/use-terminal-session");
