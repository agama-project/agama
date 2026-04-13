/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import { formOptions } from "@tanstack/react-form";
import { useNavigate, useParams } from "react-router";
import { isEmpty, shake } from "radashi";
import { Alert, ActionGroup, Flex, Form } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import IpSettings from "~/components/network/IpSettings";
import BindingModeSelector from "~/components/network/BindingModeSelector";
import DeviceSelector from "~/components/network/DeviceSelector";
import {
  Connection,
  ConnectionBindingMode,
  ConnectionMethod,
  ConnectionType,
} from "~/types/network";
import { useConnectionMutation, useConfig } from "~/hooks/model/config/network";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useSystem, useDevices } from "~/hooks/model/system/network";
import { extendCollection } from "~/utils";
import { NETWORK } from "~/routes/paths";
import {
  buildAddress,
  connectionBindingMode,
  formatIp,
  generateConnectionName,
  isValidIPv4,
  isValidIPv6,
  isValidIPv4Address,
  isValidIPv6Address,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import { _ } from "~/i18n";

const IPV4_DEFAULT_PREFIX = 24;
const IPV6_DEFAULT_PREFIX = 64;

/**
 * Maps form mode values to their corresponding {@link ConnectionMethod}.
 *
 * "unset" is intentionally absent: omitting it causes the Connection
 * constructor to write no method, delegating the decision to NetworkManager.
 * This map can be dropped once the form mode values align with
 * {@link ConnectionMethod} enum values.
 */
const MODE_TO_METHOD: Record<string, ConnectionMethod> = {
  auto: ConnectionMethod.AUTO,
  manual: ConnectionMethod.MANUAL,
};

/**
 * Shared form options for ConnectionForm and its `withForm` based
 * sub-components
 *
 * Sub-components spread these options in their `withForm` definition so
 * TanStack Form can infer the field types, enabling type-safe props.
 */
export const connectionFormOptions = formOptions({
  defaultValues: {
    name: "",
    iface: "",
    ifaceMac: "",
    ipv4Mode: "unset",
    addresses4: [] as string[],
    gateway4: "",
    ipv6Mode: "unset",
    addresses6: [] as string[],
    gateway6: "",
    nameservers: [] as string[],
    dnsSearchList: [] as string[],
    customDns: false,
    customDnsSearch: false,
    bindingMode: "none" as ConnectionBindingMode,
  },
});

type FormValues = typeof connectionFormOptions.defaultValues;
type FormFieldErrors = Partial<Record<keyof FormValues, string>>;

/**
 * Infers the form IPvX mode string from a stored {@link ConnectionMethod} and addresses.
 *
 * The presence of addresses affects the interpretation:
 * - `undefined` method with addresses -> "auto" (Advanced mode, DHCP forced)
 * - `undefined` method without addresses -> "unset" (Automatic)
 * - `AUTO` method with addresses -> "auto" (Advanced mode)
 * - `AUTO` method without addresses -> "unset" (treat as Automatic)
 * - `MANUAL` method -> always "manual"
 */
function inferIpMode(method: ConnectionMethod | undefined, addresses: string[]): string {
  if (method === ConnectionMethod.MANUAL) return "manual";

  // For both AUTO and undefined, check if there are addresses
  // Addresses indicate Advanced mode (forced DHCP), no addresses means Automatic (unset)
  if (method === ConnectionMethod.AUTO) {
    return addresses.length > 0 ? "auto" : "unset";
  }

  // method is undefined
  return addresses.length > 0 ? "auto" : "unset";
}

/**
 * Maps an existing {@link Connection} to initial form values for editing.
 */
function connectionToFormValues(connection: Connection): Partial<FormValues> {
  // Partition and format addresses in a single pass using proper IP validation
  const addresses4: string[] = [];
  const addresses6: string[] = [];

  for (const addr of connection.addresses) {
    const formatted = formatIp(addr);
    if (isValidIPv4Address(addr.address)) {
      addresses4.push(formatted);
    } else {
      addresses6.push(formatted);
    }
  }

  return {
    name: connection.id,
    iface: connection.iface ?? "",
    ifaceMac: connection.macAddress ?? "",
    bindingMode: connectionBindingMode(connection),
    ipv4Mode: inferIpMode(connection.method4, addresses4),
    addresses4,
    gateway4: connection.gateway4 ?? "",
    ipv6Mode: inferIpMode(connection.method6, addresses6),
    addresses6,
    gateway6: connection.gateway6 ?? "",
    nameservers: connection.nameservers,
    dnsSearchList: connection.dnsSearchList,
    customDns: connection.nameservers.length > 0,
    customDnsSearch: connection.dnsSearchList.length > 0,
  };
}

/**
 * Returns an error when the given list is active and has invalid or missing entries.
 * Returns undefined when inactive or when all entries are valid.
 *
 * @param active - Whether the list should be validated at all.
 * @param emptyMsg - Error to return when the list is empty. Omit for optional
 *   lists where entries are not required but must be valid when provided.
 */
function validateActiveList(
  active: boolean,
  values: string[],
  isValid: (v: string) => boolean,
  emptyMsg: string | undefined,
  invalidMsg: string,
): string | undefined {
  if (!active) return undefined;
  if (emptyMsg !== undefined && values.length === 0) return emptyMsg;
  if (values.some((v) => !isValid(v))) return invalidMsg;
}

/**
 * Returns an error for an IP addresses list based on the current IP mode.
 *
 * - `manual`: addresses are required and must be valid.
 * - `auto`: addresses are optional but must be valid when provided.
 * - `unset`: no validation.
 */
function validateIpAddresses(
  mode: string,
  addresses: string[],
  isValid: (v: string) => boolean,
  emptyMsg: string,
  invalidMsg: string,
): string | undefined {
  const required = mode === "manual";
  const active = required || (mode === "auto" && addresses.length > 0);
  return validateActiveList(
    active,
    addresses,
    isValid,
    required ? emptyMsg : undefined,
    invalidMsg,
  );
}

/**
 * Returns an error for a gateway value under its protocol mode.
 *
 * - `manual`: validates if the gateway is present.
 * - `auto`: validates only when there are already valid addresses; an empty
 *   address list means the gateway will be ignored on submission anyway.
 */
function validateGateway(
  mode: string,
  gateway: string,
  validAddresses: string[],
  isValid: (v: string) => boolean,
  invalidMsg: string,
): string | undefined {
  if (!gateway) return undefined;
  if (mode === "manual") return isValid(gateway) ? undefined : invalidMsg;
  if (mode === "auto" && validAddresses.length > 0)
    return isValid(gateway) ? undefined : invalidMsg;
}

/** Ensures a CIDR string has a prefix, adding a protocol-appropriate default if missing. */
const withPrefix = (address: string): string => {
  if (address.includes("/")) return address;
  return address.includes(":")
    ? `${address}/${IPV6_DEFAULT_PREFIX}`
    : `${address}/${IPV4_DEFAULT_PREFIX}`;
};

/**
 * Validates the connection form values.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid. Validation is intentionally done here rather than in
 * per-field onSubmit validators — see the {@link ConnectionForm} remarks.
 */
function validateConnectionForm(formValues: FormValues): FormFieldErrors | undefined {
  const validAddresses4 = formValues.addresses4.filter(isValidIPv4Address);
  const validAddresses6 = formValues.addresses6.filter(isValidIPv6Address);

  const fieldErrors = shake({
    // TRANSLATORS: validation error for the connection name field.
    name: !formValues.name.trim() ? _("Name is required") : undefined,
    addresses4: validateIpAddresses(
      formValues.ipv4Mode,
      formValues.addresses4,
      isValidIPv4Address,
      // TRANSLATORS: validation error for the IPv4 addresses field.
      _("At least one IPv4 address is required"),
      // TRANSLATORS: validation error for the IPv4 addresses field.
      _("Some IPv4 addresses are invalid"),
    ),
    addresses6: validateIpAddresses(
      formValues.ipv6Mode,
      formValues.addresses6,
      isValidIPv6Address,
      // TRANSLATORS: validation error for the IPv6 addresses field.
      _("At least one IPv6 address is required"),
      // TRANSLATORS: validation error for the IPv6 addresses field.
      _("Some IPv6 addresses are invalid"),
    ),
    gateway4: validateGateway(
      formValues.ipv4Mode,
      formValues.gateway4,
      validAddresses4,
      isValidIPv4,
      // TRANSLATORS: validation error for the IPv4 gateway field.
      _("Invalid IPv4 gateway"),
    ),
    gateway6: validateGateway(
      formValues.ipv6Mode,
      formValues.gateway6,
      validAddresses6,
      isValidIPv6,
      // TRANSLATORS: validation error for the IPv6 gateway field.
      _("Invalid IPv6 gateway"),
    ),
    nameservers: validateActiveList(
      formValues.customDns,
      formValues.nameservers,
      isValidNameserver,
      // TRANSLATORS: validation error for the DNS servers field.
      _("At least one DNS server is required"),
      // TRANSLATORS: validation error for the DNS servers field.
      _("Some DNS server addresses are invalid"),
    ),
    dnsSearchList: validateActiveList(
      formValues.customDnsSearch,
      formValues.dnsSearchList,
      isValidDNSSearchDomain,
      // TRANSLATORS: validation error for the DNS search domains field.
      _("At least one DNS search domain is required"),
      // TRANSLATORS: validation error for the DNS search domains field.
      _("Some DNS search domains are invalid"),
    ),
  });

  if (!isEmpty(fieldErrors)) return fieldErrors;
}

/**
 * Builds a {@link Connection} from the validated form values.
 */
function buildConnection(formValues: FormValues): Connection {
  const ipv4Addresses =
    formValues.ipv4Mode === "manual" || formValues.ipv4Mode === "auto"
      ? formValues.addresses4.map(withPrefix).map(buildAddress)
      : [];
  const ipv6Addresses =
    formValues.ipv6Mode === "manual" || formValues.ipv6Mode === "auto"
      ? formValues.addresses6.map(withPrefix).map(buildAddress)
      : [];

  return new Connection(formValues.name, {
    iface: formValues.bindingMode === "iface" ? formValues.iface : "",
    macAddress: formValues.bindingMode === "mac" ? formValues.ifaceMac : "",
    method4: MODE_TO_METHOD[formValues.ipv4Mode],
    gateway4: ipv4Addresses.length > 0 ? formValues.gateway4 : "",
    method6: MODE_TO_METHOD[formValues.ipv6Mode],
    gateway6: ipv6Addresses.length > 0 ? formValues.gateway6 : "",
    addresses: [...ipv4Addresses, ...ipv6Addresses],
    nameservers: formValues.customDns ? formValues.nameservers : [],
    dnsSearchList: formValues.customDnsSearch ? formValues.dnsSearchList : [],
  });
}

/**
 * Form for creating a new network connection.
 *
 * @remarks
 * Server errors are surfaced via TanStack Form's `validators.onSubmitAsync`.
 * This is the recommended pattern for forms where the server acts as the
 * validator: the call lives in the async validator, which returns `{ form:
 * message }` on failure. TanStack then exposes the message via
 * `state.errorMap.onSubmit.form` without throwing, keeping the button
 * re-enabled for a retry.
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/validation
 * @see https://github.com/TanStack/form/discussions/623#discussioncomment-13026699
 */
type ConnectionFormContentProps = {
  defaults?: Partial<FormValues>;
  isEditing?: boolean;
};

function ConnectionFormContent({ defaults, isEditing = false }: ConnectionFormContentProps) {
  const navigate = useNavigate();
  const devices = useDevices();
  const { connections: systemConns } = useSystem();
  const { mutateAsync: updateConnection } = useConnectionMutation();

  // Generates and writes the auto-computed name when the binding changes, as
  // long as the user has not manually edited it. `isDirty` is used instead of
  // `isTouched` because a user could focus and blur the field without changing
  // it, which would set `isTouched` but not `isDirty`. `dontRunListeners`
  // prevents the name update from re-triggering this listener.
  //
  // @see https://tanstack.com/form/latest/docs/framework/react/guides/listeners#form-listeners
  const syncName = ({ formApi }) => {
    if (formApi.getFieldMeta("name")?.isDirty) return;
    const existingIds = new Set(systemConns.map((c) => c.id));
    formApi.setFieldValue("name", generateConnectionName(ConnectionType.ETHERNET, existingIds), {
      dontUpdateMeta: true,
      dontRunListeners: true,
    });
  };

  const syncNameListeners = { onMount: syncName };

  const form = useAppForm({
    ...mergeFormDefaults(connectionFormOptions, {
      iface: devices[0]?.name ?? "",
      ifaceMac: devices[0]?.macAddress ?? "",
      ...defaults,
    }),
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        const fieldErrors = validateConnectionForm(formValues);
        if (fieldErrors) return { fields: fieldErrors };

        try {
          await updateConnection(buildConnection(formValues));
        } catch (e) {
          return { form: e.message };
        }
      },
    },
    onSubmit: () => navigate(-1),
    listeners: isEditing ? undefined : syncNameListeners,
  });

  return (
    <form.AppForm>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          // Validation is intentionally deferred to submission so users are
          // not interrupted while filling the form. All rules live in
          // onSubmitAsync rather than per-field onSubmit validators because
          // several checks are cross-field (e.g. gateway validity depends on
          // the addresses list). TanStack Form only clears field errors set
          // by onSubmitAsync when a per-field onSubmit validator runs for
          // the same cause — which never happens here — so canSubmit stays
          // false after a failed attempt. setErrorMap resets every field's
          // errorMap.onSubmit before each new attempt, restoring canSubmit
          // so onSubmitAsync is called again.
          // @see https://tanstack.com/form/latest/docs/reference/formApi#seterrormap
          form.setErrorMap({ onSubmit: { fields: {} } });
          form.handleSubmit();
        }}
      >
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert
                isInline
                title={
                  // TRANSLATORS: title of an error for a failed network connection save.
                  // Do not end with a period.
                  _("The connection could not be saved")
                }
                variant="danger"
              >
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        <Flex alignItems={{ default: "alignItemsFlexEnd" }} gap={{ default: "gapMd" }}>
          <BindingModeSelector form={form} />

          <form.Subscribe selector={(s) => s.values.bindingMode}>
            {(bindingMode) => (
              <>
                {bindingMode === "iface" && (
                  <DeviceSelector
                    form={form}
                    by="iface"
                    sync={{ field: "ifaceMac", with: (d) => d.macAddress }}
                  />
                )}
                {bindingMode === "mac" && (
                  <DeviceSelector
                    form={form}
                    by="mac"
                    sync={{ field: "iface", with: (d) => d.name }}
                  />
                )}
              </>
            )}
          </form.Subscribe>
        </Flex>

        {!isEditing && (
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={
                  // TRANSLATORS: label for the network connection profile name field.
                  _("Name")
                }
              />
            )}
          </form.AppField>
        )}

        <IpSettings form={form} protocol="ipv4" />

        <IpSettings form={form} protocol="ipv6" />

        <form.AppField name="customDns">
          {(field) => (
            <field.CheckboxField
              label={
                // TRANSLATORS: checkbox label for custom DNS server configuration.
                _("Use custom DNS servers")
              }
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(s) => s.values.customDns}>
          {(customDns) =>
            customDns && (
              <NestedContent margin="mxLg">
                <form.AppField name="nameservers">
                  {(field) => (
                    <field.ArrayField
                      // TRANSLATORS: label for the DNS servers field.
                      label={_("DNS servers")}
                      skipDuplicates
                      validateOnSubmit={(v) =>
                        // TRANSLATORS: validation error for an invalid DNS server address entry.
                        isValidNameserver(v) ? undefined : _("Invalid DNS server address")
                      }
                    />
                  )}
                </form.AppField>
              </NestedContent>
            )
          }
        </form.Subscribe>

        <form.AppField name="customDnsSearch">
          {(field) => (
            <field.CheckboxField
              label={
                // TRANSLATORS: checkbox label for custom DNS search domain configuration.
                _("Use custom DNS search domains")
              }
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(s) => s.values.customDnsSearch}>
          {(customDnsSearch) =>
            customDnsSearch && (
              <NestedContent margin="mxLg">
                <form.AppField name="dnsSearchList">
                  {(field) => (
                    <field.ArrayField
                      // TRANSLATORS: label for the DNS search domains field.
                      label={_("DNS search domains")}
                      skipDuplicates
                      validateOnSubmit={(v) =>
                        // TRANSLATORS: validation error for an invalid DNS search domain entry.
                        isValidDNSSearchDomain(v) ? undefined : _("Invalid DNS search domain")
                      }
                    />
                  )}
                </form.AppField>
              </NestedContent>
            )
          }
        </form.Subscribe>

        <ActionGroup>
          <form.SubmitButton />
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

function NewConnectionForm() {
  return <ConnectionFormContent />;
}

function ConnectionNotFound() {
  return (
    <ResourceNotFound
      // TRANSLATORS: title of the page shown when the requested connection
      // profile does not exist. Do not end with a period.
      title={_("Connection not found")}
      // TRANSLATORS: body text on the connection not found page.
      body={_("The connection does not exist or is no longer available.")}
      // TRANSLATORS: link text on the connection not found page.
      linkText={_("Go to network page")}
      linkPath={NETWORK.root}
    />
  );
}

function EditConnectionForm() {
  const { id } = useParams();
  const { connections: configConns } = useConfig();
  const { connections: systemConns } = useSystem();
  // Merge config and system connections so the form reflects the user's
  // explicit settings (config) while filling gaps from the live system state.
  // Config wins for single values: e.g. configConn.method4 === undefined
  // (the user chose "Automatic", meaning "do not put method in the config")
  // must override systemConn.method4 === "auto" that Agama backend or
  // NetworkManager might report.
  //
  // Arrays (addresses, nameservers, etc.) are concatenated so users can see
  // existing system values even when config has empty arrays.
  const { all: connections } = extendCollection(configConns || [], {
    with: systemConns,
    mergeArrays: true,
  });
  const connection = connections.find((c) => c.id === id);

  if (!connection) return <ConnectionNotFound />;

  return <ConnectionFormContent defaults={connectionToFormValues(connection)} isEditing />;
}

/**
 * Form for creating or editing a network connection.
 *
 * @remarks
 * Renders {@link NewConnectionForm} when no route `id` param is present, or
 * {@link EditConnectionForm} when editing an existing connection. Both delegate
 * to {@link ConnectionFormContent} for the shared form rendering.
 *
 * Server errors are surfaced via TanStack Form's `validators.onSubmitAsync`.
 * This is the recommended pattern for forms where the server acts as the
 * validator: the call lives in the async validator, which returns `{ form:
 * message }` on failure. TanStack then exposes the message via
 * `state.errorMap.onSubmit.form` without throwing, keeping the button
 * re-enabled for a retry.
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/validation
 * @see https://github.com/TanStack/form/discussions/623#discussioncomment-13026699
 */
export default function ConnectionForm() {
  const { id } = useParams();
  // TRANSLATORS: page title and breadcrumb label for creating a new connection.
  const title = id ?? _("New connection");
  // TRANSLATORS: breadcrumb label for the network configuration section.
  const breadcrumbs = [{ label: _("Network"), path: NETWORK.root }, { label: title }];

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>{id ? <EditConnectionForm /> : <NewConnectionForm />}</Page.Content>
    </Page>
  );
}
