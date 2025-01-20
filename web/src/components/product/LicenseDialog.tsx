/*
 * Copyright (c) [2025] SUSE LLC
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
import { Popup } from "~/components/core";
import { _ } from "~/i18n";
import {
  MenuToggle,
  ModalProps,
  Select,
  SelectOption,
  Split,
  SplitItem,
  Stack,
} from "@patternfly/react-core";
import { Product } from "~/types/software";
import { fetchLicense } from "~/api/software";
import { useInstallerL10n } from "~/context/installerL10n";
import supportedLanguages from "~/languages.json";

function LicenseDialog({ onClose, product }: { onClose: ModalProps["onClose"]; product: Product }) {
  const { language: uiLanguage } = useInstallerL10n();
  const [language, setLanguage] = useState<string>(uiLanguage);
  const [license, setLicense] = useState<string>();
  const [languageSelectorOpen, setLanguageSelectorOpen] = useState(false);
  const localesToggler = (toggleRef) => (
    <MenuToggle
      aria-label={_("License language")}
      ref={toggleRef}
      onClick={() => setLanguageSelectorOpen(!languageSelectorOpen)}
      isExpanded={languageSelectorOpen}
    >
      {supportedLanguages[language]}
    </MenuToggle>
  );

  useEffect(() => {
    language && fetchLicense(product.license, language).then(({ body }) => setLicense(body));
  }, [language, product.license]);

  const onLocaleSelection = (_, lang: string) => {
    setLanguage(lang);
    setLanguageSelectorOpen(false);
  };

  return (
    <Popup
      inlineSize="auto"
      isOpen
      title={
        <>
          <Split hasGutter>
            <SplitItem isFilled>
              <h1>{product.name}</h1>
            </SplitItem>
            <Select
              isOpen={languageSelectorOpen}
              selected={language}
              onSelect={onLocaleSelection}
              onOpenChange={(isOpen) => setLanguageSelectorOpen(!isOpen)}
              toggle={localesToggler}
            >
              {Object.entries(supportedLanguages).map(([id, name]) => (
                <SelectOption key={id} value={id}>
                  {name}
                </SelectOption>
              ))}
            </Select>
          </Split>
        </>
      }
    >
      <Stack hasGutter>
        <pre>{license}</pre>
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onClose}>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}

export default LicenseDialog;
