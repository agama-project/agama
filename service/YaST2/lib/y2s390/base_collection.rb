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

# Vendored from yast2-s390's src/lib/y2s390/base_collection.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "forwardable"

module Y2S390
  # Base class for collection of config elements (e.g., {Dasd}).
  class BaseCollection
    extend Forwardable

    def_delegators :@elements, :each, :each_with_index, :select, :find, :reject, :map,
      :any?, :size, :empty?, :first

    # Constructor
    #
    # @param elements [Array<Objects>]
    def initialize(elements = [])
      @elements = elements
    end

    # Adds an element to the collection
    #
    # @param element [Object]
    # @return [self]
    def add(element)
      @elements << element

      self
    end

    # Deletes the element with the given id from the collection
    #
    # @param id [String]
    # @return [self]
    def delete(id)
      @elements.reject! { |e| e.id == id }

      self
    end

    # List with all the elements
    #
    # @return [Array<Object>]
    def all
      @elements.dup
    end

    alias_method :to_a, :all

    # Element with the given id
    #
    # @return [Object, nil] nil if the collection does not include an element with
    #   such an id.
    def by_id(value)
      @elements.find { |e| e.id == value }
    end

    # Elements included in the given id's list
    #
    # @return [BaseCollection] A new collection with the elements included in the list given
    def by_ids(ids)
      self.class.new(@elements.select { |d| ids.include?(d.id) })
    end

    # All element ids
    #
    # @return [Array<String>]
    def ids
      map(&:id)
    end
  end
end
