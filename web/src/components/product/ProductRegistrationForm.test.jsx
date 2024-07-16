/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { useState } from "react";
import { Button } from "@patternfly/react-core";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ProductRegistrationForm } from "~/components/product";

it.skip("renders a field for entering the registration code", async () => {
  plainRender(<ProductRegistrationForm />);
  await screen.findByLabelText(/Registration code/);
});

it.skip("renders a field for entering an email", async () => {
  plainRender(<ProductRegistrationForm />);
  await screen.findByLabelText("Email");
});

const ProductRegistrationFormTest = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isValid, setIsValid] = useState(true);

  return (
    <>
      <ProductRegistrationForm id="testForm" onSubmit={setIsSubmitted} onValidate={setIsValid} />
      <Button type="submit" form="testForm">
        Accept
      </Button>
      {isSubmitted && <p>Form is submitted!</p>}
      {isValid === false && <p>Form is not valid!</p>}
    </>
  );
};

it.skip("triggers the onSubmit callback", async () => {
  const { user } = plainRender(<ProductRegistrationFormTest />);

  expect(screen.queryByText("Form is submitted!")).toBeNull();

  const button = screen.getByRole("button", { name: "Accept" });
  await user.click(button);
  await screen.findByText("Form is submitted!");
});

it.skip("sets the form as invalid if there is no code", async () => {
  plainRender(<ProductRegistrationFormTest />);
  await screen.findByText("Form is not valid!");
});

it.skip("sets the form as invalid if there is a code and a wrong email", async () => {
  const { user } = plainRender(<ProductRegistrationFormTest />);
  const codeInput = await screen.findByLabelText(/Registration code/);
  const emailInput = await screen.findByLabelText("Email");
  await user.type(codeInput, "111222");
  await user.type(emailInput, "foo");

  await screen.findByText("Form is not valid!");
});

it.skip("does not set the form as invalid if there is a code and no email", async () => {
  const { user } = plainRender(<ProductRegistrationFormTest />);
  const codeInput = await screen.findByLabelText(/Registration code/);
  await user.type(codeInput, "111222");

  expect(screen.queryByText("Form is not valid!")).toBeNull();
});

it.skip("does not set the form as invalid if there is a code and a correct email", async () => {
  const { user } = plainRender(<ProductRegistrationFormTest />);
  const codeInput = await screen.findByLabelText(/Registration code/);
  const emailInput = await screen.findByLabelText("Email");
  await user.type(codeInput, "111222");
  await user.type(emailInput, "test@test.com");

  expect(screen.queryByText("Form is not valid!")).toBeNull();
});
