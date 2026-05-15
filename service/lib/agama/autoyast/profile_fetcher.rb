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
require "y2storage/storage_manager"
require "agama/autoyast/storage_manager"

# :nodoc:
module Agama
  module AutoYaST
    # Retrieves an AutoYaST profile into an Agama one.
    #
    # It supports AutoYaST dynamic profiles features: pre-scripts, rules/classes and ERB.
    #
    # It generates an AutoYaST profile that can be converted into an Agama configuration using the
    # {Agama::AutoYaST::Converter} class.
    #
    # # Removing empty strings
    #
    # It is really uncommon to use empty strings as values in AutoYaST.
    # Those values are not a problem in AutoYaST, but they can cause
    # problems in Agama. For instance, an empty <keymap /> element is ignored
    # in AutoYaST, but not in Agama.
    #
    # In order to make the migration from AutoYaST to Agama easier, the
    # conversion removes empty string values. The exception is the
    # <partitioning /> section, which is handled by yast2-storage-ng.
    # Actually, this section contains the <subvolumes_prefix />, which
    # can be set to an empty string as described in the AutoYaST documentation.
    #
    class ProfileFetcher
      # @param profile_url [String] Profile URL
      def initialize(profile_url)
        @profile_url = profile_url
      end

      # Converts the profile into a set of files that Agama can process.
      # @return [ProfileHash,nil] an evaluated AutoYaST profile
      def fetch
        import_yast

        original_instance = Y2Storage::StorageManager.method(:instance)
        Y2Storage::StorageManager.define_singleton_method(:instance) do
          return @storage_manager if @storage_manager

          @storage_manager = Agama::AutoYaST::StorageManager.new
          @storage_manager.probe
          @storage_manager
        end

        result = read_profile
        result
      ensure
        Y2Storage::StorageManager.define_singleton_method(:instance, original_instance)
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

        Yast::ProfileHash.new(clean_profile(Yast::Profile.current))
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

      # Removes empty string values from the profile.
      #
      # @param profile [Hash]
      # @return [Hash]
      def clean_profile(profile)
        profile.each_with_object({}) do |(key, value), all|
          if key == "partitioning"
            all[key] = value
          else
            new_value = clean_value(value)
            all[key] = new_value unless new_value.nil?
          end
        end
      end

      def clean_value(value)
        case value
        when Array
          clean_array(value)

        when Hash
          clean_hash(value)

        when String
          value unless value.empty?

        else
          value
        end
      end

      def clean_array(array)
        array.map do |e|
          if e.is_a?(Hash)
            clean_value(e)
          else
            e
          end
        end
      end

      def clean_hash(hash)
        new_hash = hash.each_with_object({}) do |(key, value), all|
          new_value = clean_value(value)
          all[key] = new_value unless new_value.nil?
        end
        new_hash unless new_hash.empty?
      end

      def import_yast
        Yast.import "AutoinstConfig"
        Yast.import "AutoinstScripts"
        Yast.import "Profile"
        Yast.import "ProfileLocation"
        require "agama/autoyast/report_patching"
      end
    end
  end
end
