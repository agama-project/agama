/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { isEmpty, isNullish, shake } from "radashi";
import { ActionGroup, Alert, Form } from "@patternfly/react-core";
import { patchConfig } from "~/api";
import { useConfig } from "~/hooks/model/config";
import { useProposal } from "~/hooks/model/proposal";
import { useFormSubmit } from "~/hooks/use-form-submit";
import { anyFieldChanged, useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";

import HostnameFields from "./HostnameFields";
import NtpFields from "./NtpFields";
import { HOSTNAME_MODE, NTP_MODE, defaultOptions, validate } from "./fields";

import type * as Ntp from "~/model/config/ntp";

type SystemFormValues = typeof defaultOptions.defaultValues;
type SystemFieldMeta = Partial<Record<keyof SystemFormValues, { isDefaultValue?: boolean }>>;

/**
 * Builds the hostname config patch if any hostname-related field has changed.
 *
 * Returns undefined if no changes are detected, which will be shaken out of the
 * final config.
 */
function buildHostnameConfig(
  formValues: SystemFormValues,
  fieldMeta: SystemFieldMeta,
): { static: string } | undefined {
  if (!anyFieldChanged(fieldMeta, "hostnameMode", "hostnameValue")) return undefined;
  if (formValues.hostnameMode === HOSTNAME_MODE.STATIC) return { static: formValues.hostnameValue };
  return { static: "" };
}

/**
 * Builds the NTP config patch if any NTP-related field has changed.
 *
 * Returns undefined if no changes are detected, which will be shaken out of the
 * final config.
 */
function buildNtpConfig(
  formValues: SystemFormValues,
  fieldMeta: SystemFieldMeta,
): { sources: Ntp.Source[] } | undefined {
  const fieldsToCheck =
    formValues.ntpMode === NTP_MODE.CUSTOM ? ["ntpMode", "ntpServers"] : ["ntpMode"];

  if (!anyFieldChanged(fieldMeta, ...fieldsToCheck)) return undefined;
  if (formValues.ntpMode !== NTP_MODE.CUSTOM) return { sources: [] };
  return {
    sources: formValues.ntpServers.map(
      (address): Ntp.Source => ({
        type: "pool",
        address,
        iburst: true,
        offline: false,
      }),
    ),
  };
}

/**
 * Form for configuring system settings.
 *
 * Allows the user to configure:
 * - Hostname: choose between a transient hostname (provided by the network) or
 *   a static one (set manually)
 * - NTP: choose between default NTP servers or custom ones
 */
export default function SystemForm() {
  const { ntp } = useConfig();
  const { hostname } = useProposal();
  const { hostname: transientHostname, static: staticHostname } = hostname;

  const ntpServers = ntp?.sources?.map((s) => s.address) || [];
  const usingTransientHostname = isEmpty(staticHostname) || isNullish(staticHostname);

  // useFormSubmit is initialized before useAppForm so we can pass onSubmitAsync
  // directly into the validators option — no mutation, no two-phase wiring.
  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<SystemFormValues>({
    onSubmit: async (formValues, fieldMeta) => {
      const config = shake({
        hostname: buildHostnameConfig(formValues, fieldMeta),
        ntp: buildNtpConfig(formValues, fieldMeta),
      });

      if (isEmpty(config)) return { noChanges: true };

      return patchConfig(config)
        .then(() => ({ patched: true as const }))
        .catch(({ message }) => ({ error: message }));
    },
  });

  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      hostnameMode: isEmpty(staticHostname) ? HOSTNAME_MODE.TRANSIENT : HOSTNAME_MODE.STATIC,
      hostnameValue: usingTransientHostname ? transientHostname : staticHostname,
      ntpMode: ntpServers.length > 0 ? NTP_MODE.CUSTOM : NTP_MODE.DEFAULT,
      ntpServers,
    },
    validators: {
      onSubmitAsync: async (ctx) => {
        // Field validation runs first. If it fails, TanStack Form surfaces
        // errors per field and onSubmitAsync (business logic) is not called.
        const fieldErrors = validate(ctx.value);
        if (fieldErrors) return fieldErrors;

        // Business logic: patch building + API call.
        return onSubmitAsync(ctx, form);
      },
    },
  });

  return (
    <form.AppForm>
      <Form id="systemForm" onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert
                isInline
                variant="danger"
                title={
                  // TRANSLATORS: error message when system settings update request fails
                  _("System settings could not be updated")
                }
              >
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Success / no-changes / validation error alerts — managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        <HostnameFields form={form} />
        <NtpFields form={form} />

        <ActionGroup>
          {/* TRANSLATORS: button to save system settings changes */}
          <form.SubmitButton label={_("Accept")} />
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}
