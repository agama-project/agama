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

require "yast"
require "agama/autoyast/pre_script"

# :nodoc:
module Agama
  module AutoYaST
    # Retrieves an AutoYaST profile into an Agama one.
    #
    # It supports AutoYaST dynamic profiles features: pre-scripts, rules/classes and ERB.
    #
    # It generates an AutoYaST profile that can be converted into an Agama configuration using the
    # {Agama::AutoYaST::Converter} class.
    class ProfileFetcher
      # @param profile_url [String] Profile URL
      def initialize(profile_url)
        @profile_url = profile_url
      end

      # Converts the profile into a set of files that Agama can process.
      # @return [Hash,nil] an evaluated AutoYaST profile
      def fetch
        import_yast
        read_profile
      end

    private

      attr_reader :profile_url

      # @return [Hash, nil] AutoYaST profile
      def read_profile
        FileUtils.mkdir_p(Yast::AutoinstConfig.profile_dir)

        # fetch the profile
        Yast::AutoinstConfig.ParseCmdLine(profile_url)
        return unless Yast::ProfileLocation.Process

        # put the profile in the tmp directory
        FileUtils.cp(
          Yast::AutoinstConfig.xml_tmpfile,
          tmp_profile_path
        )

        loop do
          Yast::Profile.ReadXML(tmp_profile_path)
          run_pre_scripts
          break unless File.exist?(Yast::AutoinstConfig.modified_profile)

          FileUtils.cp(Yast::AutoinstConfig.modified_profile, tmp_profile_path)
          FileUtils.rm(Yast::AutoinstConfig.modified_profile)
        end

        Yast::ProfileHash.new(Yast::Profile.current)
      end

      def run_pre_scripts
        PreScript.clean_all
        pre_scripts = Yast::Profile.current.fetch_as_hash("scripts")
          .fetch_as_array("pre-scripts")
          .map { |h| PreScript.new(h) }
        script_runner = Y2Autoinstall::ScriptRunner.new

        pre_scripts.each do |script|
          script.create_script_file
          script_runner.run(script)
        end
      end

      def tmp_profile_path
        @tmp_profile_path ||= File.join(
          Yast::AutoinstConfig.profile_dir,
          "autoinst.xml"
        )
      end

      def import_yast
        Yast.import "AutoinstConfig"
        Yast.import "AutoinstScripts"
        Yast.import "Profile"
        Yast.import "ProfileLocation"
      end
    end
  end
end
