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

require "y2storage/proposal/agama_device_planner"
require "y2storage/proposal/agama_md_name"

module Y2Storage
  module Proposal
    # MD RAID planner for Agama.
    class AgamaMdPlanner < AgamaDevicePlanner
      include AgamaMdName

      # @param md_config [Agama::Storage::Configs::MdRaid]
      # @param config [Agama::Storage::Config]
      # @return [Array<Planned::Device>]
      def planned_devices(md_config, config)
        md = planned_md(md_config, config)
        register_partitionable(md, md_config)
        [md]
      end

    private

      # @param md_config [Agama::Storage::Configs::MdRaid]
      # @param config [Agama::Storage::Config]
      # @return [Planned::Md]
      def planned_md(md_config, config)
        Y2Storage::Planned::Md.new.tap do |planned|
          if md_config.partitions?
            configure_partitions(planned, md_config, config)
          else
            configure_block_device(planned, md_config)
            configure_pv(planned, md_config, config)
          end

          planned.name = md_name(md_config, config)
          planned.md_level = md_config.level
          planned.md_parity = md_config.parity
          planned.chunk_size = md_config.chunk_size
          configure_reuse(planned, md_config)
        end
      end
    end
  end
end
