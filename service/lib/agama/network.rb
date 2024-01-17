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

Yast.import "Installation"

module Agama
  # Backend class to handle network configuration
  class Network
    def initialize(logger)
      @logger = logger
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

  private

    # @return [Logger]
    attr_reader :logger

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
      return unless Dir.exist?(ETC_NM_DIR)

      # runtime configuration is copied first, so in case of later modification
      # on same interface it gets overwriten (bsc#1210541).
      copy_directory(
        File.join(RUN_NM_DIR, "system-connections"),
        File.join(Yast::Installation.destdir, ETC_NM_DIR, "system-connections")
      )

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
  end
end
