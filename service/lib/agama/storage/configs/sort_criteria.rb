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
    module Configs
      # Namespace for criteria used to sort the result when searching devices.
      module SortCriteria
        # Base class for all sorting criteria
        class Base
          # Constructor
          def initialize
            @asc = true
          end

          # @return [Boolean] Whether sorting must be in ascending order
          attr_accessor :asc
          alias_method :asc?, :asc

          # @return [Boolean] Whether sorting must be in descending order
          def desc
            !@asc
          end
          alias_method :desc?, :desc

          # Order for the two operators
          #
          # @param dev_a [Y2Storage#device]
          # @param dev_b [Y2Storage#device]
          # @return [Integer] less than 0 when b follows a, greater than 0 when a follows b, 0 when
          #   both are equivalent
          def compare(dev_a, dev_b)
            asc? ? compare_asc(dev_a, dev_b) : compare_asc(dev_b, dev_a)
          end

          # @see #compare
          def compare_asc(dev_a, dev_b)
            raise NotImplementedError
          end
        end

        # Compares by device name
        class Name < Base
          def compare_asc(dev_a, dev_b)
            dev_a.name <=> dev_b.name
          end
        end

        # Compares by device size
        class Size < Base
          def compare_asc(dev_a, dev_b)
            dev_a.size <=> dev_b.size
          end
        end

        # Compares by partition number
        class PartitionNumber < Base
          def compare_asc(dev_a, dev_b)
            dev_a.number <=> dev_b.number
          end
        end
      end
    end
  end
end
