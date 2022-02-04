import { screen } from "@testing-library/react";
import { render } from "./test-utils";
import App from "./App";

test("renders the App", () => {
  render(<App />);
  const title = screen.getByText(/Welcome to D-Installer/i);
  expect(title).toBeInTheDocument();
});
