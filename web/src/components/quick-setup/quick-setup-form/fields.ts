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

/**
 * Quick setup form fields: types, constants and defaults.
 *
 * Every field starts empty, so each value is one the user picked. The product
 * fields hold ids; the authentication choice decides which of the user and
 * root fields count.
 */

import { formOptions } from "@tanstack/react-form";

/** How the user logs in to the installed system. */
export const AUTHENTICATION = {
  /** Nothing set here: left to the authentication page. */
  LATER: "later",
  /** An administrator user, with no root account. */
  USER: "user",
  /** A root password, with no other user. */
  ROOT: "root",
} as const;

export type Authentication = (typeof AUTHENTICATION)[keyof typeof AUTHENTICATION];

/** What to do with what is already on the installation disk. */
export const EXISTING_CONTENT = {
  /** Delete everything on the disk and use all of it. */
  DELETE: "delete",
  /** Shrink partitions as needed, deleting nothing. */
  RESIZE: "resize",
} as const;

export type ExistingContent = (typeof EXISTING_CONTENT)[keyof typeof EXISTING_CONTENT];

type FormFields = {
  product: string;
  mode: string;
  acceptedLicenses: string[];
  timezone: string;
  /** Name of the installation disk (e.g. "/dev/sda"). */
  disk: string;
  existingContent: ExistingContent | "";
  /**
   * Control field: whether a storage setup made elsewhere is kept, which only
   * happens while no disk is picked here. Set from the storage model.
   */
  keepsCustomStorage: boolean;
  /**
   * Control field: whether the accounts already set (e.g. from a profile, or
   * on reopening Quick setup) are kept as they are, until the user asks to
   * change them. Set from the config.
   */
  keepsAuthentication: boolean;
  authentication: Authentication | "";
  fullName: string;
  userName: string;
  /**
   * Control field: usernames suggested from the full name, updated when the
   * full name field is left. Read by the username field only.
   */
  usernameSuggestions: string[];
  userPassword: string;
  userPasswordConfirmation: string;
  rootPassword: string;
  rootPasswordConfirmation: string;
};

const defaultValues: FormFields = {
  product: "",
  mode: "",
  acceptedLicenses: [],
  timezone: "",
  disk: "",
  existingContent: "",
  keepsCustomStorage: false,
  keepsAuthentication: false,
  authentication: "",
  fullName: "",
  userName: "",
  usernameSuggestions: [],
  userPassword: "",
  userPasswordConfirmation: "",
  rootPassword: "",
  rootPasswordConfirmation: "",
};

export const defaultOptions = formOptions({ defaultValues });

export type { FormFields };
