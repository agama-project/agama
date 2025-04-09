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
  Checkbox,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  Form,
  FormGroup,
  Label,
  Title,
  TextInput,
} from "@patternfly/react-core";
import { Link, Page, PasswordInput } from "~/components/core";
import { RegisteredAddonInfo, RegistrationInfo } from "~/types/software";
import { HOSTNAME } from "~/routes/paths";
import {
  useProduct,
  useRegistration,
  useRegisterMutation,
  useAddons,
  useRegisteredAddons,
  useRegisterAddonMutation,
} from "~/queries/software";
import { useHostname } from "~/queries/system";
import { isEmpty, mask } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

const FORM_ID = "productRegistration";
const KEY_LABEL = _("Registration code");
const EMAIL_LABEL = "Email";

// the registration code might be quite long, make the password field wider
const RegistrationCodeInput = ({ ...props }) => <PasswordInput size={30} {...props} />;

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

const RegisteredExtensionSection = ({ extension }) => {
  const [showCode, setShowCode] = useState(false);

  // TRANSLATORS: %s will be replaced by the registration key.
  const [msg1, msg2] = _("The extension has been registered with key %s.").split("%s");

  return (
    <span>
      {msg1}
      <b>{showCode ? extension.registrationCode : mask(extension.registrationCode)}</b>
      {msg2}{" "}
      <Button variant="link" isInline onClick={() => setShowCode(!showCode)}>
        {showCode ? _("Hide") : _("Show")}
      </Button>
    </span>
  );
};

const RegistrationFormSection = () => {
  const { mutate: register } = useRegisterMutation();
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [provideEmail, setProvideEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // FIXME: use the right type for AxiosResponse
  const onRegisterError = ({ response }) => {
    setError(response.data.message);
  };

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    const data: RegistrationInfo = { key, email: provideEmail ? email : "" };

    // TODO: Replace with a more sophisticated mechanism to ensure all available
    // fields are filled and validated. Ideally, this should be a reusable solution
    // applicable to all Agama forms.
    if (isEmpty(key) || (provideEmail && isEmpty(email))) {
      setError("Some fields are missing. Please check and fill them.");
      return;
    }
    setLoading(true);

    // @ts-expect-error
    register(data, { onError: onRegisterError, onSettled: () => setLoading(false) });
  };

  // TODO: adjust texts based of registration "type", mandatory or optional

  return (
    <Form id={FORM_ID} onSubmit={submit}>
      {error && <Alert variant="warning" isInline title={error} />}

      <FormGroup fieldId="key" label={KEY_LABEL}>
        <RegistrationCodeInput id="key" value={key} onChange={(_, v) => setKey(v)} />
      </FormGroup>

      <FormGroup fieldId="provideEmail">
        <Checkbox
          id="provideEmail"
          label={_("Provide email address")}
          isChecked={provideEmail}
          onChange={() => setProvideEmail(!provideEmail)}
        />
      </FormGroup>

      {provideEmail && (
        <FormGroup fieldId="email" label={EMAIL_LABEL}>
          <TextInput id="email" value={email} onChange={(_, v) => setEmail(v)} />
        </FormGroup>
      )}

      <ActionGroup>
        <Button variant="primary" type="submit" form={FORM_ID} isInline isLoading={loading}>
          {_("Register")}
        </Button>
      </ActionGroup>
    </Form>
  );
};

const HostnameAlert = () => {
  const { transient: transientHostname, static: staticHostname } = useHostname();
  const hostname = isEmpty(staticHostname) ? transientHostname : staticHostname;

  // TRANSLATORS: %s will be replaced with the hostname value
  const title = sprintf(_('The product will be registered with "%s" hostname'), hostname);

  // TRANSLATORS: %s will be replaced with the section name
  const [descStart, descEnd] = _(
    "You cannot change it later. Go to the %s section if you want to modify it before proceeding with registration.",
  ).split("%s");

  const link = (
    <Link variant="link" to={HOSTNAME.root} isInline>
      {_("hostname")}
    </Link>
  );

  return (
    <Alert title={title} variant="custom" isPlain>
      {descStart} {link} {descEnd}
    </Alert>
  );
};

const Extension = ({ extension, unique }) => {
  const { mutate: registerAddon } = useRegisterAddonMutation();
  const registeredExtensions = useRegisteredAddons();
  const [regCode, setRegCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onRegisterError = ({ response }) => {
    setError(response.data.message);
  };

  const registered = registeredExtensions.find(
    (e) => e.id === extension.id && (e.version === extension.version || e.version === null),
  );

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);

    const data: RegisteredAddonInfo = {
      id: extension.id,
      registrationCode: regCode,
      // omit the version if only one version of the extension exists
      version: unique ? null : extension.version,
    };

    // @ts-expect-error
    registerAddon(data, { onError: onRegisterError, onSettled: () => setLoading(false) });
  };

  return (
    <div>
      {/* remove the "(BETA)" suffix, we display a Beta label instead */}
      <Title headingLevel="h4">
        {extension.label.replace(/\s*\(beta\)$/i, "")}{" "}
        {extension.release === "beta" && (
          <Label color="blue" isCompact>
            {_("Beta")}
          </Label>
        )}
        {extension.recommended && (
          <Label color="orange" isCompact>
            {_("Recommended")}
          </Label>
        )}
      </Title>
      <p>&nbsp;</p>
      <p>{extension.description}</p>
      <p>&nbsp;</p>
      <p>
        {registered ? (
          <RegisteredExtensionSection extension={registered} />
        ) : extension.available ? (
          <Form id={`register-form-${extension.id}-${extension.version}`} onSubmit={submit}>
            {error && <Alert variant="warning" isInline title={error} />}
            {!extension.free && (
              <FormGroup label={KEY_LABEL}>
                <RegistrationCodeInput
                  id={`reg-code-${extension.id}-${extension.version}`}
                  value={regCode}
                  onChange={(_, v) => setRegCode(v)}
                />
              </FormGroup>
            )}

            <ActionGroup>
              <Button variant="primary" type="submit" isInline isLoading={loading}>
                {_("Register")}
              </Button>
            </ActionGroup>
          </Form>
        ) : (
          <Alert title={_("Not available")} variant="warning">
            {_(
              "This extension is not available on the server. Please ask the server administrator to mirror the extension.",
            )}
          </Alert>
        )}
      </p>
    </div>
  );
};

const Extensions = () => {
  const extensions = useAddons();

  // count the extension versions
  const counts = {};
  extensions.forEach((e) => (counts[e.id] = counts[e.id] ? counts[e.id] + 1 : 1));

  const extensionComponents = extensions.map((ext, index) => (
    <Extension key={`extension-${index}`} extension={ext} unique={counts[ext.id] === 1} />
  ));

  return (
    <>
      <Title headingLevel="h2">{_("Extensions")}</Title>
      {extensionComponents}
    </>
  );
};

export default function ProductRegistrationPage() {
  const { selectedProduct: product } = useProduct();
  const { key } = useRegistration();
  // FIXME: this needs to be fixed for RMT which allows registering with empty key
  const isUnregistered = isEmpty(key);

  // TODO: render something meaningful instead? "Product not registrable"?
  if (!product.registration) return;

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Registration")}</Content>
      </Page.Header>

      <Page.Content>
        {isUnregistered && <HostnameAlert />}
        {isUnregistered ? <RegistrationFormSection /> : <RegisteredProductSection />}
        {!isUnregistered && <Extensions />}
      </Page.Content>
    </Page>
  );
}
