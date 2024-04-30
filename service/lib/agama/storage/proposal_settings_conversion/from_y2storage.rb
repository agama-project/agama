# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require "agama/storage/volume_conversion"

module Agama
  module Storage
    module ProposalSettingsConversion
      # Proposal settings conversion from Y2Storage.
      #
      # @note This class does not perform a real conversion from Y2Storage settings. Instead of
      #   that, it copies the given settings and recovers some values from Y2Storage.
      #   A real conversion is not needed because the original settings are always available.
      #   Moreover, Agama introduces some concepts that do not exist in the Y2Storage settings
      #   (e.g., target, boot device or space policy), which could be impossible to infer.
      class FromY2Storage
        # @param y2storage_settings [Y2Storage::ProposalSettings]
        # @param settings [Agama::Storage::ProposalSettings] Settings to be copied and modified.
        def initialize(y2storage_settings, settings)
          @y2storage_settings = y2storage_settings
          @settings = settings
        end

        # Performs the conversion from Y2Storage.
        #
        # @return [Agama::Storage::ProposalSettings]
        def convert
          settings.dup.tap do |target|
            space_actions_conversion(target)
            volumes_conversion(target)
          end
        end

      private

        # @return [Y2Storage::ProposalSettings]
        attr_reader :y2storage_settings

        # @return [Agama::Storage::ProposalSettings]
        attr_reader :settings

        # Recovers space actions.
        #
        # @note Space actions are generated in the conversion of the settings to Y2Storage format,
        #   see {ProposalSettingsConversion::ToY2Storage}.
        #
        # @param target [Agama::Storage::ProposalSettings]
        def space_actions_conversion(target)
          target.space.actions = y2storage_settings.space_settings.actions
        end

        # Some values of the volumes have to be recovered from Y2Storage proposal.
        #
        # @param target [Agama::Storage::ProposalSettings]
        def volumes_conversion(target)
          target.volumes = target.volumes.map { |v| volume_conversion(v) }
        end

        # @param volume [Agama::Storage::Volume]
        # @return [Agama::Storage::Volume]
        def volume_conversion(volume)
          VolumeConversion.from_y2storage(volume)
        end
      end
    end
  end
end
