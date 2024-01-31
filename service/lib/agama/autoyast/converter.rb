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

require "yast"
require "json"
require "fileutils"
require "pathname"

# :nodoc:
module Agama
  module AutoYaST
    # Converts an AutoYaST profile into an Agama one.
    #
    # It is expected that many of the AutoYaST options are ignored because Agama does not have the
    # same features.
    #
    # The output might include, apart from the JSON Agama profile, a set of scripts (not implemented
    # yet).
    #
    # TODO: handle invalid profiles (YAST_SKIP_XML_VALIDATION).
    # TODO: capture reported errors (e.g., via the Report.Error function).
    class Converter
      # @param profile_url [String] Profile URL
      def initialize(profile_url)
        @profile_url = profile_url
      end

      # Converts the profile into a set of files that Agama can process.
      #
      # @param dir [Pathname,String] Directory to write the profile.
      def to_agama(dir)
        path = Pathname(dir)
        FileUtils.mkdir_p(path)
        import_yast
        profile = find_profile
        File.write(path.join("autoinst.json"), export_profile(profile).to_json)
      end

    private

      attr_reader :profile_url

      def find_profile
        Yast::AutoinstConfig.ParseCmdLine(profile_url)
        Yast::ProfileLocation.Process
        Yast::Profile.ReadXML(Yast::AutoinstConfig.xml_tmpfile)
        Yast::Profile.current
      end

      # @param profile [ProfileHash]
      # @return [Hash] D-Installer profile
      def export_profile(profile)
        {
          "software" => export_software(profile["software"] || {}),
          "storage"  => export_storage(profile["partitioning"] || [])
        }
      end

      # @param drives [Array<Hash>] Array of drives in the AutoYaST partitioning section
      def export_storage(drives)
        devices = drives.each_with_object([]) do |d, all|
          next unless d["device"]

          all << d["device"]
        end
        return {} if devices.empty?

        { "bootDevice" => devices.first }
      end

      # @param profile [Hash] Software section from the AutoYaST profile
      def export_software(profile)
        product = profile.fetch("products", []).first
        return {} unless product

        { "product" => product }
      end

      def import_yast
        Yast.import "AutoinstConfig"
        Yast.import "ProfileLocation"
        Yast.import "Profile"
      end
    end
  end
end
