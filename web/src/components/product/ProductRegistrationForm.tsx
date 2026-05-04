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

import React, { useEffect, useId, useRef, useState } from "react";
import {
  ActionGroup,
  Alert,
  Button,
  Flex,
  Form,
  HelperText,
  HelperTextItem,
  Stack,
} from "@patternfly/react-core";
import { formOptions } from "@tanstack/react-form";
import LabelText from "~/components/form/LabelText";
import { isEmpty, shake } from "radashi";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { useSystem } from "~/hooks/model/system/software";
import { useProduct } from "~/hooks/model/config/product";
import { useIssues } from "~/hooks/model/issue";
import { putConfig } from "~/api";
import { useConfig } from "~/hooks/model/config";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";

type ServerOption = "default" | "custom";

/**
 * Form options for product registration.
 *
 * Type casts widen literal defaults to their union types, allowing fields
 * to accept any value from the union.
 */
const registrationFormOptions = formOptions({
  defaultValues: {
    server: "default" as ServerOption,
    url: "",
    code: "",
    email: "",
  },
});

type FormValues = typeof registrationFormOptions.defaultValues;
type FormFieldErrors = Partial<Record<keyof FormValues, string>>;

/**
 * Validates the registration form values.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
function validateRegistrationForm(formValues: FormValues): FormFieldErrors | undefined {
  const errors: FormFieldErrors = {};

  if (formValues.server === "custom" && isEmpty(formValues.url)) {
    // TRANSLATORS: validation error for the registration server URL field.
    errors.url = _("Enter a server URL");
  }

  if (formValues.server === "default" && isEmpty(formValues.code)) {
    // TRANSLATORS: validation error for the registration code field.
    errors.code = _("Enter a registration code");
  }

  const fieldErrors = shake(errors);

  if (!isEmpty(fieldErrors)) return fieldErrors;
}

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
  const { registration } = useSystem();
  const prevRegistrationRef = useRef(registration);
  const prevRegistrationIssueRef = useRef(registrationIssue);

  const form = useAppForm({
    ...mergeFormDefaults(registrationFormOptions, {
      server: isEmpty(product?.registrationUrl) ? "default" : "custom",
      url: product?.registrationUrl || "",
      code: product?.registrationCode || "",
      email: product?.registrationEmail || "",
    }),
    validators: {
      onSubmitAsync: async ({ value }) => {
        const fieldErrors = validateRegistrationForm(value);
        if (fieldErrors) return { fields: fieldErrors };
      },
    },
    onSubmit: ({ value }) => {
      const isUrlRequired = value.server !== "default";
      const isCodeRequired = value.server === "default";

      prevRegistrationRef.current = registration;
      prevRegistrationIssueRef.current = registrationIssue;
      setLoading(true);
      putConfig({
        ...config,
        product: {
          id: product.id,
          mode: product.mode,
          registrationCode: isCodeRequired || !isEmpty(value.code) ? value.code : undefined,
          registrationEmail: !isEmpty(value.email) ? value.email : undefined,
          registrationUrl: isUrlRequired ? value.url : undefined,
        },
      });
    },
  });

  useEffect(() => {
    if (!loading) return;

    const registrationChanged = registration !== prevRegistrationRef.current;
    const issueChanged = registrationIssue !== prevRegistrationIssueRef.current;

    if (registrationChanged || issueChanged) {
      setLoading(false);
    }
  }, [loading, registration, registrationIssue]);

  const submitNoRegister = (e: React.SyntheticEvent) => {
    e.preventDefault();
    form.reset();
    prevRegistrationRef.current = registration;
    prevRegistrationIssueRef.current = registrationIssue;
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
          <Alert isInline variant="warning" title={registrationIssue.description}>
            {registrationIssue.details && <p>{registrationIssue.details}</p>}
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
                      helperText={sprintf(_("Example: %s"), "https://example.com")}
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
            <Flex>
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
              {!loading && registrationIssue && (
                <Button variant="link" type="submit" isInline onClick={submitNoRegister}>
                  {_("Do not register")}
                </Button>
              )}
            </Flex>
            {loading && (
              <HelperText id={loadingHintId} isLiveRegion>
                <HelperTextItem variant="indeterminate">
                  {_("Registration in progress")}
                </HelperTextItem>
              </HelperText>
            )}
          </Stack>
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}
