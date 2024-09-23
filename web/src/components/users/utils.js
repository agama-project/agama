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

/**
 * Method which generates username suggestions based on given full name.
 * The method cleans the input name by removing non-alphanumeric characters (except spaces),
 * splits the name into parts, and then generates suggestions based on these parts.
 *
 * @param {string} fullName The full name used to generate username suggestions.
 * @returns {string[]} An array of username suggestions.
 */
const suggestUsernames = (fullName) => {
  if (!fullName) return [];

  // Cleaning the name.
  const cleanedName = fullName
    .normalize("NFD")
    .trim()
    .replace(/[\u0300-\u036f]/g, "") // Replacing accented characters with English equivalents, eg. š with s.
    .replace(/[^\p{L}\p{N} ]/gu, "") // Keep only letters, numbers and spaces. Covering the whole Unicode range, not just ASCII.
    .toLowerCase();

  // Split the cleaned name into parts.
  const parts = cleanedName.split(/\s+/);
  const suggestions = new Set();

  const firstLetters = parts.map((p) => p[0]).join("");
  const lastPosition = parts.length - 1;

  const [firstPart, ...allExceptFirst] = parts;
  const [firstLetter, ...allExceptFirstLetter] = firstLetters;
  const lastPart = parts[lastPosition];

  // Just the first part of the name
  suggestions.add(firstPart);
  // The first letter of the first part plus all other parts
  suggestions.add(firstLetter + allExceptFirst.join(""));
  // The first part plus the first letters of all other parts
  suggestions.add(firstPart + allExceptFirstLetter.join(""));
  // The first letters except the last one plus the last part
  suggestions.add(firstLetters.substring(0, lastPosition) + lastPart);
  // All parts without spaces
  suggestions.add(parts.join(""));

  // let's drop suggestions with less than 3 characters
  suggestions.forEach((s) => {
    if (s.length < 3) suggestions.delete(s);
  });

  // using Set object to remove duplicates, then converting back to array
  return [...suggestions];
};

export { suggestUsernames };
