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

import React, { useEffect, useState } from "react";
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
  SelectList,
  SelectOption,
  Title,
  TextInput,
  List,
  ListItem,
} from "@patternfly/react-core";
import {
  Link,
  NestedContent,
  Page,
  SelectWrapper as Select,
  SubtleContent,
} from "~/components/core";
import RegistrationExtension from "./RegistrationExtension";
import RegistrationCodeInput from "./RegistrationCodeInput";
import { RegistrationParams } from "~/types/software";
import { HOSTNAME } from "~/routes/paths";
import { useProduct, useRegistration, useRegisterMutation, useAddons } from "~/queries/software";
import { useHostname } from "~/queries/system";
import { isEmpty } from "radashi";
import { mask } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

const FORM_ID = "productRegistration";
const SERVER_LABEL = _("Registration server");
const EMAIL_LABEL = _("Email");
const SCC_SERVER_LABEL = _("SUSE Customer Center (SCC)");
const CUSTOM_SERVER_LABEL = _("Custom");

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
          {!isEmpty(registration.url) && (
            <>
              <DescriptionListTerm>{SERVER_LABEL}</DescriptionListTerm>
              <DescriptionListDescription>{registration.url}</DescriptionListDescription>
            </>
          )}
          {!isEmpty(registration.key) && (
            <>
              <DescriptionListTerm>{_("Registration code")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex gap={{ default: "gapSm" }}>
                  {showCode ? registration.key : mask(registration.key)}
                  <Button variant="link" isInline onClick={toggleCodeVisibility}>
                    {showCode ? _("Hide") : _("Show")}
                  </Button>
                </Flex>
              </DescriptionListDescription>
            </>
          )}
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

type ServerOption = "default" | "custom";

type RegistrationServerProps = {
  id?: string;
  value: ServerOption;
  onChange: (v: ServerOption) => void;
};

function RegistrationServer({
  id = "server",
  value,
  onChange,
}: RegistrationServerProps): React.ReactNode {
  return (
    <FormGroup fieldId={id} label={SERVER_LABEL}>
      <Select
        id={"server"}
        value={value}
        label={value === "default" ? SCC_SERVER_LABEL : CUSTOM_SERVER_LABEL}
        onChange={(v: ServerOption) => onChange(v)}
      >
        <SelectList aria-label={_("Server options")}>
          <SelectOption value="default" description={_("Register using SUSE server")}>
            {SCC_SERVER_LABEL}
          </SelectOption>
          <SelectOption
            value="custom"
            description={_("Register using a custom registration server")}
          >
            {CUSTOM_SERVER_LABEL}
          </SelectOption>
        </SelectList>
      </Select>
    </FormGroup>
  );
}

type RegistrationUrlProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
};

function RegistrationUrl({ id = "url", value, onChange }: RegistrationUrlProps): React.ReactNode {
  return (
    <FormGroup fieldId={id} label={_("Server URL")}>
      <TextInput id={id} value={value} onChange={(_, v) => onChange(v)} />
      <SubtleContent>{_("Example: https://myserver.com")}</SubtleContent>
    </FormGroup>
  );
}

type RegistrationCodeFieldProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
};

function RegistrationCodeField({
  id,
  value,
  onChange,
}: RegistrationCodeFieldProps): React.ReactNode {
  return (
    <FormGroup fieldId={id} label={_("Registration code")}>
      <RegistrationCodeInput id={id} value={value} onChange={(_, v) => onChange(v)} />
    </FormGroup>
  );
}

type RegistrationCodeProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  isOptional?: boolean;
  isProvided?: boolean;
  onProvidedChange?: (v: boolean) => void;
};

function RegistrationCode({
  id = "code",
  value,
  onChange,
  isOptional = false,
  isProvided = false,
  onProvidedChange,
}: RegistrationCodeProps): React.ReactNode {
  if (!isOptional) return <RegistrationCodeField id={id} value={value} onChange={onChange} />;

  const optionalId = `provide-${id}`;

  return (
    <>
      <FormGroup fieldId={optionalId}>
        <Checkbox
          id={optionalId}
          label={_("Provide registration code")}
          isChecked={isProvided}
          onChange={() => onProvidedChange && onProvidedChange(!isProvided)}
        />
      </FormGroup>
      {isProvided && (
        <NestedContent margin="mxMd" aria-live="polite">
          <RegistrationCodeField id={id} value={value} onChange={onChange} />
        </NestedContent>
      )}
    </>
  );
}

type RegistrationEmailProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  isProvided?: boolean;
  onProvidedChange?: (v: boolean) => void;
};

function RegistrationEmail({
  id = "email",
  value,
  onChange,
  isProvided = false,
  onProvidedChange,
}: RegistrationEmailProps): React.ReactNode {
  const optionalId = `provide-${id}`;

  return (
    <>
      <FormGroup fieldId={optionalId}>
        <Checkbox
          id={optionalId}
          label={_("Provide email address")}
          isChecked={isProvided}
          onChange={() => onProvidedChange(!isProvided)}
        />
      </FormGroup>

      {isProvided && (
        <NestedContent margin="mxMd" aria-live="polite">
          <FormGroup fieldId={id} label={EMAIL_LABEL}>
            <TextInput id={id} value={value} onChange={(_, v) => onChange(v)} />
          </FormGroup>
        </NestedContent>
      )}
    </>
  );
}

const RegistrationFormSection = () => {
  const { mutate: register } = useRegisterMutation();
  const [server, setServer] = useState<ServerOption>("default");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [provideKey, setProvideKey] = useState(true);
  const [provideEmail, setProvideEmail] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const registration = useRegistration();

  useEffect(() => {
    if (registration) {
      const { key, email, url } = registration;
      const server = isEmpty(url) ? "default" : "custom";
      setServer(server);
      setKey(key);
      setEmail(email);
      setUrl(url);
      setProvideKey(!isEmpty(key));
      setProvideEmail(!isEmpty(email));
    }
  }, [registration]);

  const changeServer = (value: ServerOption) => {
    if (value !== "default") setProvideKey(!isEmpty(key));
    setServer(value);
  };

  const changeProvideKey = (value: boolean) => {
    if (!value) setKey("");
    setProvideKey(value);
  };

  const changeProvideEmail = (value: boolean) => {
    if (!value) setEmail("");
    setProvideEmail(value);
  };

  // FIXME: use the right type for AxiosResponse
  const onRegisterError = ({ response }) => {
    setRequestError(response.data.message);
  };

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setRequestError(null);

    const isUrlRequired = server !== "default";
    const isKeyRequired = server === "default" || provideKey;

    const errors = [];
    if (isUrlRequired && isEmpty(url)) errors.push("Enter a server URL");
    if (isKeyRequired && isEmpty(key)) errors.push("Enter a registration code");
    if (provideEmail && isEmpty(email)) errors.push("Enter an email");
    setErrors(errors);

    if (!isEmpty(errors)) return;

    const data: RegistrationParams = {
      url: isUrlRequired ? url : "",
      key: isKeyRequired ? key : "",
      email: provideEmail ? email : "",
    };

    setLoading(true);

    // @ts-expect-error
    register(data, { onError: onRegisterError, onSettled: () => setLoading(false) });
  };

  // TODO: adjust texts based of registration "type", mandatory or optional

  return (
    <Form id={FORM_ID} onSubmit={submit}>
      {requestError && <Alert variant="warning" isInline title={requestError} />}

      {!isEmpty(errors) && (
        <Alert variant="warning" isInline title={_("Check the following before continuing")}>
          <List isPlain>
            {errors.map((e, i) => (
              <ListItem key={i}>{e}</ListItem>
            ))}
          </List>
        </Alert>
      )}

      <RegistrationServer value={server} onChange={changeServer} />

      {server !== "default" && <RegistrationUrl value={url} onChange={setUrl} />}

      <RegistrationCode
        value={key}
        onChange={setKey}
        isOptional={server !== "default"}
        isProvided={provideKey}
        onProvidedChange={changeProvideKey}
      />

      <RegistrationEmail
        value={email}
        onChange={setEmail}
        isProvided={provideEmail}
        onProvidedChange={changeProvideEmail}
      />

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

const Extensions = () => {
  const extensions = useAddons();
  if (extensions.length === 0) return null;

  const extensionComponents = extensions.map((ext) => (
    <RegistrationExtension
      key={`extension-${ext.id}-${ext.version}`}
      extension={ext}
      isUnique={extensions.filter((e) => e.id === ext.id).length === 1}
    />
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
  const { registered } = useRegistration();

  // TODO: render something meaningful instead? "Product not registrable"?
  if (!product.registration) return;

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Registration")}</Content>
      </Page.Header>

      <Page.Content>
        {!registered && <HostnameAlert />}
        {!registered ? <RegistrationFormSection /> : <RegisteredProductSection />}
        {registered && <Extensions />}
      </Page.Content>
    </Page>
  );
}
