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

# Vendored from yast2-s390's src/lib/y2s390/dasds_collection.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "y2s390/base_collection"

Yast.import "Mode"

module Y2S390
  # Represents a collection of DASD devices
  class DasdsCollection < BaseCollection
    # Returns a new collection holding only {Yast::Y2390::Dasd#active?} devices
    #
    # @return [DasdsCollection]
    def active
      filter(&:active?)
    end

    # Returns a new collection after selecting devices matching given blcok
    #
    # @return [DasdsCollection]
    def filter(&block)
      self.class.new(@elements.select(&block))
    end

    # Returns a new collection holding only {Yast::Y2390::Dasd#offline?} devices
    #
    # @return [DasdsCollection]
    def offline
      filter(&:offline?)
    end

    # Returns a new collection holding only {Yast::Y2390::Dasd} devices which status is :no_format
    #
    # @return [DasdsCollection]
    def unformatted
      filter { |d| d.status == :no_format }
    end

    # Returns a new collection holding {Yast::Y2390::Dasd} devices which wants to be formatted or
    # are unformatted and should be formatted too
    #
    # @return [DasdsCollection]
    def to_format(format_unformatted: false)
      filter { |d| d.format_wanted || (format_unformatted && !d.formatted?) }
    end
  end
end
