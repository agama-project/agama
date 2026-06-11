/*
 * Copyright (c) [2023-2026] SUSE LLC
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

import React, { useId, useState } from "react";
import {
  ActionGroup,
  Alert,
  Button,
  Content,
  Form,
  HelperText,
  HelperTextItem,
  Stack,
} from "@patternfly/react-core";
import LabelText from "~/components/form/LabelText";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { useProduct } from "~/hooks/model/config/product";
import { useIssues } from "~/hooks/model/issue";
import { putConfig } from "~/api";
import { useConfig } from "~/hooks/model/config";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { _ } from "~/i18n";

import { defaultOptions, validate } from "./fields";

/**
 * Form for registering a product with a registration server.
 */
export default function ProductRegistrationForm() {
  const loadingHintId = useId();
  const [loading, setLoading] = useState(false);
  const config = useConfig();
  const product = useProduct();
  const issues = useIssues("product");
  const registrationIssue = issues.find((i) => i.class === "system_registration_failed");

  // Track system query which refetches after putConfig completes (success or failure).
  // On success: parent sees new registration data and unmounts this component.
  // On failure: stops loading to show the error alert.
  const { startTracking } = useTrackQueriesRefetch(["system"], () => setLoading(false));

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, {
      server: isEmpty(product?.registrationUrl) ? "default" : "custom",
      url: product?.registrationUrl,
      code: product?.registrationCode,
      email: product?.registrationEmail,
    }),
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        return validate(formValues);
      },
    },
    onSubmit: ({ value: formValues }) => {
      const isUrlRequired = formValues.server !== "default";
      const isCodeRequired = formValues.server === "default";

      startTracking();
      setLoading(true);
      putConfig({
        ...config,
        product: {
          id: product.id,
          mode: product.mode,
          registrationCode:
            isCodeRequired || !isEmpty(formValues.code) ? formValues.code : undefined,
          registrationEmail: !isEmpty(formValues.email) ? formValues.email : undefined,
          registrationUrl: isUrlRequired ? formValues.url : undefined,
        },
      });
    },
  });

  const submitNoRegister = (e: React.SyntheticEvent) => {
    e.preventDefault();
    form.reset();
    startTracking();
    setLoading(true);
    putConfig({
      ...config,
      product: {
        id: product.id,
        mode: product.mode,
      },
    });
  };

  return (
    <form.AppForm>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          form.setErrorMap({ onSubmit: { fields: {} } });
          form.handleSubmit();
        }}
      >
        {!loading && registrationIssue && (
          <Alert
            isInline
            variant="danger"
            title={registrationIssue.description}
            actionLinks={
              <Button variant="control" isInline onClick={submitNoRegister}>
                {
                  // TRANSLATORS: button to dismiss the error alert and clear the registration data
                  _("Dismiss and clear registration data")
                }
              </Button>
            }
          >
            {registrationIssue.details && (
              <Content component="p">{registrationIssue.details}</Content>
            )}
          </Alert>
        )}

        <form.AppField
          name="server"
          listeners={{
            onChange: () => {
              form.setErrorMap({ onSubmit: { fields: {} } });
            },
          }}
        >
          {(field) => (
            <field.DropdownField
              label={_("Registration server")}
              options={[
                {
                  value: "default",
                  label: _("SUSE Customer Center (SCC)"),
                  description: _("Register using SUSE server"),
                },
                {
                  value: "custom",
                  label: _("Custom"),
                  description: _("Register using a custom registration server"),
                },
              ]}
            />
          )}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values.server}>
          {(server) => (
            <>
              {server === "custom" && (
                <form.AppField name="url">
                  {(field) => (
                    <field.TextField
                      label={_("Server URL")}
                      helperText={sprintf(_("E.g., %s"), "https://example.com")}
                      size={30}
                    />
                  )}
                </form.AppField>
              )}

              <form.AppField name="code">
                {(field) => (
                  <field.MaskedField
                    label={
                      <LabelText suffix={server === "custom" && _("(optional)")}>
                        {_("Registration code")}
                      </LabelText>
                    }
                    size={30}
                  />
                )}
              </form.AppField>
            </>
          )}
        </form.Subscribe>

        <form.AppField name="email">
          {(field) => (
            <field.EmailField
              label={<LabelText suffix={_("(optional)")}>{_("Email")}</LabelText>}
              size={30}
            />
          )}
        </form.AppField>

        <ActionGroup>
          <Stack hasGutter>
            <Button
              variant="primary"
              type="submit"
              isInline
              isLoading={loading}
              isDisabled={loading}
              aria-describedby={loading ? loadingHintId : undefined}
            >
              {_("Register")}
            </Button>
            {loading && (
              <HelperText id={loadingHintId} isLiveRegion>
                <HelperTextItem variant="indeterminate">
                  {_("Registration in progress")}
                </HelperTextItem>
              </HelperText>
            )}
          </Stack>
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}
