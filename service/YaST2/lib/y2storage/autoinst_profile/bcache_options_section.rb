# Copyright (c) [2019] SUSE LLC
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

require "installation/autoinst_profile/section_with_attributes"

module Y2Storage
  module AutoinstProfile
    # Thin object oriented layer on top of a <bcache_options> section of the
    # AutoYaST profile.
    class BcacheOptionsSection < ::Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :cache_mode }
        ]
      end

      define_attr_accessors

      # @!attribute cache_mode
      #   @return [String] Cache mode

      # Clones Bcache device options into an AutoYaST <bcache_options> profile section
      #
      # @param device [Bcache] bcache device
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [BcacheOptionsSection] bcache options section
      def self.new_from_storage(device, parent = nil)
        result = new(parent)
        result.init_from_bcache(device)
        result
      end

      # Method used by {.new_from_storage} to populate the attributes when
      # cloning bcache options
      #
      # @param bcache [Bcache] bcache device
      def init_from_bcache(bcache)
        @cache_mode = bcache.cache_mode.to_s
      end
    end
  end
end
