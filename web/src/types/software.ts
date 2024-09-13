/*
 * Copyright (c) [2024] SUSE LLC
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

/**
 * Enum for the reasons to select a pattern
 */
enum SelectedBy {
  /** Selected by the user */
  USER = 0,
  /** Automatically selected as a dependency of another package */
  AUTO = 1,
  /** No selected */
  NONE = 2,
}

type Product = {
  /** Product ID (e.g., "Leap") */
  id: string;
  /** Product name (e.g., "openSUSE Leap 15.4") */
  name: string;
  /** Product description */
  description: string;
  /** Product icon (e.g., "default.svg") */
  icon: string;
};

type PatternsSelection = { [key: string]: SelectedBy };

type SoftwareProposal = {
  /** Used space in human-readable form */
  size: string;
  /** Selected patterns and the reason */
  patterns: PatternsSelection;
};

type SoftwareConfig = {
  /** Product to install */
  product?: string;
  /** An object where the keys are the pattern names and the values whether to install them or not */
  patterns?: { [key: string]: boolean };
};

type Pattern = {
  /** Pattern name (internal ID) */
  name: string;
  /** Pattern category */
  category: string;
  /** User visible pattern name */
  summary: string;
  /** Long description of the pattern */
  description: string;
  /** {number} order - Display order (string!) */
  order: number;
  /** Icon name (not path or file name!) */
  icon: string;
  /** Whether the pattern if selected and by whom */
  selectedBy?: SelectedBy;
};

export { SelectedBy };
export type { Pattern, PatternsSelection, Product, SoftwareConfig, SoftwareProposal };
