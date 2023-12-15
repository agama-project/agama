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

import React from "react";
import { _ } from "~/i18n";

/**
 * Displays additional info when running in a development server
 * @component
 */
export default function DevelopmentInfo () {
  if (!process.env.WEBPACK_SERVE) return;

  let cockpitServer = COCKPIT_TARGET_URL;

  if (COCKPIT_TARGET_URL.includes("localhost") && window.location.hostname !== "localhost") {
    const urlTarget = new URL(COCKPIT_TARGET_URL);
    const url = new URL(window.location);
    url.port = urlTarget.port;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    cockpitServer = url;
  }

  /* NOTE: Using rel="noreferrer" below just for pleasing eslint, since all major browser already uses noreferrer
   * implicitly when using target="_blank"
   *
   * https://html.spec.whatwg.org/multipage/links.html#link-type-noreferrer
   * https://chromestatus.com/feature/6140064063029248
   * https://blog.mozilla.org/security/2021/03/22/firefox-87-trims-http-referrers-by-default-to-protect-user-privacy/
   */
  return (
    // TRANSLATORS: label for the Cockpit web user interface, used only in
    // development mode. See https://documentation.suse.com/alp/dolomite/html/cockpit-alp-dolomite/index.html
    <p>
      {_("Cockpit server")}: <a href={cockpitServer} target="_blank" rel="noreferrer">{cockpitServer}</a>
    </p>
  );
}
