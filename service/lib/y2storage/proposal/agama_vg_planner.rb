# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "y2storage/lv_type"
require "y2storage/proposal/agama_device_planner"

module Y2Storage
  module Proposal
    # Volume group planner for Agama.
    class AgamaVgPlanner < AgamaDevicePlanner
      # @param config [Agama::Storage::Configs::VolumeGroup]
      # @return [Array<Planned::Device>]
      def planned_devices(config)
        [planned_vg(config)]
      end

    private

      # @param config [Agama::Storage::Configs::VolumeGroup]
      # @return [Planned::LvmVg]
      def planned_vg(config)
        # TODO: A volume group name is expected. Otherwise, the planned physical volumes cannot
        #   be associated to the planned volume group. Should the volume group name be
        #   automatically generated if missing?
        #
        #   @see AgamaDevicePlanner#configure_pv
        Y2Storage::Planned::LvmVg.new(volume_group_name: config.name).tap do |planned|
          planned.extent_size = config.extent_size
          planned.lvs = planned_lvs(config)
        end
      end

      # @param config [Agama::Storage::Configs::VolumeGroup]
      # @return [Array<Planned::LvmLv>]
      def planned_lvs(config)
        normal_lvs = planned_normal_lvs(config)
        thin_pool_lvs = planned_thin_pool_lvs(config)

        normal_lvs + thin_pool_lvs
      end

      # @param config [Agama::Storage::Configs::VolumeGroup]
      # @return [Array<Planned::LvmLv>]
      def planned_normal_lvs(config)
        configs = config.logical_volumes.reject(&:pool?).reject(&:thin_volume?)
        configs.map { |c| planned_lv(c, LvType::NORMAL) }
      end

      # @param config [Agama::Storage::Configs::VolumeGroup]
      # @return [Array<Planned::LvmLv>]
      def planned_thin_pool_lvs(config)
        pool_configs = config.logical_volumes.select(&:pool?)
        pool_configs.map { |c| planned_thin_pool_lv(c, config) }
      end

      # Plan a thin pool logical volume and its thin volumes.
      #
      # @param pool_config [Agama::Storage::Configs::LogicalVolume]
      # @param config [Agama::Storage::Configs::VolumeGroup]
      #
      # @return [Planned::LvmLv]
      def planned_thin_pool_lv(pool_config, config)
        planned_thin_lvs = planned_thin_lvs(config, pool_config.alias)

        planned_lv(pool_config, LvType::THIN_POOL).tap do |planned|
          planned_thin_lvs.each { |v| planned.add_thin_lv(v) }
        end
      end

      # @param config [Agama::Storage::Configs::VolumeGroup]
      # @param pool_alias [String]
      #
      # @return [Array<Planned::LvmLv>]
      def planned_thin_lvs(config, pool_alias)
        thin_configs = config.logical_volumes
          .select(&:thin_volume?)
          .select { |c| c.used_pool == pool_alias }

        thin_configs.map { |c| planned_lv(c, LvType::THIN) }
      end

      # @param config [Agama::Storage::Configs::LogicalVolume]
      # @param type [LvType]
      #
      # @return [Planned::LvmLv]
      def planned_lv(config, type)
        Planned::LvmLv.new(nil, nil).tap do |planned|
          planned.logical_volume_name = config.name
          planned.lv_type = type
          planned.stripes = config.stripes
          planned.stripe_size = config.stripe_size
          configure_block_device(planned, config)
          configure_size(planned, config.size)
        end
      end
    end
  end
end
