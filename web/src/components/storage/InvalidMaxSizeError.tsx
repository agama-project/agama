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

import { _ } from "~/i18n";
import { SIZE_METHODS, SizeMethod } from "~/components/storage/utils";

export class InvalidMaxSizeError {
  sizeMethod: SizeMethod;
  minSize: string | number;
  maxSize: string | number;

  constructor(sizeMethod: SizeMethod, minSize: string | number, maxSize: string | number) {
    this.sizeMethod = sizeMethod;
    this.minSize = minSize;
    this.maxSize = maxSize;
  }

  check(): boolean {
    return (
      this.sizeMethod === SIZE_METHODS.RANGE && this.maxSize !== -1 && this.maxSize <= this.minSize
    );
  }

  render(): string {
    return _("Maximum must be greater than minimum");
  }
}
