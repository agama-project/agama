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

import React, { useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

import cockpit from "./lib/cockpit";

/**
 * This is a helper component to set the language used in the backend service.
 * It ensures the backend service uses the same language as the web frontend.
 * To activate a new language it reloads the whole page.
 *
 * It behaves like a wrapper, it just wraps the children components, it does
 * not render any real content.
 *
 * @param {React.ReactNode} [props.children] - content to display within the
 * wrapper
 */
export default function L10nBackendWrapper({ children }) {
  const { language: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncBackendLanguage = async () => {
      // cockpit uses "pt-br" format, convert that to the usual Linux locale "pt_BR" style
      let [lang, country] = cockpit.language.split("-");
      country = country?.toUpperCase();
      const cockpitLocale = lang + (country ? "_" + country : "");
      const currentLang = await cancellablePromise(client.getUILanguage());

      if (currentLang !== cockpitLocale) {
        await cancellablePromise(client.setUILanguage(cockpitLocale));
        // reload the whole page to force retranslation of all texts
        window.location.reload(true);
      }
    };

    syncBackendLanguage().catch(console.error)
      .finally(() => setLoading(false));
  }, [client, cancellablePromise]);

  // display empty page while loading
  return loading ? <></> : children;
}
