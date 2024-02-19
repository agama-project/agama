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
 * Method which generates username suggestions based on first and last name.
 * The method cleans the input name by removing non-alphanumeric characters (except spaces),
 * splits the name into parts, and then generates suggestions based on these parts.
 *
 * @param {string} fullName The full name used to generate username suggestions.
 * @returns {string[]} An array of username suggestions.
 */
const suggestUsernames = (fullName) => {
  // Cleaning the name.
  const cleanedName = fullName
    .normalize('NFD')
    .trim()
    .replace(/[\u0300-\u036f]/g, '') // Replacing accented characters with English equivalents, eg. š with s.
    .replace(/[^\p{L}\p{N} ]/gu, "") // Keep only letters, numbers and spaces. Covering the whole Unicode range, not just ASCII.
    .toLowerCase();

  // Split the cleaned name into parts.
  const nameParts = cleanedName.split(/\s+/);

  const suggestions = [];

  nameParts.forEach((namePart, index) => {
    if (index === 0) {
      suggestions.push(namePart);
      suggestions.push(namePart[0]);
      suggestions.push(namePart[0]);
      suggestions.push(namePart);
      suggestions.push(namePart[0]);
      suggestions.push(namePart);
    } else {
      if (index === 1)
        suggestions[1] += namePart;
      suggestions[2] += namePart;
      suggestions[3] += namePart[0];
      if (index === nameParts.length - 1)
        suggestions[4] += namePart;
      else
        suggestions[4] += namePart[0];
      suggestions[5] += namePart;
    }
  });

  // using Set object to remove duplicates, then converting back to array
  return [...new Set(suggestions)];
};

export {
  suggestUsernames
};
