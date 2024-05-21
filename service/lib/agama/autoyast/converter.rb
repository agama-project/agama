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
require "autoinstall/script_runner"
require "autoinstall/script"
require "agama/autoyast/product_reader"
require "agama/autoyast/root_reader"
require "agama/autoyast/software_reader"
require "agama/autoyast/storage_reader"
require "agama/autoyast/user_reader"
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
        profile = read_profile
        File.write(path.join("autoinst.json"), export_profile(profile).to_json)
      end

    private

      attr_reader :profile_url

      def copy_profile; end

      # @return [Hash] AutoYaST profile
      def read_profile
        FileUtils.mkdir_p(Yast::AutoinstConfig.profile_dir)

        # fetch the profile
        Yast::AutoinstConfig.ParseCmdLine(profile_url)
        Yast::ProfileLocation.Process

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

        Yast::Profile.current
      end

      def run_pre_scripts
        pre_scripts = Yast::Profile.current.fetch_as_hash("scripts")
          .fetch_as_array("pre-scripts")
          .map { |h| Y2Autoinstallation::PreScript.new(h) }
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

      # @return [Hash] Agama profile
      def export_profile(profile)
        user = Agama::AutoYaST::UserReader.new(profile)
        root = Agama::AutoYaST::RootReader.new(profile)
        software = Agama::AutoYaST::SoftwareReader.new(profile)
        product = Agama::AutoYaST::ProductReader.new(profile)
        storage = Agama::AutoYaST::StorageReader.new(profile)

        user.read
          .merge(root.read)
          .merge(software.read)
          .merge(product.read)
          .merge(storage.read)
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
