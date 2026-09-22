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
import { generatePath, useNavigate, useParams } from "react-router";
import { Alert, ActionGroup, Flex, Form } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { useConnectionMutation } from "~/hooks/model/config/network";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useFormSubmit } from "~/hooks/use-form-submit";
import { NETWORK } from "~/routes/paths";
import {
  connectionTypeLabel,
  CONNECTION_TYPE,
  generateConnectionName,
  isValidNameserver,
  isValidDNSSearchDomain,
} from "~/utils/network";

import BindingModeSelector from "./BindingModeSelector";
import BondFields from "./BondFields";
import BridgeFields from "./BridgeFields";
import VlanFields from "./VlanFields";
import DeviceSelector from "./DeviceSelector";
import IpFields from "./IpFields";
import { useConnectionFormContentQuery, useInitialConnection } from "./queries";
import { buildPayload, toFormValues } from "./transformations";
import { validate } from "./validations";
import { defaultOptions, SUPPORTED_CONNECTION_TYPES } from "./fields";
import { _ } from "~/i18n";

import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";
import type { ConnectionFormContentQuery } from "./queries";
import { ConnectionType } from "~/types/network";

type FormValues = typeof defaultOptions.defaultValues;

/**
 * Inner form for creating or editing a network connection.
 *
 * Receives frozen query data as props via withFrozenQuery. The mutation hook
 * and navigation are called internally and are intentionally not frozen: they
 * must always reflect the current state.
 *
 * ## Patterns Used
 *
 * ### withFrozenQuery (see with-frozen-query.tsx)
 * Wraps this component so it receives frozen initial data as props. Query
 * refetches never reach this component, preventing flickering and protecting
 * user edits.
 *
 * ### useFormSubmit (see use-form-submit.tsx)
 * Encapsulates the submit lifecycle for forms that navigate away:
 * - Validation error alerts via refs + Subscribe (no extra re-renders)
 * - Server error handling
 * - Clean error state management
 *
 * ### Field validation
 * Stays in useAppForm's validators.onSubmitAsync where TanStack Form expects
 * it. useFormSubmit's onSubmit is only called after field validation passes.
 */
function ConnectionFormContent({
  initialConnection,
  devices,
  systemConnections,
}: ConnectionFormContentQuery) {
  const navigate = useNavigate();
  const { mutateAsync: updateConnection } = useConnectionMutation();
  const isEditing = initialConnection !== null;

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

    const existingIds = new Set(systemConnections.map((c) => c.id));
    formApi.setFieldValue("name", generateConnectionName(type, existingIds), {
      dontUpdateMeta: true,
      dontRunListeners: true,
    });
  };

  // useFormSubmit is initialized before useAppForm so we can pass onSubmitAsync
  // directly into the validators option — no mutation, no two-phase wiring.
  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<FormValues>({
    scrollOnSuccess: false,
    onSubmit: async (values) => {
      try {
        await updateConnection(buildPayload(values));
        navigate(-1);
        return { patched: true as const };
      } catch (e) {
        return { error: e.message };
      }
    },
  });

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, {
      iface: devices[0]?.name ?? "",
      ifaceMac: devices[0]?.macAddress ?? "",
      ...toFormValues(initialConnection),
    }),
    validators: {
      onSubmitAsync: async (ctx) => {
        // Field validation runs first. If it fails, TanStack Form reports
        // errors per field and onSubmitAsync (business logic) is not called.
        const fieldErrors = validate(ctx.value);
        if (fieldErrors) return fieldErrors;

        // Business logic: payload building + API call.
        return onSubmitAsync(ctx, form);
      },
    },
    // On mount, auto-fill the name field (e.g., "Ethernet", "Bond 2") since
    // defaultValues can't access systemConnections for duplicates. Changing the
    // type updates the name via the type field's onChange listener.
    listeners: isEditing ? undefined : { onMount: ({ formApi }) => syncName(formApi) },
  });

  return (
    <form.AppForm>
      <Form onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
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

        {/* Validation error alert — managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        {!isEditing && (
          <>
            <form.AppField name="type" listeners={{ onChange: () => syncName(form) }}>
              {(field) => (
                <field.DropdownField
                  label={
                    // TRANSLATORS: label for the network connection type field.
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
                          label={_("Device name")}
                          sync={{ field: "ifaceMac", with: (d) => d.macAddress }}
                          exclude={{ devices: ["lo"] }}
                        />
                      )}
                      {bindingMode === "mac" && (
                        <DeviceSelector
                          form={form}
                          by="mac"
                          label={_("Device MAC address")}
                          sync={{ field: "iface", with: (d) => d.name }}
                          exclude={{ devices: ["lo"] }}
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
            type === CONNECTION_TYPE.BOND && <BondFields form={form} isEditing={isEditing} />
          }
        </form.Subscribe>

        <form.Subscribe selector={(s) => s.values.type}>
          {(type) =>
            type === CONNECTION_TYPE.BRIDGE && <BridgeFields form={form} isEditing={isEditing} />
          }
        </form.Subscribe>

        <form.Subscribe selector={(s) => s.values.type}>
          {(type) =>
            type === CONNECTION_TYPE.VLAN && <VlanFields form={form} isEditing={isEditing} />
          }
        </form.Subscribe>

        <IpFields form={form} protocol="ipv4" />

        <IpFields form={form} protocol="ipv6" />

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

/**
 * Memoized, refetch-protected wrapper around {@link ConnectionFormContent}.
 *
 * Freezes the result of {@link useConnectionFormContentQuery} on mount and
 * passes it as props. Query refetches update the outer wrapper but never reach
 * the form, preventing flickering and protecting user edits.
 */
const FrozenConnectionFormContent = withFrozenQuery(
  useConnectionFormContentQuery,
  ConnectionFormContent,
);

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

/**
 * Page shell for the connection create/edit flow.
 *
 * Owns the breadcrumbs and the not-found guard. Delegates the actual form to
 * {@link FrozenConnectionFormContent}, which is protected from refetches.
 *
 * Renders the new-connection form when no route `id` param is present, or the
 * edit form when editing an existing connection.
 *
 * Server errors are reported via TanStack Form's `validators.onSubmitAsync`.
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
  const connection = useInitialConnection();

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
      <Page.Content>
        {id && !connection ? <ConnectionNotFound /> : <FrozenConnectionFormContent />}
      </Page.Content>
    </Page>
  );
}
