import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import LanguageSelector from "./LanguageSelector";
import InstallerClient from "./lib/InstallerClient";

jest.mock("./lib/InstallerClient");

const languages = [
  { id: "en_US", name: "English" },
  { id: "de_DE", name: "German" }
];

const clientMock = {
  getLanguages: () => Promise.resolve(languages),
  getSelectedLanguages: () => Promise.resolve(["en_US"])
};

beforeEach(() => {
  InstallerClient.mockImplementation(() => clientMock);
});

it("displays the proposal", async () => {
  installerRender(<LanguageSelector />);
  await screen.findByText("English");
});

describe("when the user changes the language", () => {
  let setLanguagesFn;

  beforeEach(() => {
    // if defined outside, the mock is cleared automatically
    setLanguagesFn = jest.fn().mockResolvedValue();
    InstallerClient.mockImplementation(() => {
      return {
        ...clientMock,
        setLanguages: setLanguagesFn
      };
    });
  });

  it("changes the selected language", async () => {
    installerRender(<LanguageSelector />);
    const button = await screen.findByRole("button", { name: "English" });
    userEvent.click(button);

    const languageSelector = await screen.findByLabelText("Select language");
    userEvent.selectOptions(languageSelector, ["German"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "German" });
    expect(setLanguagesFn).toHaveBeenCalledWith(["de_DE"]);
  });
});
