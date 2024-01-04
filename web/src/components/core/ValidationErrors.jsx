/*
 * Copyright (c) [2022-2023] SUSE LLC
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

// @ts-check

import React, { useState } from "react";
import { sprintf } from "sprintf-js";

import { _, n_ } from "~/i18n";
import { IssuesDialog } from "~/components/core";

/**
 * Displays validation errors for given section
 *
 * When there is only one error, it displays its message. Otherwise, it displays a generic message
 * which can be clicked to see more details in a popup dialog.
 *
 * @note It will retrieve issues for the area matching the first part of the
 * given sectionId. I.e., given an `storage-actions` id it will retrieve and
 * display issues for the `storage` area. If `software-patterns-conflicts` is
 * given instead, it will retrieve and display errors for the `software` area.
 *
 * @component
 *
 * @param {object} props
 * @param {string} props.sectionId - Id of the section which is displaying errors. ("product", "software", "storage", "storage-actions", ...)
 * @param {import("~/client/mixins").ValidationError[]} props.errors - Validation errors
 */
const ValidationErrors = ({ errors, sectionId: sectionKey }) => {
  const [showIssuesPopUp, setShowIssuesPopUp] = useState(false);

  const [sectionId,] = sectionKey?.split("-") || "";
  const dialogTitles = {
    // TRANSLATORS: Titles used for the popup displaying found section issues
    software: _("Software issues"),
    product: _("Product issues"),
    storage: _("Storage issues")
  };
  const dialogTitle = dialogTitles[sectionId] || _("Found Issues");

  if (!errors || errors.length === 0) return null;

  if (errors.length === 1) {
    return (
      <div className="color-warn">{errors[0].message}</div>
    );
  }

  return (
    <div className="color-warn">
      <button
        style={{ padding: "0", borderBottom: "1px solid" }}
        className="plain-control color-warn"
        onClick={() => setShowIssuesPopUp(true)}
      >
        {
          sprintf(
            // TRANSLATORS: %d is replaced with the number of errors found
            n_("%d error found", "%d errors found", errors.length),
            errors.length
          )
        }
      </button>

      <IssuesDialog
        isOpen={showIssuesPopUp}
        onClose={() => setShowIssuesPopUp(false)}
        sectionId={sectionId}
        title={dialogTitle}
      />
    </div>
  );
};

export default ValidationErrors;
