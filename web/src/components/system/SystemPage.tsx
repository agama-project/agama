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

import React, { useRef } from "react";
import { isEmpty, isNullish, shake } from "radashi";
import { formOptions } from "@tanstack/react-form";
import { ActionGroup, Alert, Form } from "@patternfly/react-core";
import { Page } from "~/components/core";
import HostnameSettings from "~/components/system/HostnameSettings";
import NtpSettings from "~/components/system/NtpSettings";
import { validateSystemForm } from "~/components/system/systemFormValidation";
import { patchConfig } from "~/api";
import { useConfig } from "~/hooks/model/config";
import { useProposal } from "~/hooks/model/proposal";
import { anyFieldChanged, useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";
import type * as Ntp from "~/model/config/ntp";

const HOSTNAME_MODE = {
  TRANSIENT: "transient",
  STATIC: "static",
} as const;

const NTP_MODE = {
  DEFAULT: "default",
  CUSTOM: "custom",
} as const;

type HostnameMode = "transient" | "static";
type NtpMode = "default" | "custom";

export const systemFormOptions = formOptions({
  defaultValues: {
    hostnameMode: HOSTNAME_MODE.TRANSIENT as HostnameMode,
    hostnameValue: "",
    ntpMode: NTP_MODE.DEFAULT as NtpMode,
    ntpServers: [] as string[],
  },
});

type SystemFormValues = typeof systemFormOptions.defaultValues;
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
 * Page for configuring system settings.
 *
 * Allows the user to configure:
 * - Hostname: choose between a transient hostname (provided by the network) or
 *   a static one (set manually)
 * - NTP: choose between default NTP servers or custom ones
 */
export default function SystemPage() {
  /**
   * Tracks whether the backend config was actually patched during the last submit.
   *
   * Used to distinguish between two successful submit scenarios:
   * - true: form had changes, backend was updated via patchConfig()
   * - false: form validated successfully but no changes needed persisting
   *
   * This determines the alert variant (success vs info) and message shown to the user.
   */
  const configWasPatched = useRef(false);
  const { ntp } = useConfig();
  const { hostname } = useProposal();
  const { hostname: transientHostname, static: staticHostname } = hostname;

  const ntpServers = ntp?.sources?.map((s) => s.address) || [];
  const usingTransientHostname = isEmpty(staticHostname) || isNullish(staticHostname);

  const form = useAppForm({
    ...systemFormOptions,
    defaultValues: {
      hostnameMode: isEmpty(staticHostname) ? HOSTNAME_MODE.TRANSIENT : HOSTNAME_MODE.STATIC,
      hostnameValue: usingTransientHostname ? transientHostname : staticHostname,
      ntpMode: ntpServers.length > 0 ? NTP_MODE.CUSTOM : NTP_MODE.DEFAULT,
      ntpServers,
    },
    validators: {
      onSubmitAsync: async ({ value: formValues, formApi }) => {
        configWasPatched.current = false;

        // Form pristine, nothing has changed for sure, skip everything
        if (!formApi.state.isDirty) return undefined;

        const fieldErrors = validateSystemForm(formValues);
        if (fieldErrors) return { fields: fieldErrors };

        const { fieldMeta } = formApi.state;

        const config = shake({
          hostname: buildHostnameConfig(formValues, fieldMeta),
          ntp: buildNtpConfig(formValues, fieldMeta),
        });

        // Form dirty but no actual changes nor backend patches needed
        if (isEmpty(config)) {
          form.reset(formValues);
          return undefined;
        }

        return await patchConfig(config)
          .then(() => {
            configWasPatched.current = true;
            form.reset(formValues);
            return undefined;
          })
          .catch(({ message: errorMessage }) => ({
            form: errorMessage,
          }));
      },
    },
  });

  return (
    <Page breadcrumbs={[{ label: _("System") }]}>
      <Page.Content>
        <form.AppForm>
          <Form
            id="systemForm"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
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

            <form.Subscribe
              selector={(s) =>
                s.isSubmitted && !s.isSubmitting && !s.errorMap.onSubmit?.form && !s.isDirty
              }
            >
              {(showResult) =>
                showResult && (
                  <Alert
                    isInline
                    variant={configWasPatched.current ? "success" : "info"}
                    title={
                      configWasPatched.current
                        ? // TRANSLATORS: success message shown after system settings are updated
                          _("System settings successfully updated")
                        : // TRANSLATORS: info message shown when submitting the form with no changes
                          _("No changes detected. System settings are already up to date.")
                    }
                  />
                )
              }
            </form.Subscribe>

            <HostnameSettings form={form} />
            <NtpSettings form={form} />

            <ActionGroup>
              {/* TRANSLATORS: button to save system settings changes */}
              <form.SubmitButton label={_("Accept")} />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}
