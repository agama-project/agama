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
import { ActionGroup, Alert, Form } from "@patternfly/react-core";
import { patchConfig } from "~/api";
import { useFormSubmit } from "~/hooks/use-form-submit";
import { useAppForm } from "~/hooks/form";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { _ } from "~/i18n";

import LanguageField from "./LanguageField";
import KeyboardField from "./KeyboardField";
import TimezoneField from "./TimezoneField";
import { defaultOptions } from "./fields";
import { buildL10nConfig, toFormValues } from "./transformations";
import { validate } from "./validations";
import { useL10nData } from "./queries";

import type { FormFields } from "./fields";
import type { L10nData } from "./queries";

/**
 * Form for configuring the localization settings of the product to install:
 * language, keyboard layout and time zone.
 *
 * Mirrors the system and authentication forms: a single form with one Accept
 * and one Cancel, staying mounted after submit (useFormSubmit) and reading its
 * frozen initial data via withFrozenQuery so the option lists and the current
 * selection do not shift while the user is editing.
 */
function L10nForm({ locales, keymaps, timezones, locale, keymap, timezone }: L10nData) {
  // useFormSubmit is initialized before useAppForm so onSubmitAsync can be
  // passed directly into the validators option.
  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<FormFields>({
    onSubmit: async (formValues, fieldMeta) => {
      const l10n = buildL10nConfig(formValues, fieldMeta);

      if (!l10n) return { noChanges: true };

      return patchConfig({ l10n })
        .then(() => ({ patched: true as const }))
        .catch(({ message }) => ({ error: message }));
    },
  });

  const form = useAppForm({
    ...defaultOptions,
    defaultValues: toFormValues({ locale, keymap, timezone }),
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
      <Form id="l10nForm" onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert
                isInline
                variant="danger"
                // TRANSLATORS: error message when the localization update request fails
                title={_("Changes could not be applied")}
              >
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Success / no-changes / validation error alerts — managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        <LanguageField form={form} locales={locales} />
        <KeyboardField form={form} keymaps={keymaps} />
        <TimezoneField form={form} timezones={timezones} />

        <ActionGroup>
          {/* TRANSLATORS: button to save the localization settings */}
          <form.SubmitButton label={_("Accept")} />
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

export default withFrozenQuery(useL10nData, L10nForm);
