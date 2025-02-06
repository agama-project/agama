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

require "agama/autoyast/profile_description"

module Agama
  module AutoYaST
    # This class checks an AutoYaST profile and determines which unsupported elements are used.
    #
    # It does not report unknown elements.
    class ProfileChecker
      # Finds unsupported profile elements.
      #
      # @param profile [Yast::ProfileHash] AutoYaST profile to check
      # @return [Array<ProfileElement>] List of unsupported elements
      def find_unsupported(profile)
        description = ProfileDescription.load
        elements = elements_from(profile)

        elements.map do |e|
          normalized_key = e.gsub(/\[\d+\]/, "[]")
          element = description.find_element(normalized_key)
          element unless element&.supported?
        end.compact
      end

    private

      # Returns the elements from the profile
      #
      # @return [Array<String>] List of element IDs (e.g., "networking.backend")
      def elements_from(profile, parent = "")
        return [] unless profile.is_a?(Hash)

        profile.map do |k, v|
          current = parent.empty? ? k : "#{parent}.#{k}"

          children = if v.is_a?(Array)
            v.map.with_index { |e, i| elements_from(e, "#{parent}.#{k}[#{i}]") }
          else
            elements_from(v, k)
          end

          [current, *children]
        end.flatten
      end
    end
  end
end
