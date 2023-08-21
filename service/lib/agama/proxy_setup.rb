# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "uri"

module Agama
  # This class is responsible of parsing the proxy url from the kernel cmdline or configured
  # through the dracut ask prompt configuration file (/etc/cmdline-menu.conf) during the boot
  # proccess of the system writing the configuration to /etc/sysconfig/proxy
  class ProxySetup
    include Singleton
    include Yast
    include Logger

    CMDLINE_PATH = "/proc/cmdline"
    CMDLINE_MENU_CONF = "/etc/cmdline-menu.conf"
    PACKAGES = ["microos-tools"].freeze
    CONFIG_PATH = "/etc/sysconfig/proxy"

    # @return [URI::Generic]
    attr_accessor :proxy

    # Constructor
    def initialize
      Yast.import "Proxy"
    end

    def run
      read
      write
    end

  private

    def read
      self.proxy = proxy_from_cmdline || proxy_from_dracut
    end

    def proxy_from_dracut
      return unless File.exist?(CMDLINE_MENU_CONF)

      options = File.read(CMDLINE_MENU_CONF)
      proxy_url_from(options)
    end

    def proxy_url_from(options)
      proxy_url = options.split.find { |o| o.start_with?(/proxy/i) }
      return unless proxy_url

      URI(proxy_url.downcase.gsub("proxy=", ""))
    end

    def proxy_from_cmdline
      return unless File.exist?(CMDLINE_PATH)

      options = File.read(CMDLINE_PATH)
      proxy_url_from(options)
    end

    def proxy_import_settings
      proto = proxy.scheme
      # save user name and password separately
      settings = {
        "proxy_user"     => proxy.user,
        "proxy_password" => proxy.password,
        "enabled"        => true
      }
      proxy.user = nil
      proxy.password = nil

      settings["#{proto}_proxy"] = proxy.to_s
      # Use the proxy also for https and ftp
      if proto == "http"
        settings["https_proxy"] = proxy.to_s
        settings["ftp_proxy"] = proxy.to_s
      end
      settings
    end

    def write
      return unless proxy

      settings = proxy_import_settings
      Proxy.Import(settings)

      log.info "Writing proxy settings: #{proxy.scheme}_proxy = '#{proxy}'"
      log.debug "Writing proxy settings: #{settings}"

      Proxy.Write
    end

    def install
      Proxy.Read
      return unless Proxy.enabled

      copy_files
      add_packages
    end

    def add_packages
      log.info "Selecting these packages for installation: #{PACKAGES}"
      Yast::PackagesProposal.SetResolvables(PROPOSAL_ID, :package, PACKAGES)
    end

    def copy_files
      log.info "Copying proxy configuration to the target system"
      FileUtils.cp(CONFIG_PATH, File.join(Yast::Installation.destdir, CONFIG_PATH))
    end
  end
end
