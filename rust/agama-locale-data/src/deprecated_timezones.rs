// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

/// List of timezones which are deprecated and langtables missing translations for it
///
/// Filtering it out also helps with returning smaller list of real timezones.
/// Sadly many libraries facing issues with deprecated timezones, see e.g.
///
pub(crate) const DEPRECATED_TIMEZONES: &[&str] = &[
    "Africa/Asmera",                    // replaced by Africa/Asmara
    "Africa/Timbuktu",                  // replaced by Africa/Bamako
    "America/Argentina/ComodRivadavia", // replaced by America/Argentina/Catamarca
    "America/Atka",                     // replaced by America/Adak
    "America/Ciudad_Juarez",            // failed to find replacement
    "America/Coral_Harbour",            // replaced by America/Atikokan
    "America/Ensenada",                 // replaced by America/Tijuana
    "America/Fort_Nelson",
    "America/Fort_Wayne", // replaced by America/Indiana/Indianapolis
    "America/Knox_IN",    // replaced by America/Indiana/Knox
    "America/Nuuk",
    "America/Porto_Acre", // replaced by America/Rio_Branco
    "America/Punta_Arenas",
    "America/Rosario",
    "America/Virgin",
    "Antarctica/Troll",
    "Asia/Ashkhabad", // looks like typo/wrong transcript, it should be Asia/Ashgabat
    "Asia/Atyrau",
    "Asia/Barnaul",
    "Asia/Calcutta", // renamed to Asia/Kolkata
    "Asia/Chita",
    "Asia/Chungking",
    "Asia/Dacca",
    "Asia/Famagusta",
    "Asia/Katmandu",
    "Asia/Macao",
    "Asia/Qostanay",
    "Asia/Saigon",
    "Asia/Srednekolymsk",
    "Asia/Tel_Aviv",
    "Asia/Thimbu",
    "Asia/Tomsk",
    "Asia/Ujung_Pandang",
    "Asia/Ulan_Bator",
    "Asia/Yangon",
    "Atlantic/Faeroe",
    "Atlantic/Jan_Mayen",
    "Australia/ACT",
    "Australia/Canberra",
    "Australia/LHI",
    "Australia/NSW",
    "Australia/North",
    "Australia/Queensland",
    "Australia/South",
    "Australia/Tasmania",
    "Australia/Victoria",
    "Australia/West",
    "Australia/Yancowinna",
    "Brazil/Acre",
    "Brazil/DeNoronha",
    "Brazil/East",
    "Brazil/West",
    "CET",
    "CST6CDT",
    "Canada/Atlantic", // all canada TZ was replaced by America ones
    "Canada/Central",
    "Canada/Eastern",
    "Canada/Mountain",
    "Canada/Newfoundland",
    "Canada/Pacific",
    "Canada/Saskatchewan",
    "Canada/Yukon",
    "Chile/Continental", // all Chile was replaced by continental America tz
    "Chile/EasterIsland",
    "Cuba",
    "EET",
    "EST", // not sure why it is not in langtable
    "EST5EDT",
    "Egypt",
    "Eire",
    "Etc/GMT",
    "Etc/GMT+0",
    "Etc/GMT+1",
    "Etc/GMT+2",
    "Etc/GMT+3",
    "Etc/GMT+4",
    "Etc/GMT+5",
    "Etc/GMT+6",
    "Etc/GMT+7",
    "Etc/GMT+8",
    "Etc/GMT+9",
    "Etc/GMT+10",
    "Etc/GMT+11",
    "Etc/GMT+12",
    "Etc/GMT-0",
    "Etc/GMT-1",
    "Etc/GMT-2",
    "Etc/GMT-3",
    "Etc/GMT-4",
    "Etc/GMT-5",
    "Etc/GMT-6",
    "Etc/GMT-7",
    "Etc/GMT-8",
    "Etc/GMT-9",
    "Etc/GMT-10",
    "Etc/GMT-11",
    "Etc/GMT-12",
    "Etc/GMT-13",
    "Etc/GMT-14",
    "Etc/GMT0",
    "Etc/Greenwich",
    "Etc/UCT",
    "Etc/UTC",
    "Etc/Universal",
    "Etc/Zulu",
    "Europe/Astrakhan",
    "Europe/Belfast",
    "Europe/Kirov",
    "Europe/Kyiv",
    "Europe/Saratov",
    "Europe/Tiraspol",
    "Europe/Ulyanovsk",
    "GB",
    "GB-Eire",
    "GMT",
    "GMT+0",
    "GMT-0",
    "GMT0",
    "Greenwich",
    "HST",
    "Hongkong",
    "Iceland",
    "Iran",
    "Israel",
    "Jamaica",
    "Japan",
    "Kwajalein",
    "Libya",
    "MET",
    "Mexico/BajaNorte",
    "Mexico/BajaSur",
    "Mexico/General",
    "MST",
    "MST7MDT",
    "NZ",
    "NZ-CHAT",
    "Navajo",
    "Pacific/Bougainville",
    "Pacific/Kanton",
    "Pacific/Ponape",
    "Pacific/Samoa",
    "Pacific/Truk",
    "Pacific/Yap",
    "PRC",
    "PST8PDT",
    "Poland",
    "Portugal",
    "ROC",
    "ROK",
    "Singapore",
    "Turkey",
    "UCT",
    "Universal",
    "US/Aleutian", // all US/ replaced by America
    "US/Central",
    "US/East-Indiana",
    "US/Eastern",
    "US/Hawaii",
    "US/Indiana-Starke",
    "US/Michigan",
    "US/Mountain",
    "US/Pacific",
    "US/Samoa",
    "W-SU",
    "WET",
    "Zulu",
];
