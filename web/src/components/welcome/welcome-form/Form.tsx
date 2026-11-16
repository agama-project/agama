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

import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, Divider, Flex, Form, Grid, GridItem } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import SpinnerBackdrop from "~/components/core/SpinnerBackdrop";
import StickyActions from "~/components/core/StickyActions";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import Page from "~/components/layout/Page";
import KeyboardField from "~/components/l10n/shared/KeyboardField";
import SystemInformationSection from "~/components/overview/SystemInformationSection";
import { bestKeymapFor } from "~/components/l10n/shared/keyboards";
import { confirmLanguage } from "~/components/welcome/flags";
import { useInstallerL10n } from "~/context/installerL10n";
import { useAnnounce } from "~/context/announcer";
import { mergeFormDefaults, useAppForm } from "~/hooks/form";
import { useSystem } from "~/hooks/model/system";
import { ROOT } from "~/routes/paths";
import { localConnection } from "~/utils";
import { _ } from "~/i18n";

import LanguageField from "./LanguageField";
import { defaultOptions } from "./fields";
import { validate } from "./validations";
import { useVisit } from "./visit";

const FORM_ID = "languageAndKeyboardForm";

type WelcomeFormProps = {
  /** Introduction shown above the form, across the whole page. */
  intro: React.ReactNode;
};

/**
 * Form for the installer language and keyboard, laid out as the page content
 * with the system information aside and the action below.
 *
 * Both values apply as soon as they are picked, so the interface switches to
 * the new language right away; accepting only confirms them and leaves.
 *
 * On the machine itself, the keyboard follows the picked language: it changes
 * to the layout that best goes with it, says so below the field and offers the
 * one in use before it started following back. A language without a layout of
 * its own takes that one back. Once the user picks a keyboard, or takes the
 * previous one back, it stops following for the rest of the visit. From a
 * remote connection the keyboard cannot be changed, so it is only shown.
 */
export default function WelcomeForm({ intro }: WelcomeFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const announce = useAnnounce();
  const visit = useVisit();
  const { language, keymap, changeL10n } = useInstallerL10n();
  const keymaps = useSystem()?.l10n?.keymaps ?? [];
  const isLocal = localConnection();
  const [isSwitching, setIsSwitching] = useState(false);
  const [replacedKeymap, setReplacedKeymap] = useState(visit.replacedKeymap);
  const keyboardRef = useRef<HTMLDivElement>(null);

  const describeKeymap = (id: string) => keymaps.find((k) => k.id === id)?.description ?? id;

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, { language, keymap }),
    validators: { onSubmitAsync: async ({ value }) => validate(value) },
    onSubmit: () => {
      confirmLanguage();
      // Back where the user came from when opened from elsewhere; otherwise on
      // to whatever the installation needs next.
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? ROOT.root);
    },
  });

  // The language list took the focus back when rendered; nothing else to restore.
  useEffect(() => {
    visit.restoresFocus = false;
  }, [visit]);

  // The interface was switched to another language, and the keyboard with it:
  // tell screen reader users, who are still on the language list.
  useEffect(() => {
    if (!visit.isChangeUnannounced) return;
    visit.isChangeUnannounced = false;
    announce(
      sprintf(
        // TRANSLATORS: announced after picking a language changed the keyboard
        // layout too. %s is the keyboard layout, e.g. "German".
        _("Keyboard automatically set to %s to match the selected language."),
        describeKeymap(keymap),
      ),
    );
    // Only once, right after switching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forgetReplacedKeymap = () => {
    visit.replacedKeymap = undefined;
    setReplacedKeymap(undefined);
  };

  const switchLanguage = (newLanguage: string) => {
    const followsLanguage = isLocal && !visit.isKeymapChosen;
    // The one in use before the keyboard started following the language, kept
    // across languages, and forgotten once a language brings it back.
    const originalKeymap = visit.replacedKeymap ?? keymap;
    // A language without a layout of its own takes that one back.
    const resultingKeymap = followsLanguage
      ? (bestKeymapFor(newLanguage, keymaps) ?? originalKeymap)
      : keymap;
    const changesKeymap = resultingKeymap !== keymap;

    visit.replacedKeymap = resultingKeymap === originalKeymap ? undefined : originalKeymap;
    visit.isChangeUnannounced = changesKeymap;
    visit.restoresFocus = true;
    setIsSwitching(true);

    changeL10n({ language: newLanguage, ...(changesKeymap && { keymap: resultingKeymap }) })
      .catch((error) => {
        console.error(error);
        visit.restoresFocus = false;
        form.setFieldValue("language", language, { dontRunListeners: true });
      })
      .finally(() => setIsSwitching(false));
  };

  const chooseKeymap = (newKeymap: string) => {
    // A cleared field changes nothing yet; submitting asks for a keyboard.
    if (!newKeymap) return;
    visit.isKeymapChosen = true;
    forgetReplacedKeymap();
    changeL10n({ keymap: newKeymap }).catch(console.error);
  };

  const restoreReplacedKeymap = () => {
    visit.isKeymapChosen = true;
    form.setFieldValue("keymap", replacedKeymap, { dontRunListeners: true });
    changeL10n({ keymap: replacedKeymap }).catch(console.error);
    forgetReplacedKeymap();
    // The notice holding the action goes away; the keyboard field, which just
    // changed, takes the focus.
    keyboardRef.current?.querySelector("input")?.focus();
  };

  const keymapNotice = replacedKeymap && (
    <>
      {
        // TRANSLATORS: shown below the keyboard field after picking a language
        // changed the keyboard layout too
        _("Automatically set to match the selected language.")
      }{" "}
      <Button variant="link" isInline onClick={restoreReplacedKeymap}>
        {sprintf(
          // TRANSLATORS: action to go back to the keyboard layout in use before
          // picking a language. %s is the layout, e.g. "English (US)".
          _("Use %s instead"),
          describeKeymap(replacedKeymap),
        )}
      </Button>
    </>
  );

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
              >
                <form.AppField
                  name="language"
                  listeners={{ onChange: ({ value }) => switchLanguage(value) }}
                >
                  {() => <LanguageField focusSelected={visit.restoresFocus} />}
                </form.AppField>
                <Divider />
                <div ref={keyboardRef}>
                  <form.AppField
                    name="keymap"
                    listeners={{ onChange: ({ value }) => chooseKeymap(value) }}
                  >
                    {(field) =>
                      isLocal ? (
                        <KeyboardField
                          keymaps={keymaps}
                          helperText={keymapNotice}
                          helperTextIcon={keymapNotice && <Icon name="info" isMiddleAligned />}
                        />
                      ) : (
                        <field.ReadOnlyField
                          // TRANSLATORS: label for the keyboard layout
                          label={_("Keyboard")}
                          text={describeKeymap(keymap)}
                        >
                          <Text textStyle="textColorSubtle">
                            {/* TRANSLATORS: why the keyboard layout is only shown, when using the installer from another computer */}
                            {_("Cannot be changed in remote installation")}
                          </Text>
                        </field.ReadOnlyField>
                      )
                    }
                  </form.AppField>
                </div>
              </Form>
            </GridItem>
            <GridItem sm={12} md={4}>
              <SystemInformationSection />
            </GridItem>
          </Grid>
        </Flex>
      </Page.Content>
      <StickyActions>
        {/* TRANSLATORS: button confirming the language and keyboard */}
        <form.SubmitButton form={FORM_ID} label={_("Accept")} />
      </StickyActions>
      {isSwitching && (
        // TRANSLATORS: spoken while the interface switches to another language
        <SpinnerBackdrop label={_("Changing the language")} />
      )}
    </form.AppForm>
  );
}
