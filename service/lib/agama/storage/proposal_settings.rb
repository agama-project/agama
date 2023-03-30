# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "y2storage/secret_attributes"

module Agama
  module Storage
    # Settings used to calculate a Agama proposal
    class ProposalSettings
      include Y2Storage::SecretAttributes

      # Whether to use LVM
      #
      # @return [Boolean, nil] nil if undetermined
      attr_accessor :lvm

      # @!attribute encryption_password
      #   Password to use when creating new encryption devices
      #   @return [String, nil] nil if undetermined
      secret_attr :encryption_password

      # Device names of the disks that can be used for the installation. If nil, the proposal will
      # try find suitable devices
      #
      # @return [Array<String>]
      attr_accessor :candidate_devices

      # Set of volumes to create
      #
      # Only these properties will be honored: mount_point, fs_type, fixed_size_limits, min_size,
      # max_size, snapshots
      #
      # @return [Array<Volume>]
      attr_accessor :volumes

      def initialize
        @candidate_devices = []
        @volumes = []
      end

      # Whether the proposal must create encrypted devices
      #
      # @return [Boolean]
      def encrypt?
        !(encryption_password.nil? || encryption_password.empty?)
      end
    end
  end
end
