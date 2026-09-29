# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

module Agama
  module AutoYaST
    # Reads the root/regular user entries out of an AutoYaST profile's <users> section.
    #
    # This intentionally does NOT use Y2Users::Autoinst::Reader/Y2Users::Config. That would
    # require vendoring (or depending on) yast2-users, but Y2Users::User unconditionally requires
    # a chain that ends in `Yast.import "UsersSimple"`, a Perl module that only exists inside
    # yast2-users itself - so even loading the class would hard-crash without that package
    # installed, for functionality (password/account validation) Agama never uses. Given Agama
    # only reads a handful of plain fields from the raw profile hash, it is simpler and more
    # robust to read the <users> section directly here instead.
    #
    # See spec/0002-drop-yast/plan.md ("Phase 2") for the full rationale.
    class UsersProfileReader
      # User names that are considered "system" users and therefore never picked as "the" regular
      # user. This mirrors Y2Users::User#system?'s behavior for users coming from an AutoYaST
      # profile: in that flow, a user is only otherwise considered a system user when it has an
      # explicit uid that happens to be below the system's SYS_UID_MAX (from /etc/login.defs), a
      # live-filesystem-dependent check that does not make sense to replicate during "pure",
      # side-effect-free profile parsing.
      SYSTEM_USER_NAMES = ["nobody"].freeze

      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Root user entry, if any.
      #
      # @return [Hash, nil] a hash with (at least) "username", "user_password", "encrypted" and
      #   "authorized_keys" keys, as they appear in the AutoYaST profile
      def root
        users.find { |u| root?(u) }
      end

      # First regular (non-root, non-system) user entry, if any.
      #
      # @return [Hash, nil] see {#root} for the hash shape
      def regular_user
        users.find { |u| !root?(u) && !system?(u) }
      end

    private

      # @return [ProfileHash]
      attr_reader :profile

      # @return [Array<Hash>]
      def users
        @users ||= profile.fetch_as_array("users")
      end

      # @param user [Hash]
      # @return [Boolean]
      def root?(user)
        user["username"] == "root"
      end

      # @param user [Hash]
      # @return [Boolean]
      def system?(user)
        SYSTEM_USER_NAMES.include?(user["username"])
      end
    end
  end
end
