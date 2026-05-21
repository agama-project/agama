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
import { useNavigate } from "react-router";
import { castArrayIfExists, isNullish } from "radashi";
import { Alert, ActionGroup, Form } from "@patternfly/react-core";
import LabelText from "~/components/form/LabelText";
import Page from "~/components/core/Page";
import PasswordCheck from "~/components/users/PasswordCheck";
import PasswordFields from "./PasswordFields";
import PreservedValueField from "~/components/form/PreservedValueField";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useConfig } from "~/hooks/model/config";
import { patchConfig } from "~/api";
import { suggestUsernames } from "~/components/users/utils";
import { USER } from "~/routes/paths";
import { defaultOptions, isPrivateKey, isValidSshKey, validate } from "./fields";
import { _ } from "~/i18n";

import type { User } from "~/model/config";

type FirstUserFormContentProps = {
  defaults?: Partial<typeof defaultOptions.defaultValues>;
};

function FirstUserFormContent({ defaults }: FirstUserFormContentProps) {
  const navigate = useNavigate();
  const { user: firstUser } = useConfig();

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, defaults),
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        const fieldErrors = validate(formValues);
        if (fieldErrors) return fieldErrors;

        // Build payload
        const data: User.Config = {
          fullName: formValues.fullName,
          userName: formValues.userName,
          password: formValues.usingHashedPassword
            ? firstUser?.password || ""
            : formValues.password,
          hashedPassword: formValues.usingHashedPassword,
          sshPublicKey: formValues.sshPublicKey,
        };

        try {
          await patchConfig({ user: data });
        } catch (e) {
          return { form: e.message };
        }
      },
    },
    onSubmit: () => navigate(-1),
  });

  return (
    <form.AppForm>
      <Form
        id="firstUserForm"
        isWidthLimited
        maxWidth="fit-content"
        onSubmit={(e) => {
          e.preventDefault();
          form.setErrorMap({ onSubmit: { fields: {} } });
          form.handleSubmit();
        }}
      >
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline title={_("Something went wrong")} variant="warning">
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        <form.AppField
          name="fullName"
          listeners={{
            onBlur: ({ value }) => {
              const suggestions = suggestUsernames(value);
              form.setFieldValue("usernameSuggestions", suggestions);
            },
          }}
        >
          {(field) => <field.TextField label={_("Full name")} />}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values.usernameSuggestions}>
          {(suggestions) => (
            <form.AppField name="userName">
              {(field) => (
                <field.SuggestionsTextField label={_("Username")} suggestions={suggestions} />
              )}
            </form.AppField>
          )}
        </form.Subscribe>

        <form.Subscribe selector={(s) => s.values.usingHashedPassword}>
          {(usingHashedPassword) => (
            <PreservedValueField
              preservedMessage={_("Using a hashed password.")}
              isPreserving={usingHashedPassword}
              onEdit={() => form.setFieldValue("usingHashedPassword", false)}
            >
              <PasswordFields form={form} />
              <form.Subscribe selector={(s) => s.values.password}>
                {(password) => <PasswordCheck password={password} />}
              </form.Subscribe>
            </PreservedValueField>
          )}
        </form.Subscribe>

        <form.AppField name="sshPublicKey">
          {(field) => (
            <field.ArrayField
              // TRANSLATORS: label for NTP servers input field
              label={<LabelText suffix={_("(optional)")}>{_("SSH Public Keys")}</LabelText>}
              skipDuplicates
              maxEntryWidth={60}
              splitPasteOn={/\r?\n/}
              validateOnSubmit={(v) =>
                // TRANSLATORS: validation error for an invalid NTP server address entry
                isValidSshKey(v) && !isPrivateKey(v) ? undefined : _("Invalid SSH Key")
              }
              helperText={
                // TRANSLATORS: helper text for SSH Public Keys.
                _("Enter or paste your public keys.")
              }
            />
          )}
        </form.AppField>

        <ActionGroup>
          <Page.Submit form="firstUserForm" />
          <Page.Cancel />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

export default function FirstUserForm() {
  const { user: firstUser } = useConfig();
  const isEditing = !isNullish(firstUser);

  return (
    <Page
      breadcrumbs={[
        { label: _("Authentication"), path: USER.root },
        { label: isEditing ? _("Edit user") : _("Create user") },
      ]}
    >
      <Page.Content>
        <FirstUserFormContent
          defaults={{
            fullName: firstUser?.fullName,
            userName: firstUser?.userName,
            usingHashedPassword: firstUser?.hashedPassword,
            sshPublicKey: castArrayIfExists(firstUser?.sshPublicKey),
          }}
        />
      </Page.Content>
    </Page>
  );
}
