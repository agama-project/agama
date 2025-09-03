# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
  module AutoYaST
    # Builds the Agama "product" section from an AutoYaST profile.
    class ProductReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash corresponding to Agama "product" section.
      #
      # If there is no product-related information, it returns an empty hash.
      #
      # @return [Hash] Agama "product" section
      def read
        return {} if profile["software"].nil?

        software = profile.fetch_as_hash("software")
        suse_register = profile.fetch_as_hash("suse_register")

        product = from_software(software)
          .merge(from_suse_register(suse_register))
        return {} if product.empty?

        { "product" => product }
      end

    private

      attr_reader :profile

      # @param section [ProfileHash] AutoYaST profile
      def from_software(section)
        product = section.fetch_as_array("products").first
        return {} if product.nil?

        { "id" => product }
      end

      # @param section [ProfileHash] AutoYaST profile
      def from_suse_register(section)
        return {} unless section.fetch("do_registration", true)

        result = {}

        code = section["reg_code"].to_s
        result["registrationCode"] = code unless code.empty?

        email = section["email"].to_s
        result["registrationEmail"] = email unless email.empty?

        url = section["reg_server"].to_s
        result["registrationUrl"] = url unless url.empty?

        # addons from the registration server
        converted_addons = convert_addons(section["addons"] || [])
        result["addons"] = converted_addons unless converted_addons.empty?

        result
      end

      # convert addons according to the new schema
      def convert_addons(addons)
        addons.map do |a|
          addon = { "id" => a["name"] }

          version = a["version"].to_s
          # omit the version if it was 11.x, 12.x or 15.x, the version is now optional
          version = "" if version.match(/^1[125]\.\d$/)
          addon["version"] = version unless version.empty?

          code = a["reg_code"].to_s
          addon["registrationCode"] = code unless code.empty?

          addon
        end
      end
    end
  end
end
