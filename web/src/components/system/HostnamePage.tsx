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
import { ActionGroup, Alert, Content, Form } from "@patternfly/react-core";
import { NestedContent, Page } from "~/components/core";
import Text from "~/components/core/Text";
import Interpolate from "~/components/core/Interpolate";
import { patchConfig } from "~/api";
import { useProposal } from "~/hooks/model/proposal";
import { useSystem } from "~/hooks/model/system";
import { useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

const HOSTNAME_MODE = {
  TRANSIENT: "transient",
  STATIC: "static",
} as const;

type HostnameMode = "transient" | "static";

/**
 * Displays information about the current transient hostname, including a note
 * that it may change after a reboot or network update.
 */
function TransientModeInfo({ transientHostname }: { transientHostname: string }) {
  return (
    <Content>
      <Content isEditorial className={spacingStyles.mbXs}>
        <Interpolate
          sentence={
            // TRANSLATORS: information shown when using transient hostname mode. "transient"
            // refers to the hostname mode, and %s will be replaced with the current hostname value.
            _("Current value: %s")
          }
        >
          {() => <Text isBold>{transientHostname}</Text>}
        </Interpolate>
      </Content>
      <Content component="small">
        <Interpolate
          sentence={
            // TRANSLATORS: explanation of transient hostname behavior.
            // Text in square brackets will be displayed in bold.
            _(
              "This hostname is dynamic and [may change after a reboot or network update], as configured by the local network administrator.",
            )
          }
        >
          {(text) => <Text isBold>{text}</Text>}
        </Interpolate>
      </Content>
    </Content>
  );
}
/**
 * Displays helper text explaining that a static hostname will persist across
 * reboots and network changes.
 */
function StaticModeInfo() {
  return (
    <Interpolate
      sentence={
        // TRANSLATORS: helper text for static hostname input.
        // Text in square brackets will be displayed in bold.
        _("Once set, will [persist across reboots and network changes].")
      }
    >
      {(text) => <Text isBold>{text}</Text>}
    </Interpolate>
  );
}

// Sets the form field types. Real initial values are set later based on the
// current hostname, but formOptions is needed here to enable TanStack Form type
// inference. These defaults are spread into useAppForm and overridden at
// runtime.
const hostnameFormOptions = formOptions({
  defaultValues: {
    mode: HOSTNAME_MODE.TRANSIENT as HostnameMode,
    value: "",
  },
});

/**
 * Page for configuring the system hostname.
 *
 * Allows the user to choose between a transient hostname (provided by the
 * network) or a static one (set manually), and persist the change.
 */
export default function HostnamePage() {
  const { software } = useSystem();
  const { hostname: proposal } = useProposal();
  const { hostname: transientHostname, static: staticHostname } = proposal;

  const form = useAppForm({
    ...hostnameFormOptions,
    defaultValues: {
      mode: isEmpty(staticHostname) ? HOSTNAME_MODE.TRANSIENT : HOSTNAME_MODE.STATIC,
      value: staticHostname,
    },
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        if (formValues.mode === HOSTNAME_MODE.STATIC && isEmpty(formValues.value)) {
          return {
            fields: {
              // TRANSLATORS: validation error when static hostname value is empty
              value: _("Enter a hostname value."),
            },
          };
        }

        return await patchConfig({
          hostname: {
            static: formValues.mode === HOSTNAME_MODE.STATIC ? formValues.value : "",
          },
        })
          .then(() => undefined)
          .catch(() => ({
            // TRANSLATORS: error message when hostname update request fails
            form: _("Hostname could not be updated"),
          }));
      },
    },
  });

  return (
    <Page breadcrumbs={[{ label: _("Hostname") }]}>
      <Page.Content>
        {software?.registration && (
          <Alert
            isInline
            variant="info"
            // TRANSLATORS: alert title warning about registered hostname not changing
            title={_("Registered hostname will not change")}
          >
            {
              // TRANSLATORS: explanation why registered hostname cannot be changed
              _(
                "The product is already registered. Changes made here will not affect the hostname stored at the registration server.",
              )
            }
          </Alert>
        )}

        <form.AppForm>
          <Form
            id="hostnameForm"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
              {(serverError) =>
                serverError && (
                  <Alert
                    // TRANSLATORS: error alert title when hostname update fails
                    title={_("The hostname could not be saved")}
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
                  // TRANSLATORS: success message shown after hostname is updated
                  <Alert variant="success" isInline title={_("Hostname successfully updated")} />
                )
              }
            </form.Subscribe>

            <form.AppField name="mode">
              {(field) => (
                <field.DropdownField
                  // TRANSLATORS: label for hostname mode selector
                  label={_("Mode")}
                  options={[
                    {
                      value: HOSTNAME_MODE.TRANSIENT,
                      // TRANSLATORS: hostname mode option
                      label: _("Transient"),
                      // TRANSLATORS: description for transient hostname mode
                      description: _("Provided by the network"),
                    },
                    {
                      value: HOSTNAME_MODE.STATIC,
                      // TRANSLATORS: hostname mode option
                      label: _("Static"),
                      // TRANSLATORS: description for static hostname mode
                      description: _("Set manually"),
                    },
                  ]}
                />
              )}
            </form.AppField>

            <form.Subscribe selector={(s) => s.values.mode}>
              {(mode) => (
                <NestedContent margin="mxLg">
                  {mode === HOSTNAME_MODE.TRANSIENT && (
                    <TransientModeInfo transientHostname={transientHostname} />
                  )}
                  {mode === HOSTNAME_MODE.STATIC && (
                    <form.AppField name="value">
                      {(field) => (
                        <field.TextField
                          // TRANSLATORS: label for static hostname input
                          label={_("Value")}
                          helperText={<StaticModeInfo />}
                        />
                      )}
                    </form.AppField>
                  )}
                </NestedContent>
              )}
            </form.Subscribe>

            <ActionGroup>
              {/* TRANSLATORS: button to save hostname changes */}
              <form.SubmitButton label={_("Accept")} />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}
