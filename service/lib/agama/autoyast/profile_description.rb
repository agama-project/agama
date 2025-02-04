#!/usr/bin/env ruby
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

require "json"

module Agama
  module AutoYaST
    # Describes an AutoYaST element and its support level in Agama
    class ProfileElement
      # @return [String] Element key.
      attr_reader :key
      # @return [Symbol] Support level (:no or :planned).
      attr_reader :support
      # @return [String] How to handle the case where the attribute is needed.
      attr_reader :advice

      def initialize(key, support)
        @key = key
        @support = support
      end
    end

    # Describes the AutoYaST profile format.
    #
    # At this point, it only includes the information of the unsupported sections.
    class ProfileDescription
      attr_reader :elements

      DESCRIPTION_PATH = File.expand_path("#{__dir__}/../../../share/autoyast-compat.json")

      class << self
        def load(path = DESCRIPTION_PATH)
          json = JSON.load_file(path)
          elements = json.map do |e|
            ProfileElement.new(e["key"], e["support"].to_sym)
          end
          new(elements)
        end
      end

      def initialize(elements)
        @elements = elements
      end

      def find_element(key)
        section = key.split(".").first
        elements.find { |e| [key, section].include?(e.key) }
      end
    end
  end
end
