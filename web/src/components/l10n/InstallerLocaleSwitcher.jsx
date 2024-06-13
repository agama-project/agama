/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useState } from "react";
import {
  Flex,
  Select, SelectList, SelectOption,
  MenuToggle
} from "@patternfly/react-core";
import { Icon } from "../layout";
import { _ } from "~/i18n";
import { useInstallerL10n } from "~/context/installerL10n";
import supportedLanguages from "~/languages.json";

export default function InstallerLocaleSwitcher() {
  const { language, changeLanguage } = useInstallerL10n();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(language);

  const onSelect = (_event, value) => {
    setIsOpen(false);
    setSelected(value);
    changeLanguage(value);
  };

  const toggle = toggleRef => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
      {supportedLanguages[selected]}
    </MenuToggle>
  );

  // sort by the language code to maintain consistent order
  const options = Object.keys(supportedLanguages).sort()
    .map(id => <SelectOption key={id} value={id}>{supportedLanguages[id]}</SelectOption>);

  return (
    <Flex gap={{ default: "gapMd" }} alignItems={{ default: "alignItemsCenter" }}>
      <div>
        <Icon name="translate" size="s" /> <b>{_("Language")}</b>
      </div>
      <Select
        id="language"
        isScrollable
        isOpen={isOpen}
        aria-label={_("Choose a language")}
        selected={selected}
        onSelect={onSelect}
        onOpenChange={(isOpen) => setIsOpen(isOpen)}
        toggle={toggle}
      >
        <SelectList>
          {options}
        </SelectList>
      </Select>
    </Flex>
  );
}
