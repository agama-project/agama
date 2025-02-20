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

require "fileutils"
require "yast"
require "ostruct"
require "suse/connect"
require "y2packager/new_repository_setup"
require "agama/cmdline_args"

Yast.import "Arch"

module Agama
  # Handles everything related to registration of system to SCC, RMT or similar.
  class Registration
    # NOTE: identical and keep in sync with Software::Manager::TARGET_DIR
    TARGET_DIR = "/run/agama/zypp"
    private_constant :TARGET_DIR

    # FIXME: it should use TARGET_DIR instead of "/", but connect failed to read it even
    # if fs_root passed as client params. Check with SCC guys why.
    GLOBAL_CREDENTIALS_PATH = File.join("/",
      SUSE::Connect::YaST::GLOBAL_CREDENTIALS_FILE)
    private_constant :GLOBAL_CREDENTIALS_PATH

    # Code used for registering the product.
    #
    # @return [String, nil] nil if the product is not registered yet.
    attr_reader :reg_code

    # Email used for registering the product.
    #
    # @return [String, nil]
    attr_reader :email

    # @param software_manager [Agama::Software::Manager]
    # @param logger [Logger]
    def initialize(software_manager, logger)
      @software = software_manager
      @logger = logger
    end

    # Registers the selected product.
    #
    # @raise [
    #   SocketError|Timeout::Error|SUSE::Connect::ApiError|
    #   SUSE::Connect::MissingSccCredentialsFile|SUSE::Connect::MissingSccCredentialsFile|
    #   OpenSSL::SSL::SSLError|JSON::ParserError
    # ]
    #
    # @param code [String] Registration code.
    # @param email [String] Email for registering the product.
    def register(code, email: "")
      return if product.nil? || reg_code

      reg_params = connect_params(token: code, email: email)

      login, password = SUSE::Connect::YaST.announce_system(reg_params, target_distro)
      # write the global credentials
      # TODO: check if we can do it in memory for libzypp
      SUSE::Connect::YaST.create_credentials_file(login, password, GLOBAL_CREDENTIALS_PATH)

      target_product = OpenStruct.new(
        arch:       Yast::Arch.rpm_arch,
        identifier: product.id,
        version:    product.version || "1.0"
      )
      activate_params = {}
      @service = SUSE::Connect::YaST.activate_product(target_product, activate_params, email)
      # if service require specific credentials file, store it
      @credentials_file = credentials_from_url(@service.url)
      if @credentials_file
        SUSE::Connect::YaST.create_credentials_file(login, password,
          File.join(TARGET_DIR, credentials_path(@credentials_file)))
      end
      Y2Packager::NewRepositorySetup.instance.add_service(@service.name)
      @software.add_service(@service)

      @reg_code = code
      @email = email
      run_on_change_callbacks
    end

    # Deregisters the selected product.
    #
    # It uses the registration code and email passed to {#register}.
    #
    # @raise [
    #   SocketError|Timeout::Error|SUSE::Connect::ApiError|
    #   SUSE::Connect::MissingSccCredentialsFile|SUSE::Connect::MissingSccCredentialsFile|
    #   OpenSSL::SSL::SSLError|JSON::ParserError
    # ]
    def deregister
      return unless reg_code

      Y2Packager::NewRepositorySetup.instance.services.delete(@service.name)
      @software.remove_service(@service)

      reg_params = connect_params(token: reg_code, email: email)
      SUSE::Connect::YaST.deactivate_system(reg_params)
      FileUtils.rm(GLOBAL_CREDENTIALS_PATH) # connect does not remove it itself
      if @credentials_file
        FileUtils.rm(File.join(TARGET_DIR, credentials_path(@credentials_file)))
        @credentials_file = nil
      end

      @reg_code = nil
      @email = nil
      run_on_change_callbacks
    end

    # Copies credentials files to the target system.
    def finish
      return unless reg_code

      files = [[
        GLOBAL_CREDENTIALS_PATH, File.join(Yast::Installation.destdir, GLOBAL_CREDENTIALS_PATH)
      ]]
      if @credentials_file
        files << [
          File.join(TARGET_DIR, credentials_path(@credentials_file)),
          File.join(Yast::Installation.destdir, credentials_path(@credentials_file))
        ]
      end

      files.each do |src_dest|
        FileUtils.cp(*src_dest)
      end
    end

    # Callbacks to be called when registration changes (e.g., a different product is selected).
    def on_change(&block)
      @on_change_callbacks ||= []
      @on_change_callbacks << block
    end

  private

    # @return [Agama::Software::Manager]
    attr_reader :software

    # Currently selected product.
    #
    # @return [Agama::Software::Product, nil]
    def product
      software.product
    end

    # Product name expected by SCC.
    #
    # @return [String] E.g., "ALP-Dolomite-1-x86_64".
    def target_distro
      v = product.version.to_s.split(".").first || "1"
      "#{product.id}-#{v}-#{Yast::Arch.rpm_arch}"
    end

    def run_on_change_callbacks
      @on_change_callbacks&.map(&:call)
    end

    # taken from https://github.com/yast/yast-registration/blob/master/src/lib/registration/url_helpers.rb#L109
    def credentials_from_url(url)
      parsed_url = URI(url)
      params = URI.decode_www_form(parsed_url.query).to_h

      params["credentials"]
    rescue StandardError
      # if something goes wrong try to continue like if there is no credentials param
      nil
    end

    def credentials_path(file)
      File.join(SUSE::Connect::YaST::DEFAULT_CREDENTIALS_DIR, file)
    end

    # Returns the arguments to connect to the registration server
    #
    # @param params [Hash] additional parameters (e.g., email and token)
    # @return [Hash]
    def connect_params(params = {})
      default_params = {}
      default_params[:url] = registration_url if registration_url
      default_params.merge(params)
    end

    # Returns the URL of the registration server
    #
    # At this point, it just checks the kernel's command-line.
    #
    # @return [String, nil]
    def registration_url
      cmdline_args = CmdlineArgs.read
      cmdline_args.data["register_url"]
    end
  end
end
