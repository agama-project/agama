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
  # Base class for generating a target object from a JSON.
  class JSONImporter
    # @param json [Hash]
    def initialize(json)
      @json = json
    end

    # Performs the conversion from Hash according to the JSON schema.
    #
    # @return [Object] A {Config} or any its configs from {Storage::Configs}.
    def import
      result = target

      imports.each do |property, value|
        next if value.nil?

        result.public_send("#{property}=", value)
      end

      result
    end

  private

    # @return [Hash]
    attr_reader :json

    # Target object (defined by derived classes).
    #
    # @return [Object]
    def target
      raise "Undefined target object"
    end

    # Imported properties.
    #
    # @return [Hash] e.g., { foo: 10, bar: nil }.
    def imports
      {}
    end
  end
end
