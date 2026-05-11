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
import { isEmpty } from "radashi";
import { formOptions } from "@tanstack/react-form";
import { ActionGroup, Alert, Form } from "@patternfly/react-core";
import { Page } from "~/components/core";
import HostnameSettings from "~/components/system/HostnameSettings";
import NtpSettings from "~/components/system/NtpSettings";
import { patchConfig } from "~/api";
import { useProposal } from "~/hooks/model/proposal";
import { useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";

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

/**
 * Page for configuring system settings.
 *
 * Allows the user to configure:
 * - Hostname: choose between a transient hostname (provided by the network) or
 *   a static one (set manually)
 * - NTP: choose between default NTP servers or custom ones
 */
export default function SystemPage() {
  const { hostname: proposal } = useProposal();
  const { hostname: transientHostname, static: staticHostname } = proposal;

  const form = useAppForm({
    ...systemFormOptions,
    defaultValues: {
      hostnameMode: isEmpty(staticHostname) ? HOSTNAME_MODE.TRANSIENT : HOSTNAME_MODE.STATIC,
      hostnameValue: staticHostname || transientHostname,
      ntpMode: NTP_MODE.DEFAULT as NtpMode,
      ntpServers: [] as string[],
    },
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        const errors: { fields?: Record<string, string> } = {};

        if (formValues.hostnameMode === HOSTNAME_MODE.STATIC && isEmpty(formValues.hostnameValue)) {
          errors.fields = {
            // TRANSLATORS: validation error when static hostname value is empty
            hostnameValue: _("Enter a hostname value."),
          };
        }

        if (Object.keys(errors).length > 0) {
          return errors;
        }

        return await patchConfig({
          hostname: {
            static:
              formValues.hostnameMode === HOSTNAME_MODE.STATIC ? formValues.hostnameValue : "",
          },
          ntp: {
            sources:
              formValues.ntpMode === NTP_MODE.CUSTOM
                ? formValues.ntpServers.map((address) => ({
                    type: "pool",
                    address,
                    iburst: true,
                    offline: false,
                  }))
                : [],
          },
        })
          .then(() => undefined)
          .catch(() => ({
            // TRANSLATORS: error message when system settings update request fails
            form: _("System settings could not be updated"),
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
                    // TRANSLATORS: error alert title when system settings update fails
                    title={_("The system settings could not be saved")}
                    variant="danger"
                  >
                    {serverError}
                  </Alert>
                )
              }
            </form.Subscribe>

            <form.Subscribe
              selector={(s) => ({
                showSuccess: s.isSubmitted && s.isSubmitting === false,
                hasError: !!s.errorMap.onSubmit?.form,
              })}
            >
              {({ showSuccess, hasError }) =>
                showSuccess &&
                !hasError && (
                  <Alert
                    variant="success"
                    isInline
                    // TRANSLATORS: success message shown after system settings are updated
                    title={_("System settings successfully updated")}
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
