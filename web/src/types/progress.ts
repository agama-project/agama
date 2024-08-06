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

type APIProgress = {
  currentStep: number;
  maxSteps: number;
  currentTitle: string;
  finished: boolean;
  steps?: string[];
  service: string;
};

class Progress {
  total: number;
  current: number;
  message: string;
  finished: boolean;
  steps: string[];

  constructor(current: number, total: number, message: string, finished: boolean, steps: string[]) {
    this.current = current;
    this.total = total;
    this.message = message;
    this.finished = finished;
    this.steps = steps;
  }

  static fromApi(progress: APIProgress) {
    const {
      currentStep: current,
      maxSteps: total,
      currentTitle: message,
      finished,
      steps = [],
    } = progress;
    return new Progress(current, total, message, finished, steps);
  }
}

export { Progress };
export type { APIProgress };
