/*
 * Copyright (c) [2022] SUSE LLC
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
const STATUS_IFACE = "org.opensuse.DInstaller.ServiceStatus1";

/**
 * @typedef {object} Progress
 * @property {number} total - number of steps
 * @property {number} current - current step
 * @property {string} message - message of the current step
 * @property {boolean} finished - whether the progress already finished
 */

/**
 * @callback ProgressHandler
 * @param {Progress} progress - progress status
 * @return {void}
 */

/**
 * @callback ValidationErrorsHandler
 * @param {ValidationError[]} errors - validation errors
 * @return {void}
 */

/**
 * @typedef {new(...args: any[]) => T} GConstructor
 * @template {object} T
 */

/**
 * @typedef {GConstructor<{ client: import("./dbus").default }>} WithDBusClient
 */

/**
 * Extends the given class with methods to get and track the progress over D-Bus
 *
 * @template {!WithDBusClient} T
 * @param {string} object_path - object path
 * @param {T} superclass - superclass to extend
 */
const WithStatus = (superclass, object_path) => class extends superclass {
  /**
   * Returns the service status
   *
   * @return {Promise<number>} 0 for idle, 1 for busy
   */
  async getStatus() {
    const proxy = await this.client.proxy(STATUS_IFACE, object_path);
    return proxy.Current;
  }

  /**
   * Register a callback to run when the "CurrentInstallationPhase" changes
   *
   * @param {function} handler - callback function
   * @return {function} function to disable the callback
   */
  onStatusChange(handler) {
    return this.client.onObjectChanged(object_path, STATUS_IFACE, (changes) => {
      if ("Current" in changes) {
        handler(changes.Current.v);
      }
    });
  }
};

const PROGRESS_IFACE = "org.opensuse.DInstaller.Progress1";

/**
 * Extends the given class with methods to get and track the progress over D-Bus
 * @param {string} object_path - object_path
 * @param {T} superclass - superclass to extend
 * @template {!WithDBusClient} T
 */
const WithProgress = (superclass, object_path) => class extends superclass {
  /**
   * Returns the service progress
   *
   * @return {Promise<Progress>} an object containing the total steps,
   *   the current step and whether the service finished or not.
   */
  async getProgress() {
    const proxy = await this.client.proxy(PROGRESS_IFACE, object_path);
    return {
      total:    proxy.TotalSteps,
      current:  proxy.CurrentStep[0],
      message:  proxy.CurrentStep[1],
      finished: proxy.Finished
    };
  }

  /**
   * Register a callback to run when the progress changes
   *
   * @param {ProgressHandler} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onProgressChange(handler) {
    return this.client.onObjectChanged(object_path, PROGRESS_IFACE, (changes) => {
      const { TotalSteps, CurrentStep, Finished } = changes;
      if (TotalSteps === undefined && CurrentStep === undefined && Finished === undefined) {
        return;
      }

      this.getProgress().then(handler);
    });
  }
};

/**
 * @typedef {object} ValidationError
 * @property {string} message - Error message
 */

/**
 *
 * @param {string} message - Error message
 */
const createError = (message) => {
  return { message };
};

const VALIDATION_IFACE = "org.opensuse.DInstaller.Validation1";

/**
 * Extends the given class with methods to get validation errors over D-Bus
 * @param {string} object_path - object_path
 * @param {T} superclass - superclass to extend
 * @template {!WithDBusClient} T
 */
const WithValidation = (superclass, object_path) => class extends superclass {
  /**
   * Returns the validation errors
   *
   * @return {Promise<ValidationError[]>}
   */
  async getValidationErrors() {
    let errors;

    try {
      errors = await this.client.getProperty(object_path, VALIDATION_IFACE, "Errors");
    } catch (error) {
      console.error(`Could not get validation errors for ${object_path}`, error);
    }

    return errors.map(createError);
  }

  /**
   * Register a callback to run when the validation changes
   *
   * @param {ValidationErrorsHandler} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onValidationChange(handler) {
    return this.client.onObjectChanged(object_path, VALIDATION_IFACE, () => {
      this.getValidationErrors().then(handler);
    });
  }
};

export { WithStatus, WithProgress, WithValidation };
