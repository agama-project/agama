# frozen_string_literal: true

#
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

require "json"
require "agama/autoyast/converter"
require "agama/autoyast/profile_fetcher"
require "agama/autoyast/profile_reporter"
require "agama/autoyast/profile_checker"
require "agama/cmdline_args"
require "agama/http/clients"

module Agama
  # :nodoc:
  module Commands
    class CouldNotFetchProfile < StandardError; end
    class CouldNotWriteAgamaConfig < StandardError; end

    # Command to convert an AutoYaST profile to an Agama configuration.
    #
    # It fetches the profile, checks for unsupported elements and converts it to an Agama
    # configuration file.
    #
    # @param url [String] URL of the AutoYaST profile
    # @param dir [String] Directory to write the converted profile
    class AgamaAutoYaST
      def initialize(url, directory)
        @url = url
        @directory = directory
        @logger = Logger.new($stdout)
      end

      # Run the command fetching, checking, converting and writing the Agama configuration.
      def run
        profile = fetch_profile
        unsupported = check_profile(profile)
        return false unless report_unsupported(unsupported)

        write_agama_config(profile)
      end

    private

      attr_reader :url, :directory, :logger

      # Fetch the AutoYaST profile from the given URL.
      def fetch_profile
        Agama::AutoYaST::ProfileFetcher.new(url).fetch
      rescue RuntimeError
        raise CouldNotFetchProfile
      end

      # Check the profile for unsupported
      def check_profile(profile)
        checker = Agama::AutoYaST::ProfileChecker.new
        elements = checker.find_unsupported(profile)
        logger.info "Found unsupported AutoYaST elements: #{elements.map(&:key)}"
        elements
      end

      def report_unsupported(elements)
        return true if elements.empty? || !report?

        reporter = Agama::AutoYaST::ProfileReporter.new(questions_client, logger)
        reporter.report(elements)
      end

      def write_agama_config(profile)
        converter = Agama::AutoYaST::Converter.new
        agama_config = converter.to_agama(profile)
        FileUtils.mkdir_p(directory)
        File.write(
          File.join(directory, "autoinst.json"),
          JSON.pretty_generate(agama_config)
        )
      rescue StandardError
        raise CouldNotWriteAgamaConfig
      end

      def questions_client
        @questions_client ||= Agama::HTTP::Clients::Questions.new(logger)
      end

      # Whether the report is enabled or not.
      def report?
        cmdline = CmdlineArgs.read_from("/proc/cmdline")
        cmdline.data.fetch("ay_check", "1") != "0"
      end
    end
  end
end
