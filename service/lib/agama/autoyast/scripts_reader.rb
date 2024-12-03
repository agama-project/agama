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

# :nodoc:
module Agama
  module AutoYaST
    # Builds the Agama "scripts" section from an AutoYaST profile.
    #
    # Agama scripting support does not have a 1:1 mapping with AutoYaST scripts, so this reader
    # performs the following transformations:
    #
    # - If a "chroot-scripts" section is defined, it creates a "post" section
    #   with the same scripts.
    # - If an "init-scripts" and/or a "post-scripts" section are defined, it
    #   creates an "init" section with the same scripts.
    #
    # The "pre-scripts" are ignored, as they are processed by the AutoYaST code itself. Last but not
    # least, the "post-partitioning" scripts are ignored by now (until we find a good use case).
    #
    # When it comes to scripts definition, not all the AutoYaST elements are supported. At this
    # point, only the "file_name", "location" and "source" options are processed. The rest
    # ("notification", "debug", etc.) are not considered critical and are ignored by now.
    class ScriptsReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash that corresponds to Agama "scripts" section.
      #
      # @return [Hash] Agama "scripts" section
      def read
        scripts = {}
          .merge(read_post_scripts)
          .merge(read_init_scripts)
        return {} if scripts.empty?

        { "scripts" => scripts }
      end

    private

      attr_reader :profile

      def scripts_section
        @scripts_section ||= profile.fetch("scripts", {})
      end

      # Reads the "chroot-scripts" section and builds an Agama "post" section.
      def read_post_scripts
        scripts = scripts_section.fetch("chroot-scripts", []).map do |script|
          read_post_script(script)
        end
        return {} if scripts.empty?

        { "post" => scripts }
      end

      # Reads the "init-scripts" and "post-scripts" sections and combines them into Agama's "init"
      # section.
      def read_init_scripts
        ay_init_scripts = scripts_section.fetch("init-scripts", []).map do |script|
          read_script(script)
        end

        ay_post_scripts = scripts_section.fetch("post-scripts", []).map do |script|
          read_script(script)
        end

        init_scripts = ay_post_scripts + ay_init_scripts
        return {} if init_scripts.empty?

        { "init" => init_scripts }
      end

      # Reads a "script" section and returns a hash with the corresponding Agama script.
      #
      # This method only processes the common elements.
      #
      # @param section [Hash] AutoYaST script section
      def read_script(section)
        script = {
          "name" => section["file_name"]
        }

        if section["location"]
          script["url"] = section["location"]
        elsif section["source"]
          script["body"] = section["source"]
        end

        script
      end

      # Reads a post-script definition and returns a hash with the corresponding Agama script.
      #
      # This method only processes the common elements.
      #
      # @param section [Hash] AutoYaST post-script section
      def read_post_script(section)
        read_script(section)
          .merge("chroot" => section.fetch("chrooted", false))
      end
    end
  end
end
