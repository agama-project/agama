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

/**
 * Returns a new array with a given collection split into two groups, the first holding elements
 * satisfying the filter and the second with those which do not.
 *
 * @param {Array} collection - the collection to be filtered
 * @param {function} filter - the function to be used as filter
 * @return {[Array, Array]} the new array with grouped elements
 */
const partition = (collection, filter) => {
  const pass = [];
  const fail = [];

  collection.forEach(element => {
    filter(element) ? pass.push(element) : fail.push(element);
  });

  return [pass, fail];
};

export {
  partition
};
