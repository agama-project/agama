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

require "yast"

Yast.import "ShadowConfig"

module Agama
  module AutoYaST
    # Reads the root/regular user entries out of an AutoYaST profile's <users> section.
    #
    # This intentionally does NOT use Y2Users::Autoinst::Reader/Y2Users::Config. That would require
    # vendoring (or depending on) yast2-users, but Y2Users::User unconditionally requires a chain
    # that ends loading "UsersSimple" Perl module. Given Agama only reads a handful of plain fields
    # from the raw profile hash, it is simpler and more robust to read the <users> section directly
    # here instead.
    #
    # The one bit of behavior worth replicating from Y2Users::User#system? is the UID-based system
    # user detection, since some profiles rely on it (a service account with an explicit low uid
    # and no recognizable name). That logic lives in `Yast::ShadowConfig` (part of the base yast2
    # package Agama already requires unconditionally, not yast2-users), so it can be reused here
    # with no new dependency. Note that, at the point this class runs (inside the standalone
    # agama-autoyast conversion step, before any target disk is partitioned or mounted),
    # `Yast::ShadowConfig` reads whatever /etc/login.defs (or /usr/etc/login.defs) is visible to
    # that process - i.e. the installation medium's own file, not the eventual target's. That's a
    # deliberate, accepted approximation: the target's login.defs simply does not exist yet at this
    # point, and the medium's SYS_UID_MAX is normally the same value shipped by the same product's
    # "shadow" package anyway.
    class UsersProfileReader
      # User names that are always considered "system" users, regardless of uid.
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
        return true if SYSTEM_USER_NAMES.include?(user["username"])

        uid = user["uid"]
        return false if uid.nil? || uid == "" || sys_uid_max.nil?

        uid.to_i <= sys_uid_max
      end

      # Highest uid still considered a "system" uid, read from the current /etc/login.defs (see
      # the class documentation above for why that is the installation medium's file, not the
      # target's).
      #
      # @return [Integer, nil] nil if login.defs is missing or does not define SYS_UID_MAX
      def sys_uid_max
        @sys_uid_max ||= Yast::ShadowConfig.fetch(:sys_uid_max)&.to_i
      end
    end
  end
end
