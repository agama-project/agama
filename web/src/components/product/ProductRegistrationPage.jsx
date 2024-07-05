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
import { Alert, Form, FormGroup } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { EmailInput, Page, PasswordInput } from "~/components/core";
import { useProduct } from "~/queries/software";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

/**
 * Form for registering a product.
 * @component
 *
 * @param {object} props
 */
export default function ProductRegistrationPage() {
  const navigate = useNavigate();
  const { software } = useInstallerClient();
  const { selectedProduct } = useProduct();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState();

  // FIXME: re-introduce validations and "isLoading" status
  // TODO: see if would be better to use https://reactrouter.com/en/main/components/form

  const onCancel = () => {
    setError(null);
    navigate("..");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await software.product.register(code, email);
    if (result.success) {
      software.probe();
    } else {
      setError(result.message);
    }
  };

  return (
    <>
      <Page.MainContent>
        <h3>{sprintf(_("Register %s"), selectedProduct.name)}</h3>
        {
          error &&
          <Alert variant="warning" isInline title={_("Something went wrong")}>
            <p>{error}</p>
          </Alert>
        }
        <Form id="productRegistrationForm" onSubmit={onSubmit}>
          <FormGroup fieldId="regCode" label={_("Registration code")} isRequired>
            <PasswordInput id="regCode" value={code} onChange={(_, v) => setCode(v)} />
          </FormGroup>
          <FormGroup fieldId="email" label={_("Email")}>
            <EmailInput
              id="email"
              value={email}
              onChange={(_, v) => setEmail(v)}
            />
          </FormGroup>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction onClick={onCancel} />
        <Page.Action type="submit" form="productRegistrationForm">{_("Accept")}</Page.Action>
      </Page.NextActions>
    </>
  );
}
