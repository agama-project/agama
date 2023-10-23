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

Yast.import "Arch"

module Agama
  # Handles everything related to registration of system to SCC, RMT or similar.
  class Registration
    # Code used for registering the product.
    #
    # @return [String, nil] nil if the product is not registered yet.
    attr_reader :reg_code

    # Email used for registering the product.
    #
    # @return [String, nil]
    attr_reader :email

    module Requirement
      NOT_REQUIRED = :not_required
      OPTIONAL = :optional
      MANDATORY = :mandatory
    end

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

      connect_params = {
        token: code,
        email: email
      }

      login, password = SUSE::Connect::YaST.announce_system(connect_params, target_distro)
      # write the global credentials
      # TODO: check if we can do it in memory for libzypp
      SUSE::Connect::YaST.create_credentials_file(login, password)

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
        SUSE::Connect::YaST.create_credentials_file(login, password, @credentials_file)
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

      connect_params = {
        token: reg_code,
        email: email
      }
      SUSE::Connect::YaST.deactivate_system(connect_params)
      FileUtils.rm(SUSE::Connect::YaST::GLOBAL_CREDENTIALS_FILE) # connect does not remove it itself
      if @credentials_file
        FileUtils.rm(credentials_path(@credentials_file))
        @credentials_file = nil
      end

      @reg_code = nil
      @email = nil
      run_on_change_callbacks
    end

    # Copies credentials files to the target system.
    def finish
      return unless reg_code

      files = [credentials_path(@credentials_file), SUSE::Connect::YaST::GLOBAL_CREDENTIALS_FILE]
      files.each do |file|
        dest = File.join(Yast::Installation.destdir, file)
        FileUtils.cp(file, dest)
      end
    end

    # Indicates whether the registration is optional, mandatory or not required.
    #
    # @return [Symbol] See {Requirement}.
    def requirement
      return Requirement::NOT_REQUIRED unless product
      return Requirement::MANDATORY if product.repositories.none?

      Requirement::NOT_REQUIRED
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
  end
end
