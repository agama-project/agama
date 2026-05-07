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
import { generatePath, useNavigate, useParams } from "react-router";
import { unique } from "radashi";
import { Alert, ActionGroup, Flex, Form } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import { BreadcrumbProps } from "~/components/core/Breadcrumbs";
import NestedContent from "~/components/core/NestedContent";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import IpSettings from "~/components/network/IpSettings";
import BondSettings from "~/components/network/BondSettings";
import BindingModeSelector from "~/components/network/BindingModeSelector";
import DeviceSelector from "~/components/network/DeviceSelector";
import {
  BondMode,
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
  connectionType,
  CONNECTION_TYPE,
  connectionTypeLabel,
  ensureIPPrefix,
  formatIp,
  generateConnectionName,
  isValidIPv4Address,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";
import { _ } from "~/i18n";
import { validateConnectionForm } from "./connectionFormValidation";

/**
 * Form IP mode values.
 *
 * These control UI behavior (which fields are shown) and map to ConnectionMethod:
 * - AUTO: no address/gateway fields shown → ConnectionMethod.AUTO
 * - ADVANCED_AUTO: addresses required, gateway optional → ConnectionMethod.AUTO
 * - MANUAL: addresses and gateway required → ConnectionMethod.MANUAL
 */
export const FormIpMode = {
  AUTO: "auto",
  ADVANCED_AUTO: "advanced-auto",
  MANUAL: "manual",
} as const;

export type FormIpMode = (typeof FormIpMode)[keyof typeof FormIpMode];

/**
 * Modes that require at least one address to be provided.
 */
export const ADDRESS_REQUIRED_MODES: readonly FormIpMode[] = [
  FormIpMode.MANUAL,
  FormIpMode.ADVANCED_AUTO,
];

/**
 * Maps form mode values to their corresponding {@link ConnectionMethod}.
 *
 * Both AUTO and ADVANCED_AUTO map to ConnectionMethod.AUTO; they differ
 * only in UI behavior (whether address/gateway fields are shown).
 */
const MODE_TO_METHOD: Record<FormIpMode, ConnectionMethod> = {
  [FormIpMode.AUTO]: ConnectionMethod.AUTO,
  [FormIpMode.ADVANCED_AUTO]: ConnectionMethod.AUTO,
  [FormIpMode.MANUAL]: ConnectionMethod.MANUAL,
};

/**
 * Shared form options for ConnectionForm and its `withForm` based
 * sub-components
 *
 * Sub-components spread these options in their `withForm` definition so
 * TanStack Form can infer the field types, enabling type-safe props.
 *
 * Note: Type casts widen literal defaults to their union types, allowing
 * fields to accept any value from the union, not just the initial value.
 */
export const connectionFormOptions = formOptions({
  defaultValues: {
    name: "",
    type: CONNECTION_TYPE.ETHERNET as ConnectionType,
    iface: "",
    ifaceMac: "",
    ipv4Mode: FormIpMode.AUTO as FormIpMode,
    addresses4: [] as string[],
    gateway4: "",
    ipv6Mode: FormIpMode.AUTO as FormIpMode,
    addresses6: [] as string[],
    gateway6: "",
    nameservers: [] as string[],
    dnsSearchList: [] as string[],
    customDns: false,
    customDnsSearch: false,
    bindingMode: "none" as ConnectionBindingMode,
    bondIface: "",
    bondMode: BondMode.BALANCE_ROUND_ROBIN as BondMode,
    bondOptions: [] as string[],
    bondPorts: [] as string[],
  },
});

type FormValues = typeof connectionFormOptions.defaultValues;

/**
 * Connection types supported by this form.
 */
const SUPPORTED_CONNECTION_TYPES = [CONNECTION_TYPE.ETHERNET, CONNECTION_TYPE.BOND] as const;

/**
 * Infers the form IPvX mode from a stored {@link ConnectionMethod} and addresses.
 *
 * The presence of addresses affects the interpretation:
 * - `MANUAL` method → MANUAL
 * - `AUTO` method with addresses → ADVANCED_AUTO
 * - `AUTO` method without addresses → AUTO
 * - `undefined` method with addresses → ADVANCED_AUTO (from system)
 * - `undefined` method without addresses → AUTO
 */
function inferIpMode(method: ConnectionMethod | undefined, addresses: string[]): FormIpMode {
  if (method === ConnectionMethod.MANUAL) return FormIpMode.MANUAL;

  return addresses.length > 0 ? FormIpMode.ADVANCED_AUTO : FormIpMode.AUTO;
}

/**
 * Maps an existing {@link Connection} to initial form values for editing.
 */
function connectionToFormValues(connection: Connection): Partial<FormValues> {
  // Deduplicate addresses (config + system merge can create duplicates)
  const uniqueAddresses = unique(connection.addresses, (addr) => `${addr.address}/${addr.prefix}`);

  // Partition and format addresses in a single pass using proper IP validation
  const addresses4: string[] = [];
  const addresses6: string[] = [];

  for (const addr of uniqueAddresses) {
    const formatted = ensureIPPrefix(formatIp(addr));
    if (isValidIPv4Address(addr.address)) {
      addresses4.push(formatted);
    } else {
      addresses6.push(formatted);
    }
  }

  return {
    name: connection.id,
    type: connectionType(connection),
    iface: connection.iface ?? "",
    ifaceMac: connection.macAddress ?? "",
    bindingMode: connectionBindingMode(connection),
    ipv4Mode: inferIpMode(connection.method4, addresses4),
    addresses4,
    gateway4: connection.gateway4 ?? "",
    ipv6Mode: inferIpMode(connection.method6, addresses6),
    addresses6,
    gateway6: connection.gateway6 ?? "",
    nameservers: unique(connection.nameservers),
    dnsSearchList: unique(connection.dnsSearchList),
    customDns: connection.nameservers.length > 0,
    customDnsSearch: connection.dnsSearchList.length > 0,
    bondIface: connection.iface,
    bondMode: connection.bond?.mode ?? BondMode.BALANCE_ROUND_ROBIN,
    bondOptions: connection.bond?.options ? connection.bond.options.split(" ") : [],
    bondPorts: connection.bond?.ports ?? [],
  };
}

/**
 * Builds a {@link Connection} from the validated form values.
 *
 * Addresses in formValues already have prefixes (added by ArrayField's
 * normalize or when loading from backend), so no prefix addition is needed.
 */
function buildConnection(formValues: FormValues): Connection {
  const ipv4Addresses = ADDRESS_REQUIRED_MODES.includes(formValues.ipv4Mode)
    ? formValues.addresses4.map(buildAddress)
    : [];
  const ipv6Addresses = ADDRESS_REQUIRED_MODES.includes(formValues.ipv6Mode)
    ? formValues.addresses6.map(buildAddress)
    : [];

  let iface = "";

  if (formValues.type === CONNECTION_TYPE.BOND) {
    iface = formValues.bondIface;
  } else if (formValues.bindingMode === "iface") {
    iface = formValues.iface;
  }

  return new Connection(formValues.name, {
    iface,
    macAddress: formValues.bindingMode === "mac" ? formValues.ifaceMac : "",
    method4: MODE_TO_METHOD[formValues.ipv4Mode],
    gateway4: ipv4Addresses.length > 0 ? formValues.gateway4 : "",
    method6: MODE_TO_METHOD[formValues.ipv6Mode],
    gateway6: ipv6Addresses.length > 0 ? formValues.gateway6 : "",
    addresses: [...ipv4Addresses, ...ipv6Addresses],
    nameservers: formValues.customDns ? formValues.nameservers : [],
    dnsSearchList: formValues.customDnsSearch ? formValues.dnsSearchList : [],
    bond:
      formValues.type === CONNECTION_TYPE.BOND
        ? {
            mode: formValues.bondMode,
            options: formValues.bondOptions.join(" "),
            ports: formValues.bondPorts,
          }
        : undefined,
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
  const syncName = (formApi) => {
    const type = formApi.getFieldValue("type");

    if (formApi.getFieldMeta("name")?.isDirty) return;

    const existingIds = new Set(systemConns.map((c) => c.id));
    formApi.setFieldValue("name", generateConnectionName(type, existingIds), {
      dontUpdateMeta: true,
      dontRunListeners: true,
    });
  };

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
    // On mount, auto-fill the name field (e.g., "Ethernet", "Bond 2") since
    // defaultValues can't access systemConns for duplicates. Changing the type
    // updates the name via the type field's onChange listener.
    listeners: isEditing ? undefined : { onMount: ({ formApi }) => syncName(formApi) },
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

        {!isEditing && (
          <>
            <form.AppField name="type" listeners={{ onChange: () => syncName(form) }}>
              {(field) => (
                <field.DropdownField
                  label={
                    // TRANSLATORS: checkbox label for custom DNS server configuration.
                    _("Type")
                  }
                  options={SUPPORTED_CONNECTION_TYPES.map((type) => ({
                    value: type,
                    label: connectionTypeLabel(type),
                  }))}
                />
              )}
            </form.AppField>

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
          </>
        )}

        <form.Subscribe selector={(s) => s.values.type}>
          {(type) =>
            ([CONNECTION_TYPE.ETHERNET, CONNECTION_TYPE.WIFI] as ConnectionType[]).includes(
              type,
            ) && (
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
            )
          }
        </form.Subscribe>

        <form.Subscribe selector={(s) => s.values.type}>
          {(type) =>
            type === CONNECTION_TYPE.BOND && <BondSettings form={form} isEditing={isEditing} />
          }
        </form.Subscribe>

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
                      helperText={
                        // TRANSLATORS: helper text for DNS servers field explaining the format.
                        _("E.g., 8.8.8.8 or 2001:4860:4860::8888")
                      }
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
                      helperText={
                        // TRANSLATORS: helper text for DNS search domains field explaining the format.
                        _("E.g., example.com")
                      }
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
  const breadcrumbs: BreadcrumbProps[] = [
    // TRANSLATORS: breadcrumb label for the network configuration section.
    { label: _("Network"), path: NETWORK.root },
  ];

  if (id) {
    breadcrumbs.push(
      { label: id, path: generatePath(NETWORK.connection.details, { id }) },
      // TRANSLATORS: breadcrumb label for the connection-edit form. Keep the
      // noun ("connection"): the previous crumb is the connection name, so a
      // bare "Edit" reads fine visually but leaves screen-reader users without
      // the object being acted on when the crumb is announced on its own.
      { label: _("Edit connection") },
    );
  } else {
    // TRANSLATORS: breadcrumb label for the new-connection form.
    breadcrumbs.push({ label: _("New connection") });
  }

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>{id ? <EditConnectionForm /> : <NewConnectionForm />}</Page.Content>
    </Page>
  );
}
