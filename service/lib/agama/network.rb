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

require "singleton"
require "yast"
require "yast2/systemd/service"
require "y2network/proposal_settings"
require "agama/proxy_setup"
require "agama/http"

Yast.import "Installation"

module Agama
  # Backend class to handle network configuration
  class Network
    def initialize(logger)
      @logger = logger
    end

    def startup
      persist_connections if do_proposal?
    end

    # Writes the network configuration to the installed system
    #
    # * Copies the connections configuration for NetworkManager, as Agama is not
    #   performing further configuration of the network.
    # * Enables the NetworkManager service.
    def install
      copy_files
      enable_service

      ProxySetup.instance.install
    end

    def link_resolv
      return unless File.exist?(RESOLV)

      link = File.join(Yast::Installation.destdir, RESOLV)
      target = File.join(RUN_NM_DIR, File.basename(RESOLV))

      return if File.exist?(link)

      FileUtils.touch RESOLV_FLAG
      FileUtils.ln_s target, link
    end

    def unlink_resolv
      return unless File.exist?(RESOLV_FLAG)

      link = File.join(Yast::Installation.destdir, RESOLV)
      FileUtils.rm_f link
      FileUtils.rm_f RESOLV_FLAG
    end

  private

    # @return [Logger]
    attr_reader :logger

    HOSTNAME = "/etc/hostname"
    RESOLV = "/etc/resolv.conf"
    NOT_COPY_NETWORK = "/run/agama/not_copy_network"
    AGAMA_SYSTEMD_LINK = "/run/agama/systemd/network"
    SYSTEMD_LINK = "/etc/systemd/network"
    RESOLV_FLAG = "/run/agama/manage_resolv"
    ETC_NM_DIR = "/etc/NetworkManager"
    RUN_NM_DIR = "/run/NetworkManager"
    private_constant :ETC_NM_DIR

    def enable_service
      service = Yast2::Systemd::Service.find("NetworkManager")
      if service.nil?
        logger.error "NetworkManager service was not found"
        return
      end

      service.enable
    end

    # Copies NetworkManager configuration files
    def copy_files
      copy(HOSTNAME)

      copy_directory(
        AGAMA_SYSTEMD_LINK,
        File.join(Yast::Installation.destdir, SYSTEMD_LINK)
      )

      return unless Dir.exist?(ETC_NM_DIR)
      return if File.exist?(NOT_COPY_NETWORK)

      copy_directory(
        File.join(ETC_NM_DIR, "system-connections"),
        File.join(Yast::Installation.destdir, ETC_NM_DIR, "system-connections")
      )
    end

    # Copies a directory
    #
    # This method checks whether the source directory exists. If preserves the target directory if
    # it exists (otherwise, it creates the directory).
    #
    # @param source [String] source directory
    # @param target [String] target directory
    def copy_directory(source, target)
      return unless Dir.exist?(source)

      FileUtils.mkdir_p(target)
      FileUtils.cp(Dir.glob(File.join(source, "*")), target)
    end

    # Copies a file
    #
    # This method checks whether the source file exists. It copies the file to the target system if
    # it exists
    #
    # @param source [String] source file
    # @param target [String,nil] target directory, only needed in case it is different to the
    # original source path in the target system.
    def copy(source, target = nil)
      return unless File.exist?(source)

      path = target || File.join(Yast::Installation.destdir, source)
      FileUtils.mkdir_p(File.dirname(path))
      FileUtils.copy_entry(source, path)
    end

    def http_client
      @http_client ||= Agama::HTTP::Clients::Network.new(logger)
    end

    def persist_connections
      http_client.persist_connections
    end

    def copy_connections?
      false
      http_client.state["copyNetwork"]
    end

    def do_proposal?
      return false unless copy_connections?
      return false if http_client.connections.any? { |c| c["persistent"] }

      !http_client.connections.empty?
    end
  end
end
