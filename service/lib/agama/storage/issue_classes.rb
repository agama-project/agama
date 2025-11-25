# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
  module Storage
    # Module to declare all the known issue classes from the storage scope
    module IssueClasses
      # Generic issue found when calculating the proposal
      PROPOSAL = :proposal

      # Issue classes related to the configuration provided by the user
      module Config
        # Generic issue with encryption settings
        ENCRYPTION         = :configEncryption

        # Generic issue with filesystem settings
        FILESYSTEM         = :configFilesystem

        # Generic issue defining LVM (eg. no volume group name)
        LVM                = :configLvm

        # Generic issue defining Md RAIDs (eg. no level)
        MD_RAID            = :configMdRaid

        # No root filesystem was defined
        NO_ROOT            = :configNoRoot

        # Issue with aliases (eg. same alias defined twice or referencing a non-existent alias)
        ALIAS              = :configAlias

        # A mandatory separate filesystem is missing in the configuration
        REQUIRED_PATHS     = :configRequiredPaths

        # The device specified in a 'search' was not found
        SEARCH             = :configSearch

        # Generic issue when a single device is used for several incompatible purposes
        # (eg. to be formatted and also to be an LVM physical volume)
        OVERUSED           = :configOverused

        # A device is used by several volume groups as a target for generating PVs
        OVERUSED_PV_TARGET = :configOverusedPvTarget

        # A device is part of a RAID and also chosen for an incompatible purpose
        OVERUSED_MD_MEMBER = :configOverusedMdMember
      end
    end
  end
end
