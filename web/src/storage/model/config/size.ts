/*
 * Copyright (c) [2024] SUSE LLC
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

import { config } from "~/api/storage/types";
import * as checks from "~/api/storage/types/checks";
import xbytes from "xbytes";

export type Size = {
  auto: boolean;
  min?: number;
  max?: number;
};

interface WithSize {
  size?: config.Size;
}

type AnyConfig = object | undefined;

class SizeGenerator<TypeWithSize extends WithSize> {
  private config: AnyConfig;
  private solvedConfig: TypeWithSize;

  constructor(config: AnyConfig, solvedConfig: TypeWithSize) {
    this.config = config;
    this.solvedConfig = solvedConfig;
  }

  generate(): Size | undefined {
    const size = this.solvedConfig.size;

    if (!size) return;
    if (checks.isSizeValue(size)) return this.fromSizeValue(size);
    if (checks.isSizeTuple(size)) return this.fromSizeTuple(size);
    if (checks.isSizeRange(size)) return this.fromSizeRange(size);
  }

  private fromSizeValue(value: config.SizeValue): Size {
    const bytes = this.bytes(value);

    return {
      auto: this.generateAuto(),
      min: bytes,
      max: bytes,
    };
  }

  private fromSizeTuple(sizeTuple: config.SizeTuple): Size {
    const size: Size = {
      auto: this.generateAuto(),
      min: this.bytes(sizeTuple[0]),
    };

    if (sizeTuple.length === 2) {
      size.max = this.bytes(sizeTuple[1]);
    }

    return size;
  }

  private fromSizeRange(sizeRange: config.SizeRange): Size {
    const size: Size = {
      auto: this.generateAuto(),
      min: this.bytes(sizeRange.min),
    };

    if (sizeRange.max) {
      size.max = this.bytes(sizeRange.max);
    }

    return size;
  }

  private generateAuto(): boolean {
    return this.config === undefined || !("size" in this.config);
  }

  private bytes(value: config.SizeValueWithCurrent): number | undefined {
    if (checks.isSizeCurrent(value)) return;
    if (checks.isSizeString(value)) return this.parseSizeString(value);
    if (checks.isSizeBytes(value)) return value;
  }

  private parseSizeString(value: string): number | undefined {
    // xbytes.parseSize will not work with a string like '10k', the unit must end with 'b' or 'B'
    let adapted = value.trim();
    if (!adapted.match(/b$/i)) adapted = adapted + "b";

    const parsed = xbytes.parseSize(adapted, { bits: false }) || parseInt(adapted);
    if (parsed) return Math.trunc(parsed);
  }
}

export function generate<TypeWithSize extends WithSize>(
  config: AnyConfig,
  solvedConfig: TypeWithSize,
): Size | undefined {
  return new SizeGenerator<TypeWithSize>(config, solvedConfig).generate();
}
