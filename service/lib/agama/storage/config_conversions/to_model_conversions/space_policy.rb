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

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Space policy conversion to model according to the JSON schema.
        class SpacePolicy
          # TODO: make it work with volume groups and raids too.
          #
          # @param config [Configs::Drive]
          def initialize(config)
            @config = config
          end

          # @return [String]
          def convert
            return "delete" if config.filesystem || delete_all_partition?
            return "resize" if shrink_all_partition?
            return "custom" if delete_partition? || resize_partition?

            "keep"
          end

        private

          # @return [Configs::Drive]
          attr_reader :config

          # @return [Boolean]
          def delete_all_partition?
            config.partitions.any? { |p| delete_all?(p) }
          end

          # @return [Boolean]
          def shrink_all_partition?
            config.partitions.any? { |p| shrink_all?(p) }
          end

          # @return [Boolean]
          def delete_partition?
            config.partitions
              .select(&:found_device)
              .any? { |p| p.delete? || p.delete_if_needed? }
          end

          # @return [Boolean]
          def resize_partition?
            config.partitions
              .select(&:found_device)
              .any? { |p| !p.size.default? }
          end

          # @param partition_config [Configs::Partition]
          # @return [Boolean]
          def delete_all?(partition_config)
            search_all?(partition_config) && partition_config.delete?
          end

          # @param partition_config [Configs::Partition]
          # @return [Boolean]
          def shrink_all?(partition_config)
            search_all?(partition_config) &&
              !partition_config.size.nil? &&
              !partition_config.size.min.nil? &&
              partition_config.size.min.to_i == 0
          end

          # @param partition_config [Configs::Partition]
          # @return [Boolean]
          def search_all?(partition_config)
            !partition_config.search.nil? &&
              partition_config.search.always_match? &&
              partition_config.search.max.nil?
          end
        end
      end
    end
  end
end
