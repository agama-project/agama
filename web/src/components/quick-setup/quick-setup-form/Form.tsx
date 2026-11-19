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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Divider,
  Flex,
  Form,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { getStorageModel, patchConfig, putConfig, putStorageModel } from "~/api";
import ProgressBackdrop from "~/components/core/ProgressBackdrop";
import StickyActions from "~/components/core/StickyActions";
import Page from "~/components/layout/Page";
import TimezoneField from "~/components/l10n/shared/TimezoneField";
import { useInstallerL10nForProduct } from "~/components/l10n/shared/product-l10n";
import SystemInformationSection from "~/components/overview/SystemInformationSection";
import { useAppForm } from "~/hooks/form";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

import AuthenticationFields from "./AuthenticationFields";
import ProductFields from "./ProductFields";
import StorageFields from "./StorageFields";
import { defaultOptions } from "./fields";
import { useQuickSetupData } from "./queries";
import { modelDisks } from "./storage";
import { buildConfig, buildStorageModel, changesProduct, toFormValues } from "./transformations";
import { missingSummary, validate } from "./validations";

import type { FormFields } from "./fields";

const FORM_ID = "quickSetupForm";
const NOTE_ID = "quickSetupNote";

type QuickSetupFormProps = {
  /** Introduction shown above the form, across the whole page. */
  intro: React.ReactNode;
  /** Whether the product cannot change, as on a registered system. */
  isProductLocked?: boolean;
};

/**
 * Form for what every installation needs and Agama cannot guess: the product,
 * the disk and what to do with what is on it, how to log in, and the location.
 * Laid out as the page content, with the system information aside and the
 * action below.
 *
 * Nothing is saved until accepted. Accept stays unavailable until every field
 * has a value, with a note below it saying so. Reopened, it can be cancelled,
 * going back to where the user came from. The config goes first; the storage setup depends on the
 * product, so it goes once the installer reports the product, and then the
 * form leaves for the overview.
 */
export default function QuickSetupForm({ intro, isProductLocked = false }: QuickSetupFormProps) {
  const navigate = useNavigate();
  const data = useQuickSetupData();
  const installerL10nForProduct = useInstallerL10nForProduct();
  // Taken once: later changes reported by the installer must not reset what
  // the user is filling in.
  const [initialValues] = useState(() => toFormValues(data));
  // Only a storage setup made elsewhere is told about; one Quick setup made
  // shows in its own fields.
  const [customDisks] = useState(() =>
    initialValues.keepsCustomStorage ? modelDisks(data.storageModel) : [],
  );
  // The accounts already set are told as they were when opening: those saved
  // on accepting must not show as set before while leaving.
  const [initialConfig] = useState(() => data.config);
  // Reopened, with a product set already, the screen can be left as it was.
  const [isReopened] = useState(() => !!data.currentProduct);
  // While applying, what is being done, told over the screen until leaving.
  const [applyingLabel, setApplyingLabel] = useState<string>();
  // What was saved, waiting for the installer to report the product.
  const [saved, setSaved] = useState<{ values: FormFields; setsStorage: boolean }>();

  /** Whether the values replace a storage setup made elsewhere. */
  const replacesCustomStorage = (formValues: FormFields) =>
    initialValues.keepsCustomStorage &&
    !formValues.keepsCustomStorage &&
    !changesProduct(formValues, data);

  const form = useAppForm({
    ...defaultOptions,
    defaultValues: initialValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const fieldErrors = validate(value, data);
        if (fieldErrors) return fieldErrors;

        // Changing the product resets the config (bsc#1264438), so it goes
        // with everything else in a single request.
        const resetsConfig = changesProduct(value, data);
        const setsProduct = !data.currentProduct || resetsConfig;
        const replacesStorage = replacesCustomStorage(value);
        const replacesAccounts = initialValues.keepsAuthentication && !value.keepsAuthentication;
        const config = buildConfig(value, {
          config: data.config,
          setsProduct,
          installerL10n: setsProduct ? installerL10nForProduct(resetsConfig) : undefined,
        });

        const productName = data.products.find((p) => p.id === value.product)?.name;
        setApplyingLabel(
          setsProduct && productName
            ? // TRANSLATORS: shown over the screen while the installer gets
              // ready with the picked product. %s is the product name.
              sprintf(_("Setting up %s..."), productName)
            : // TRANSLATORS: shown over the screen while the settings are saved
              _("Applying the settings..."),
        );

        try {
          if (resetsConfig) {
            await putConfig(config);
          } else if (replacesStorage || replacesAccounts) {
            // Dropping what was set takes the whole config. Without the
            // storage one the product proposal comes back, which the picked
            // disk then adjusts.
            await putConfig({
              ...data.config,
              ...config,
              l10n: { ...data.config?.l10n, ...config.l10n },
              storage: replacesStorage ? undefined : data.config?.storage,
              user: config.user,
              root: config.root,
            });
          } else {
            await patchConfig(config);
          }
        } catch (error) {
          setApplyingLabel(undefined);
          return { form: error.message };
        }
      },
    },
    onSubmit: ({ value }) => {
      const changesStorage =
        value.disk !== initialValues.disk ||
        value.existingContent !== initialValues.existingContent;
      const keepsStorage = value.keepsCustomStorage && !changesProduct(value, data);
      setSaved({
        values: value,
        setsStorage:
          !keepsStorage &&
          (!data.currentProduct ||
            changesProduct(value, data) ||
            replacesCustomStorage(value) ||
            changesStorage),
      });
    },
  });

  // The overview and the storage setup need the product: once the installer
  // reports it, save the storage setup if needed, then leave.
  useEffect(() => {
    if (!saved || data.currentProduct?.id !== saved.values.product) return;

    const saveStorage = async () => {
      if (!saved.setsStorage) return;
      const model = buildStorageModel(saved.values, await getStorageModel(), data.storageSystem);
      if (model) await putStorageModel(model);
    };

    saveStorage()
      .then(() => navigate(ROOT.root))
      .catch((error) => {
        setSaved(undefined);
        setApplyingLabel(undefined);
        form.setErrorMap({ onSubmit: { form: error.message } });
      });
    // Only when the installer reports the saved product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, data.currentProduct]);

  return (
    <form.AppForm>
      <Page.Content>
        <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
          {intro}
          <Divider />
          <Grid hasGutter>
            <GridItem sm={12} md={8}>
              <Form
                id={FORM_ID}
                onSubmit={(e) => {
                  e.preventDefault();
                  form.setErrorMap({ onSubmit: { fields: {} } });
                  form.handleSubmit();
                }}
                // @ts-expect-error: https://www.codegenes.net/blog/error-when-using-inert-attribute-with-typescript/
                inert={saved ? "" : undefined}
              >
                <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
                  {(serverError) =>
                    serverError && (
                      <Alert
                        isInline
                        variant="danger"
                        // TRANSLATORS: error title when saving Quick setup fails
                        title={_("Changes could not be applied")}
                      >
                        {serverError}
                      </Alert>
                    )
                  }
                </form.Subscribe>
                <ProductFields form={form} data={data} isLocked={isProductLocked} />
                <Divider />
                <StorageFields form={form} data={data} customDisks={customDisks} />
                <Divider />
                <AuthenticationFields form={form} config={initialConfig} />
                <Divider />
                <form.AppField name="timezone">
                  {() => (
                    <TimezoneField
                      timezones={data.timezones}
                      // TRANSLATORS: label of the time zone field, named after
                      // what the user knows: where the machine is
                      label={_("Location")}
                      // TRANSLATORS: shown in the location field until a time
                      // zone is picked
                      emptyPlaceholder={_("Select a time zone")}
                    />
                  )}
                </form.AppField>
              </Form>
            </GridItem>
            <GridItem sm={12} md={4}>
              <SystemInformationSection />
            </GridItem>
          </Grid>
        </Flex>
        {/* Shown from accepting, following whatever the installer reports
            meanwhile, until leaving for the overview. */}
        {applyingLabel && <ProgressBackdrop isShown waitingLabel={applyingLabel} />}
      </Page.Content>
      <StickyActions>
        <form.Subscribe selector={(s) => missingSummary(s.values, data)}>
          {(missing) => (
            <Flex
              direction={{ default: "column" }}
              alignItems={{ default: "alignItemsFlexStart" }}
              gap={{ default: "gapSm" }}
            >
              <Flex gap={{ default: "gapMd" }}>
                <form.SubmitButton
                  form={FORM_ID}
                  // TRANSLATORS: button saving Quick setup
                  label={_("Accept")}
                  // Looks unavailable but stays focusable, so the note telling
                  // what is missing is announced with it.
                  isAriaDisabled={!!missing}
                  isLoading={!!saved}
                  aria-describedby={missing ? NOTE_ID : undefined}
                />
                {isReopened && <form.CancelButton isDisabled={!!saved} />}
              </Flex>
              {missing && (
                <HelperText id={NOTE_ID}>
                  <HelperTextItem>{missing}</HelperTextItem>
                </HelperText>
              )}
            </Flex>
          )}
        </form.Subscribe>
      </StickyActions>
    </form.AppForm>
  );
}
