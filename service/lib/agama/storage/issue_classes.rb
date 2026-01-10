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
      # It was not possible to accommodate the requested devices
      PROPOSAL = :proposal

      # Issue classes related to the configuration provided by the user
      module Config
        # A device is used for several incompatible purposes
        OVERUSED_DEVICE          = :configOverusedDevice

        # A device is used by several volume groups as a target for generating PVs
        OVERUSED_PV_TARGET       = :configOverusedPvTarget

        # A device that is part of a reused RAID is chosen to be used with other purpose
        MISUSED_MD_MEMBER        = :configMisusedMdMember

        # Reused and new devices are both used as target for generating PVs for the same LV
        INCOMPATIBLE_PV_TARGETS  = :configIncompatiblePvTargets

        # No root filesystem was defined
        NO_ROOT                  = :configNoRoot

        # The referenced alias does not exist in the context it was expected
        NO_SUCH_ALIAS            = :configNoSuchAlias

        # The device specified in a 'search' was not found
        SEARCH_NOT_FOUND         = :configSearchNotFound

        # A passphrase is required for the encryption but it was not provided
        NO_ENCRYPTION_PASSPHRASE = :configNoEncryptionPassphrase

        # The specified encryption method cannot be used
        WRONG_ENCRYPTION_METHOD  = :configWrongEncryptionMethod

        # A filesystem type is required but it was not specified
        NO_FILESYSTEM_TYPE       = :configNoFilesystemType

        # The specified filesystem type is not suitable for that mount path
        WRONG_FILESYSTEM_TYPE    = :configWrongFilesystemType

        # One or several mandatory separate filesystems are missing in the configuration
        MISSING_PATHS            = :configMissingPaths

        # No level was defined for a new MD RAID
        NO_RAID_LEVEL            = :configNoRaidLevel

        # The number of members for a new RAID is not compatible with the chosen level
        WRONG_RAID_MEMBERS       = :configNoRaidMembers

        # No name was specified for a new LVM volume group
        NO_VOLUME_GROUP_NAME     = :configNoVolumeGroupName
      end
    end
  end
end
