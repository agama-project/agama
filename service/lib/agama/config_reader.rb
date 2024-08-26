# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "yaml"
require "logger"
require "agama/config"
require "agama/cmdline_args"
require "transfer/file_from_url"

Yast.import "URL"
Yast.import "Directory"

module Agama
  # This class is responsible for reading Agama configuration from different locations
  # including kernel cmdline options
  class ConfigReader
    include Yast::Transfer::FileFromUrl
    include Yast::I18n

    # Default Agama configuration which should define all the possible values
    SYSTEM_PATH = "/etc/agama.yaml"
    GIT_PATH = File.expand_path("#{__dir__}/../../etc/agama.yaml")
    GIT_DIR = File.expand_path("#{__dir__}/../../../.git")
    REMOTE_BOOT_CONFIG = "agama_boot.yaml"

    PATHS = [
      "/usr/share/agama/conf.d",
      "/etc/agama.d",
      "/run/agama.d"
    ].freeze

    attr_reader :logger
    attr_reader :workdir

    # Constructor
    #
    # @param logger [Logger]
    # @param workdir [String] Root directory to read the configuration from
    def initialize(logger: nil, workdir: "/")
      @logger = logger || ::Logger.new($stdout)
      @workdir = workdir
    end

    # loads correct yaml file
    def config_from_file(path = nil)
      raise "Missing config file at #{path}" unless File.exist?(path)

      logger.info "Reading configuration from #{path}"
      Config.from_file(path, logger)
    end

    # Return an array with the different {Config} objects read from the different locations
    #
    # TODO: handle precedence correctly
    #
    # @return [Array<Config>] an array with all the configurations read from the system
    def configs
      return @configs if @configs

      @configs = config_paths.map { |path| config_from_file(path) }
      @configs << remote_config if remote_config
      @configs << cmdline_config if cmdline_config
      @configs
    end

    # Return a {Config} object
    # @return [Config] resultant Config after merging all the configurations
    def config
      config = configs.first || Config.new(nil, logger)
      (configs[1..-1] || []).each { |c| config = config.merge(c) }
      config
    end

  private

    # Copy a file from a potentially remote location
    #
    # @param location [String] File location. It might be an URL-like string (e.g.,
    #   "http://example.net/example.yml").
    # @param target [String] Path to copy the file to.
    # @return [Boolean] Whether the file was successfully copied or not
    def copy_file(location, target)
      url = Yast::URL.Parse(location)

      res = get_file_from_url(
        scheme:    url["scheme"],
        host:      url["host"],
        urlpath:   url["path"],
        localfile: target,
        urltok:    url,
        destdir:   "/"
      )

      # TODO: exception?
      logger.error "script #{location} could not be retrieved" unless res
      res
    end

    # @return [CmdlineArgs]
    def cmdline_args
      @cmdline_args ||= CmdlineArgs.read_from(File.join(workdir, "/proc/cmdline"))
    end

    # return [Config]
    def cmdline_config
      Config.new(cmdline_args.data, logger)
    end

    # return [Config]
    def remote_config
      return unless cmdline_args.config_url

      file_path = File.join(Yast::Directory.tmpdir, REMOTE_BOOT_CONFIG)
      logger.info "Copying boot config to #{file_path}"

      copy_file(cmdline_args.config_url, file_path)
      config_from_file(file_path)
    end

    def default_path
      Dir.exist?(GIT_DIR) ? GIT_PATH : SYSTEM_PATH
    end

    def config_paths
      paths = PATHS.each_with_object([]) do |path, all|
        all.concat(file_paths_in(File.join(workdir, path)))
      end

      paths.uniq! { |f| File.basename(f) }
      # Sort files lexicographic
      paths.sort_by! { |f| File.basename(f) }
      paths.prepend(default_path) if File.exist?(default_path)

      paths
    end

    def file_paths_in(path)
      if File.file?(path)
        [path]
      elsif File.directory?(path)
        Dir.glob("#{path}/*.{yml,yaml}")
      else
        []
      end
    end
  end
end
