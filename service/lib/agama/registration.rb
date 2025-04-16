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
require "y2packager/resolvable"

require "agama/cmdline_args"
require "agama/errors"
require "agama/registered_addon"
require "agama/ssl/certificate"
require "agama/ssl/certificate_details"
require "agama/ssl/errors"

Yast.import "Arch"
Yast.import "Pkg"

module Agama
  # Handles everything related to registration of system to SCC, RMT or similar.
  class Registration
    include Yast::I18n

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

    # List of already registered addons
    #
    # @return [Array<RegisteredAddon>]
    attr_reader :registered_addons

    # @param software_manager [Agama::Software::Manager]
    # @param logger [Logger]
    def initialize(software_manager, logger)
      @software = software_manager
      @logger = logger
      @services = []
      @credentials_files = []
      @registered_addons = []
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

      catch_registration_errors do
        reg_params = connect_params(token: code, email: email)

        @login, @password = SUSE::Connect::YaST.announce_system(reg_params, target_distro)
        # write the global credentials
        # TODO: check if we can do it in memory for libzypp
        SUSE::Connect::YaST.create_credentials_file(@login, @password, GLOBAL_CREDENTIALS_PATH)

        activate_params = {}
        service = SUSE::Connect::YaST.activate_product(base_target_product, activate_params, email)
        process_service(service)

        @reg_code = code
        @email = email
        run_on_change_callbacks
      end
    end

    def register_addon(name, version, code)
      catch_registration_errors do
        register_version = if version.empty?
          # version is not specified, find it automatically
          find_addon_version(name)
        else
          # use the explicitly required version
          version
        end

        if @registered_addons.any? { |a| a.name == name && a.version == register_version }
          @logger.info "Addon #{name}-#{register_version} already registered, skipping registration"
          return
        end

        @logger.info "Registering addon #{name}-#{register_version}"
        # do not log the code, but at least log if it is empty
        @logger.info "Using empty registration code" if code.empty?

        target_product = OpenStruct.new(
          arch:       Yast::Arch.rpm_arch,
          identifier: name,
          version:    register_version
        )
        activate_params = { token: code }
        service = SUSE::Connect::YaST.activate_product(target_product, activate_params, @email)
        process_service(service)

        @registered_addons << RegisteredAddon.new(name, register_version, !version.empty?, code)
        # select the products to install
        @software.addon_products(find_addon_products)

        run_on_change_callbacks
      end
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

      @services.each do |service|
        Y2Packager::NewRepositorySetup.instance.services.delete(service.name)
        @software.remove_service(service)
      end

      # reset
      @software.addon_products([])
      @services = []
      @available_addons = nil

      reg_params = connect_params(token: reg_code, email: email)
      SUSE::Connect::YaST.deactivate_system(reg_params)
      FileUtils.rm(GLOBAL_CREDENTIALS_PATH) # connect does not remove it itself
      @credentials_files.each do |credentials_file|
        FileUtils.rm(File.join(TARGET_DIR, credentials_path(credentials_file)))
      end
      @credentials_files = []

      @reg_code = nil
      @email = nil
      @registered_addons = []

      run_on_change_callbacks
    end

    # Copies configuration and credentials files to the target system.
    #
    # The configuration file is copied only if a registration URL was given.
    def finish
      return unless reg_code

      files = [[
        GLOBAL_CREDENTIALS_PATH, File.join(Yast::Installation.destdir, GLOBAL_CREDENTIALS_PATH)
      ]]
      @credentials_files.each do |credentials_file|
        files << [
          File.join(TARGET_DIR, credentials_path(credentials_file)),
          File.join(Yast::Installation.destdir, credentials_path(credentials_file))
        ]
      end

      if registration_url
        SUSE::Connect::YaST.write_config("url" => registration_url)
        files << [
          SUSE::Connect::Config::DEFAULT_CONFIG_FILE,
          File.join(Yast::Installation.destdir, SUSE::Connect::Config::DEFAULT_CONFIG_FILE)
        ]
      end

      files.each do |src_dest|
        FileUtils.cp(*src_dest)
      end
    end

    # Get the available addons for the specified base product.
    #
    # @note The result is bound to the registration code used for the base product, the result
    # might be different for different codes. E.g. the Alpha/Beta extensions might or might not
    # be included in the list.
    def available_addons
      return @available_addons if @available_addons

      @available_addons = SUSE::Connect::YaST.show_product(base_target_product,
        connect_params).extensions
      @logger.info "Available addons: #{available_addons.inspect}"
      @available_addons
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
      default_params[:verify_callback] = verify_callback
      default_params.merge(params)
    end

    # returns SSL verify callback
    def verify_callback
      lambda do |verify_ok, context|

        # we cannot raise an exception with details here (all exceptions in
        # verify_callback are caught and ignored), we need to store the error
        # details in a global instance
        store_ssl_error(context) unless verify_ok

        verify_ok
      rescue StandardError => e
        @logger.error "Exception in SSL verify callback: #{e.class}: #{e.message} : #{e.backtrace}"
        # the exception will be ignored, but reraise anyway...
        raise e

      end
    end

    def store_ssl_error(context)
      @logger.error "SSL verification failed: #{context.error}: #{context.error_string}"
      SSL::Errors.instance.ssl_error_code = context.error
      SSL::Errors.instance.ssl_error_msg = context.error_string
      SSL::Errors.instance.ssl_failed_cert =
        context.current_cert ? SSL::Certificate.load(context.current_cert) : nil
    end

    def catch_registration_errors(&block)
      # import the SSL certificate just once to avoid an infinite loop
      certificate_imported = false
      begin
        # reset the previous SSL errors
        Agama::SSL::Errors.instance.reset

        block.call

        true
      rescue OpenSSL::SSL::SSLError => e
        @logger.error "OpenSSL error: #{e}"
        should_retry = handle_ssl_error(e, certificate_imported)
        if should_retry
          certificate_imported = true
          SSL::Errors.instance.ssl_failed_cert.import
          retry
        end
        raise e
      end
    end

    def handle_ssl_error(_error, certificate_imported)
      return false if certificate_imported

      cert = SSL::Errors.instance.ssl_failed_cert
      error_code = SSL::Errors.instance.ssl_error_code

      puts "cert #{cert} code #{error_code}"
      if cert && SSL::ErrorCodes::IMPORT_ERROR_CODES.include?(error_code)
        error_msg = format(
          _("Secure Connection Error for %{url}: %{error}."),
          url:     registration_url || "https://scc.suse.com",
          error:   SSL::ErrorCodes::OPENSSL_ERROR_MESSAGES[error_code],
        )
        cert_details = format(
          _("Certificate details %{details}."),
          details: SSL::CertificateDetails.new(cert).summary
        )

        message = "<p>#{error_msg}</p><p>#{cert_details}</p>"

        question = Agama::Question.new(
          qclass:         "registration.certificate",
          text:           message,
          options:        [:Import, :Abort],
          default_option: :Abort
        )

        questions_client = Agama::DBus::Clients::Questions.new(logger: @logger)
        questions_client.ask(question) do |question_client|
          return question_client.answer == :Import
        end
      end

      false
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

    # process a newly added service, create the credentials file and add the service to libzypp
    def process_service(service)
      @services << service
      credentials_file = credentials_from_url(service.url)
      if credentials_file
        @credentials_files << credentials_file
        # addons use the same SCC credentials as the base product
        SUSE::Connect::YaST.create_credentials_file(@login, @password,
          File.join(TARGET_DIR, credentials_path(credentials_file)))
      end
      Y2Packager::NewRepositorySetup.instance.add_service(service.name)
      @software.add_service(service)
    end

    # Find all addon products
    #
    # @return [Array<String>] names of the products
    def find_addon_products
      # find all repositories for registered addons (their services)
      addon_repos = @services.reduce([]) do |acc, service|
        # skip the first service, it belongs to the base product
        next acc if service == @services.first

        acc.concat(service_repos(service))
      end

      # find all products from those repositories
      products = Y2Packager::Resolvable.find(kind: :product)
      products.select! do |product|
        addon_repos.any? { |addon_repo| product.source == addon_repo["SrcId"] }
      end

      products.map!(&:name)
      @logger.info "Addon products to install: #{products}"

      products
    end

    # Find all repositories belonging to a service.
    #
    # @param product_service [OpenStruct] repository service from suseconnect
    #
    # @return [Array<Hash>] repository data as returned by the Pkg.SourceGeneralData
    #   call, additionally with the "SrcId" key
    def service_repos(product_service)
      @logger.info "product_service: #{product_service.inspect}"
      repo_data = Yast::Pkg.SourceGetCurrent(false).map { |repo| repository_data(repo) }

      service_name = product_service.name
      # select only repositories belonging to the product services
      repos = repo_data.select { |repo| service_name == repo["service"] }
      @logger.info "Service #{service_name.inspect} repositories: #{repos}"

      repos
    end

    # Get repository data
    # @param [Fixnum] repo repository ID
    # @return [Hash] repository properties, including the repository ID ("SrcId" key)
    def repository_data(repo)
      data = Yast::Pkg.SourceGeneralData(repo)
      data["SrcId"] = repo
      data
    end

    # Find the version for the specified addon, if none if multiple addons with the same name
    # are found an exception is thrown.
    #
    # @return [String] the addon version, e.g. "16.0"
    def find_addon_version(name)
      raise Errors::Registration::ExtensionNotFound, name unless available_addons

      requested_addons = available_addons.select { |a| a.identifier == name }
      case requested_addons.size
      when 0
        raise Errors::Registration::ExtensionNotFound, name
      when 1
        requested_addons.first.version
      else
        raise Errors::Registration::MultipleExtensionsFound.new(name,
          requested_addons.map(&:version))
      end
    end

    # Construct the base product data for sending to the server
    def base_target_product
      OpenStruct.new(
        arch:       Yast::Arch.rpm_arch,
        identifier: product.id,
        version:    product.version || "1.0"
      )
    end
  end
end
