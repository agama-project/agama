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

import React, { useEffect, useState } from "react";
import { Form, FormGroup, TextInput } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { EmailInput } from "~/components/core";
import { noop } from "~/utils";

/**
 * Form for registering a product.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.id - Form id.
 * @param {function} props.onSubmit - Callback to be called when the form is submitted.
 * @param {(isValid: boolean) => void} props.onValidate - Callback to be called when the form is
 *  validated.
 */
export default function ProductRegistrationForm({
  id,
  onSubmit: onSubmitProp = noop,
  onValidate = noop
}) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(true);

  const onSubmit = (e) => {
    e.preventDefault();
    onSubmitProp({ code, email });
  };

  useEffect(() => {
    const validate = () => {
      return code.length > 0 && isValidEmail;
    };

    onValidate(validate());
  }, [code, isValidEmail, onValidate]);

  return (
    <Form id={ id || "productRegistrationForm" } onSubmit={onSubmit}>
      <FormGroup fieldId="regCode" label={_("Registration code")} isRequired>
        <TextInput id="regCode" value={code} onChange={(_, v) => setCode(v)} />
      </FormGroup>
      <FormGroup fieldId="email" label={_("Email")}>
        <EmailInput
          id="email"
          value={email}
          onValidate={setIsValidEmail}
          onChange={(_, v) => setEmail(v)}
        />
      </FormGroup>
    </Form>
  );
}
