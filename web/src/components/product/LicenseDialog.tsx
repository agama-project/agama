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

import React, { useEffect, useState } from "react";
import { Alert, ModalProps, Stack } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import type { License } from "~/model/system";
import { getLicense } from "~/api";
import { useInstallerL10n } from "~/context/installerL10n";
import { sprintf } from "sprintf-js";
import supportedLanguages from "~/languages.json";
import { _ } from "~/i18n";

const MissingTranslation = ({ missing }) => {
  const missingLanguage = supportedLanguages[missing];

  return (
    <Alert
      isPlain
      variant="info"
      title={sprintf(_("This license is not available in %s."), missingLanguage)}
    />
  );
};

const languagesMatches = (language1: string, language2: string) => {
  const [lang1] = language1.split("-");
  const [lang2] = language2.split("-");
  return lang1 === lang2;
};

type LicenseDialogProps = {
  /** The license to display */
  license: License;
  /** The dialog title, the license name by default */
  title?: string;
  /** Callback fired when the dialog is closed */
  onClose: ModalProps["onClose"];
};

function LicenseDialog({ license, title = license.name, onClose }: LicenseDialogProps) {
  const { language: uiLanguage } = useInstallerL10n();
  const [licenseLanguage, setLicenseLanguage] = useState<string | null>(undefined);
  const [licenseContent, setLicenseContent] = useState<string>();

  useEffect(() => {
    getLicense(license.id).then(({ body, language }) => {
      setLicenseContent(body);
      setLicenseLanguage(language);
    });
  }, [license.id]);

  return (
    <Popup isOpen title={title} width="auto">
      <Stack hasGutter>
        {licenseLanguage && !languagesMatches(uiLanguage, licenseLanguage) && (
          <MissingTranslation missing={uiLanguage} />
        )}
        <pre>{licenseContent}</pre>
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onClose}>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}

export default LicenseDialog;
