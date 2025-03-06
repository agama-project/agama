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
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  ModalProps,
  Stack,
} from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { Product } from "~/types/software";
import { fetchLicense } from "~/api/software";
import { useInstallerL10n } from "~/context/installerL10n";
import supportedLanguages from "~/languages.json";
import { _ } from "~/i18n";

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
      isOpen
      title={product.name}
      titleAddon={
        <Dropdown
          isOpen={languageSelectorOpen}
          selected={language}
          onSelect={onLocaleSelection}
          onOpenChange={(isOpen) => setLanguageSelectorOpen(!isOpen)}
          toggle={localesToggler}
          isScrollable
          popperProps={{ position: "right" }}
        >
          <DropdownList>
            {Object.entries(supportedLanguages).map(([id, name]) => (
              <DropdownItem key={id} value={id}>
                {name}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      }
      width="auto"
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
