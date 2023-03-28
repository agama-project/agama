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
require "yast2/systemd/service"
require "cfa/base_model"
require "transfer/file_from_url"
require "fileutils"

Yast.import "URL"

module DInstaller
  # Cockpit configuration file representation
  #
  # @example Set the AllowUnencrypted option
  #   file = CockpitConfig.new
  #   file.load
  #   file.web_service["AllowUnencrypted"] = "true"
  #   file.save
  class CockpitConfig < CFA::BaseModel
    # Constructor
    #
    # @param path [String] File path
    # @param file_handler [.read, .write] Object to read/write the file.
    def initialize(path: DEFAULT_PATH, file_handler: nil)
      super(CFA::AugeasParser.new("puppet.lns"), path, file_handler: file_handler)
    end

    # Returns the augeas tree for the "WebService" section
    #
    # If the given section does not exist, it returns an empty one
    #
    # @return [AugeasTree]
    def web_service
      data["WebService"] ||= CFA::AugeasTree.new
    end
  end

  # Handles the Cockpit service
  #
  # This API offers an API to adjust Cockpit configuration and restart/reload the process. At this
  # point, just a few options are allowed (@see #setup).
  class CockpitManager
    include Yast::Logger
    include Yast::Transfer::FileFromUrl
    include Yast::I18n

    # Directory to store Cockpit certificates
    WS_CERTS_DIR = "/etc/cockpit/ws-certs.d"
    COCKPIT_SERVICE = "cockpit"
    COCKPIT_CONF_PATH = "/etc/cockpit/cockpit.conf"

    def initialize(logger, prefix: "/")
      @prefix = prefix
      @logger = logger
    end

    # Adjust Cockpit configuration and restart the process if needed
    #
    # If all arguments are nil, the configuration is not modified and the process is not restarted.
    #
    # @param options [Hash]
    #   @option ssl [Boolean,nil] SSL is enabled
    #   @option ssl_cert [String,nil] SSL/TLS certificate URL
    #   @option ssl_key  [String,nil] SSL/TLS key URL
    def setup(options)
      return if options.values.all?(&:nil?)

      enable_ssl(options["ssl"]) unless options["ssl"].nil?
      if options["ssl_cert"]
        copy_ssl_cert(options["ssl_cert"])
        copy_ssl_key(options["ssl_key"]) unless options["ssl_key"].nil?
        clear_self_signed_cert
      end

      restart_cockpit
    end

  private

    attr_reader :prefix

    # @return [Logger]
    attr_reader :logger

    # Enable/Disable SSL
    #
    # @param enabled [Boolean] Whether to enable or disable SSL
    def enable_ssl(enabled)
      path = File.join(prefix, COCKPIT_CONF_PATH)
      config = CockpitConfig.new(path: path)
      config.load if File.readable?(path)
      config.web_service["AllowUnencrypted"] = (!enabled).to_s
      config.save
    end

    # Copy the SSL certificate to Cockpit's certificates directory
    #
    # The certificate is renamed as `0-d-installer.cert`.
    #
    # @param location [String] Certificate location
    def copy_ssl_cert(location)
      logger.info "Retrieving SSL certificate from #{location}"
      copy_file(location, File.join(prefix, WS_CERTS_DIR, "0-d-installer.cert"))
    end

    # Copy the SSL certificate key to Cockpit's certificates directory
    #
    # The certificate is renamed as `0-d-installer.key`.
    #
    # @param location [String] Certificate key location
    def copy_ssl_key(location)
      logger.info "Retrieving SSL key from #{location}"
      copy_file(location, File.join(prefix, WS_CERTS_DIR, "0-d-installer.key"))
    end

    # Remove Cockpit's self signed certificates if they exist
    def clear_self_signed_cert
      self_signed = Dir[File.join(prefix, WS_CERTS_DIR, "0-self-signed.*")]
      ::FileUtils.rm(self_signed)
    end

    # Copy a file from a potentially remote location
    #
    # @param location [String] File location. It might be an URL-like string (e.g.,
    #   "http://example.net/example.cert").
    # @param target [String] Path to copy the file to.
    # @return [Boolean] Whether the file was sucessfully copied or not
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

    # Restart the Cockpit service
    def restart_cockpit
      logger.info "Restarting Cockpit"
      service = Yast2::Systemd::Service.find(COCKPIT_SERVICE)
      if service.nil?
        logger.error "Could not found #{COCKPIT_SERVICE} service"
        return
      end

      service.restart
    end
  end
end
