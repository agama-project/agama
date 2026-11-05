# Copyright (c) [2016] SUSE LLC
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

require "storage"
require "y2storage/disk_size"

module Y2Storage
  module Refinements
    # Refinements to make DiskSize objects more readable in the rspec tests
    #
    # It adds methods to perform a direct cast from numerical classes into
    # DiskSize objects
    # @example
    #   using Y2Storage::Refinements::SizeCasts
    #
    #   20.GiB == Y2Storage::DiskSize.GiB(20)
    #   12.5.MiB == Y2Storage::DiskSize.MiB(12.5)
    module SizeCasts
      REFINED_CLASSES = [::Integer, ::Float]
      ADDED_METHODS = [
        :KiB, :MiB, :GiB, :TiB, :PiB, :EiB, :ZiB, :YiB,
        :KB, :MB, :GB, :TB, :PB, :EB, :ZB, :YB
      ]

      REFINED_CLASSES.each do |klass|
        refine klass do
          ADDED_METHODS.each do |method|
            define_method(method) do
              DiskSize.send(method, self)
            end
          end
        end
      end
    end
  end
end
