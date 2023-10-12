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
  # Handles everything related to registration of system to SCC, RMT or similar
  class Registration
    attr_reader :reg_code

    attr_reader :email

    module Requirement
      NOT_REQUIRED = :not_required
      OPTIONAL = :optional
      MANDATORY = :mandatory
    end

    # initializes registration with instance of software manager for query about products
    def initialize(software_manager, logger)
      @software = software_manager
      @logger = logger
    end

    def register(code, email: "")
      return unless product

      connect_params = {
        token: code,
        email: email
      }

      login, password = SUSE::Connect::YaST.announce_system(connect_params, target_distro)
      # write the global credentials
      # TODO: check if we can do it in memory for libzypp
      SUSE::Connect::YaST.create_credentials_file(login, password)

      # TODO: fill it properly for scc
      target_product = OpenStruct.new(
        arch:       Yast::Arch.rpm_arch,
        identifier: product.id,
        version:    product.version
      )
      activate_params = {}
      @service = SUSE::Connect::YaST.activate_product(target_product, activate_params, email)
      Y2Packager::NewRepositorySetup.instance.add_service(@service.name)
      add_service(@service)

      @reg_code = code
      @email = email
      run_on_change_callbacks
    end

    def deregister
      Y2Packager::NewRepositorySetup.instance.services.delete(@service.name)
      remove_service(@service)

      connect_params = {
        token: reg_code,
        email: email
      }
      SUSE::Connect::YaST.deactivate_system(connect_params)
      FileUtils.rm(SUSE::Connect::YaST::GLOBAL_CREDENTIALS_FILE) # connect does not remove it itself

      # reset varibles here
      @reg_code = nil
      @email = nil
      run_on_change_callbacks
    end

    def requirement
      return Requirement::NOT_REQUIRED unless product
      return Requirement::MANDATORY if product.repositories.none?

      Requirement::NOT_REQUIRED
    end

    # callback when state changed like when different product is selected
    def on_change(&block)
      @on_change_callbacks ||= []
      @on_change_callbacks << block
    end

  private

    attr_reader :software

    def product
      software.product
    end

    # E.g., "ALP-Dolomite-1-x86_64"
    def target_distro
      v = version.to_s.split(".").first || "1"
      "#{product.id}-#{v}-#{Yast::Arch.rpm_arch}"
    end

    def run_on_change_callbacks
      @on_change_callbacks&.map(&:call)
    end

    # code is based on https://github.com/yast/yast-registration/blob/master/src/lib/registration/sw_mgmt.rb#L365
    # TODO: move it to software manager
    # rubocop:disable Metrics/AbcSize
    def add_service(service)
      # save repositories before refreshing added services (otherwise
      # pkg-bindings will treat them as removed by the service refresh and
      # unload them)
      if !Yast::Pkg.SourceSaveAll
        # error message
        @logger.error("Saving repository configuration failed.")
      end

      @logger.info "Adding service #{service.name.inspect} (#{service.url})"
      if !Yast::Pkg.ServiceAdd(service.name, service.url.to_s)
        raise format("Adding service '%s' failed.", service.name)
      end

      if !Yast::Pkg.ServiceSet(service.name, "autorefresh" => true)
        # error message
        raise format("Updating service '%s' failed.", service.name)
      end

      # refresh works only for saved services
      if !Yast::Pkg.ServiceSave(service_name)
        # error message
        raise format("Saving service '%s' failed.", service_name)
      end

      # Force refreshing due timing issues (bnc#967828)
      if !Yast::Pkg.ServiceForceRefresh(service_name)
        # error message
        raise format("Refreshing service '%s' failed.", service_name)
      end
    ensure
      Pkg.SourceSaveAll
    end
    # rubocop:enable Metrics/AbcSize

    # TODO: move it to software manager
    def remove_service(service)
      if Yast::Pkg.ServiceDelete(service.name) && !Pkg.SourceSaveAll
        raise format("Removing service '%s' failed.", service_name)
      end

      true
    end
  end
end
