/*
 * Copyright (c) [2023-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import {
  ActionGroup,
  Alert,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  Form,
  FormGroup,
  TextInput,
} from "@patternfly/react-core";
import { Page, PasswordInput } from "~/components/core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { useProduct, useRegistration, useRegisterMutation } from "~/queries/software";
import { isEmpty, mask } from "~/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

const FORM_ID = "productRegistration";
const KEY_LABEL = _("Registration code");
const EMAIL_LABEL = "Email";

const RegisteredProductSection = () => {
  const { selectedProduct: product } = useProduct();
  const registration = useRegistration();
  const [showCode, setShowCode] = useState(false);
  const toggleCodeVisibility = () => setShowCode(!showCode);

  return (
    <>
      <Content isEditorial>
        {sprintf(_("%s has been registered with below information."), product.name)}
      </Content>
      <DescriptionList>
        <DescriptionListGroup>
          <DescriptionListTerm>{KEY_LABEL}</DescriptionListTerm>
          <DescriptionListDescription>
            <Flex gap={{ default: "gapSm" }}>
              {showCode ? registration.key : mask(registration.key)}
              <Button variant="link" isInline onClick={toggleCodeVisibility}>
                {showCode ? _("Hide") : _("Show")}
              </Button>
            </Flex>
          </DescriptionListDescription>
          {!isEmpty(registration.email) && (
            <>
              <DescriptionListTerm>{EMAIL_LABEL}</DescriptionListTerm>
              <DescriptionListDescription>{registration.email}</DescriptionListDescription>
            </>
          )}
        </DescriptionListGroup>
      </DescriptionList>
    </>
  );
};

const RegistrationFormSection = () => {
  const { mutate: register } = useRegisterMutation();
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // FIXME: use the right type for AxiosResponse
  const onRegisterError = ({ response }) => {
    const originalMessage = response.data.message;
    const from = originalMessage.indexOf(":") + 1;
    setError(originalMessage.slice(from).trim());
  };

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // @ts-ignore
    register({ key, email }, { onError: onRegisterError, onSettled: () => setLoading(false) });
  };

  // TODO: adjust texts based of registration "type", mandatory or optional

  return (
    <Form id={FORM_ID} onSubmit={submit}>
      {error && <Alert variant="warning" isInline title={error} />}
      <FormGroup fieldId="key" label={KEY_LABEL}>
        <PasswordInput id="key" value={key} onChange={(_, v) => setKey(v)} />
      </FormGroup>
      <FormGroup
        fieldId="email"
        label={
          <>
            {EMAIL_LABEL} <span className={textStyles.textColorSubtle}>{_("(optional)")}</span>
          </>
        }
      >
        <TextInput id="email" value={email} onChange={(_, v) => setEmail(v)} />
      </FormGroup>

      <ActionGroup>
        <Button variant="primary" type="submit" form={FORM_ID} isInline isLoading={loading}>
          {_("Register")}
        </Button>
      </ActionGroup>
    </Form>
  );
};

export default function ProductRegistrationPage() {
  const { selectedProduct: product } = useProduct();
  const registration = useRegistration();

  // TODO: render something meaningful instead? "Product not registrable"?
  if (!product.registration) return;

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Registration")}</Content>
      </Page.Header>

      <Page.Content>
        {isEmpty(registration.key) ? <RegistrationFormSection /> : <RegisteredProductSection />}
      </Page.Content>
    </Page>
  );
}
