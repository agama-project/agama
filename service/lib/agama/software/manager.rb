# frozen_string_literal: true

# Copyright (c) [2021-2025] SUSE LLC
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
require "json"
require "shellwords"
require "yast"
require "packager/cfa/zypp_conf"
require "cfa/augeas_parser"
require "y2packager/product"
require "y2packager/resolvable"
require "agama/config"
require "agama/helpers"
require "agama/issue"
require "agama/registration"
require "agama/software/callbacks"
require "agama/software/product"
require "agama/software/product_builder"
require "agama/software/proposal"
require "agama/software/repositories_manager"
require "agama/with_locale"
require "agama/with_progress_manager"
require "agama/with_issues"

Yast.import "Installation"
Yast.import "Language"
Yast.import "Package"
Yast.import "Packages"
Yast.import "PackageCallbacks"
Yast.import "Pkg"

module Agama
  module Software
    class ServiceError < StandardError; end

    # This class is responsible for software handling.
    #
    # FIXME: This class has too many responsibilities:
    #   * Address the software service workflow (probe, propose, install).
    #   * Manages repositories, packages, patterns, services.
    #   * Manages product selection.
    #   * Manages software and product related issues.
    #
    #   It should be splitted in separate and smaller classes.
    class Manager # rubocop:disable Metrics/ClassLength
      include Helpers
      include WithLocale
      include WithIssues
      include WithProgressManager
      include Yast::I18n

      GPG_KEYS_GLOB = "/usr/lib/rpm/gnupg/keys/gpg-*"
      private_constant :GPG_KEYS_GLOB

      # location of the custom DUD package repository,
      # see the /usr/lib/dracut/modules.d/99agama-dud/agama-dud-apply.sh script
      DUD_REPOSITORY_DIR = "/var/lib/agama/dud/repo"
      private_constant :DUD_REPOSITORY_DIR

      # name for the custom DUD package repository, use some special name to
      # minimize possible conflicts with user defined repositories, ugly name
      # does not matter, it is deleted in the end anyway
      DUD_REPOSITORY_NAME = "AgamaDriverUpdate"
      private_constant :DUD_REPOSITORY_NAME

      # use a higher priority for the custom DUD package repository,
      # the default priority is 99, the lower number the higher priority!
      # the linuxrc default is 50, let's use the same value here as well
      DUD_REPOSITORY_PRIORITY = 50
      private_constant :DUD_REPOSITORY_PRIORITY

      # Selected product.
      #
      # @return [Agama::Product, nil]
      attr_reader :product

      DEFAULT_LANGUAGES = ["en_US"].freeze
      private_constant :DEFAULT_LANGUAGES

      PROPOSAL_ID = "agama-user-software-selection"
      private_constant :PROPOSAL_ID

      # create the libzypp lock and the zypp caches in a special directory to
      # not be affected by the Live system package management
      TARGET_DIR = "/run/agama/zypp"
      private_constant :TARGET_DIR

      attr_accessor :languages

      # Available products for installation.
      #
      # @return [Array<Agama::Product>]
      attr_reader :products

      # @return [Agama::RepositoriesManager]
      attr_reader :repositories

      # @param config [Agama::Config]
      # @param logger [Logger]
      def initialize(config, logger)
        textdomain "agama"

        @config = config
        @logger = logger
        @languages = DEFAULT_LANGUAGES
        @products = build_products
        @product = find_initial_product
        @repositories = RepositoriesManager.instance
        # patterns selected by user
        @user_patterns = []
        @selected_patterns_change_callbacks = []
        on_progress_change { logger.info(progress.to_s) }
        Yast::PackageCallbacks.InitPackageCallbacks(logger)
        initialize_target
      end

      def self.dud_repository_url
        "dir:#{DUD_REPOSITORY_DIR}"
      end

      # Selects a product with the given id.
      #
      # @raise {ArgumentError} If id is unknown.
      #
      # @param id [String]
      # @return [Boolean] true on success.
      def select_product(id)
        return false if id == product&.id

        new_product = @products.find { |p| p.id == id }

        raise ArgumentError unless new_product

        proposal.set_resolvables(
          PROPOSAL_ID, :pattern, new_product.preselected_patterns
        )
        update_repositories(new_product)

        @product = new_product

        update_issues
        true
      end

      # select additional products to install
      # @param addon_products [Array<String>] list of product names
      def addon_products(addon_products)
        # The PackagesProposal module can handle only packages and patterns,
        # so products need to be handled differently.
        proposal.addon_products = addon_products
      end

      def probe
        # Should an error be raised?
        return unless product

        logger.info "Probing software"

        common_steps = [
          _("Refreshing repositories metadata"),
          _("Calculating the software proposal")
        ]
        if repositories.empty?
          start_progress_with_descriptions(
            _("Initializing sources"), *common_steps
          )
          progress.step { add_base_repos }
        else
          start_progress_with_descriptions(*common_steps)
        end

        progress.step { repositories.load }
        progress.step { propose }

        update_issues
      end

      def initialize_target
        # create the zypp lock also in the target directory
        ENV["ZYPP_LOCKFILE_ROOT"] = TARGET_DIR
        # cleanup the previous content (after service restart or crash)
        FileUtils.rm_rf(TARGET_DIR)
        FileUtils.mkdir_p(TARGET_DIR)
        Yast::Pkg.TargetInitialize(TARGET_DIR)
        import_gpg_keys
      end

      # Updates the software proposal
      def propose
        # Should an error be raised?
        return unless product

        proposal.base_product = product.name
        proposal.languages = languages
        select_resolvables
        result = proposal.calculate
        update_issues
        logger.info "Proposal result: #{result.inspect}"
        selected_patterns_changed
        result
      end

      # Installs the packages to the target system
      def install
        # move the target from the Live ISO to the installed system (/mnt)
        Yast::Pkg.TargetFinish
        Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
        Yast::Pkg.TargetLoad

        steps = proposal.packages_count
        start_progress_with_size(steps)
        Callbacks::Progress.setup(steps, progress, logger)

        # TODO: error handling
        commit_result = Yast::Pkg.Commit({})

        if commit_result.nil? || commit_result.empty?
          logger.error("Commit failed")
          raise Yast::Pkg.LastError
        end

        logger.info "Commit result #{commit_result}"
      rescue Agama::NotFinishedProgress => e
        logger.error "There is an unfinished progress: #{e.inspect}"
        finish_progress
      end

      # Writes the repositories information to the installed system
      def finish
        # disable local repositories (DVD, USB flash...)
        disable_local_repos
        remove_dud_repo
        Yast::Pkg.SourceSaveAll
        Yast::Pkg.TargetFinish
        # copy the libzypp caches to the target
        if Agama::Software::Repository.all.empty?
          logger.info("No repository defined, not copying the libzypp caches")
        else
          copy_zypp_to_target
        end
        registration.finish
        modify_zypp_conf
      end

      # Determine whether the given tag is provided by the selected packages
      #
      # @param tag [String] Tag to search for (package names, requires/provides, or file
      #   names)
      # @return [Boolean] true if it is provided; false otherwise
      def provision_selected?(tag)
        Yast::Pkg.IsSelected(tag) || Yast::Pkg.IsProvided(tag)
      end

      # Enlist available patterns
      #
      # @param filtered [Boolean] If list of patterns should be filtered.
      #                           Filtering criteria can change.
      # @return [Array<Y2Packager::Resolvable>]
      # rubocop:disable Metrics/CyclomaticComplexity
      # rubocop:disable Metrics/PerceivedComplexity
      def patterns(filtered)
        # huge speed up, preload the used attributes to avoid querying libzypp again,
        # see "ListPatterns" method in service/lib/agama/dbus/software/manager.rb
        preload = [:category, :description, :icon, :summary, :order, :source, :user_visible]
        patterns = Y2Packager::Resolvable.find({ kind: :pattern }, preload)
        patterns = patterns.select(&:user_visible) if filtered

        # only display the configured patterns from the base product, from addons display everything
        if product.user_patterns && filtered
          base_repos = base_repositories

          user_patterns_names = (product.user_patterns || []).map(&:name)
          patterns.select! do |p|
            # the pattern is not from a base repository or is included in the display list
            !base_repos.include?(p.source) || user_patterns_names.include?(p.name)
          end
        end

        patterns
      end
      # rubocop:enable Metrics/CyclomaticComplexity
      # rubocop:enable Metrics/PerceivedComplexity

      def add_pattern(id)
        return false unless pattern_exist?(id)

        res = Yast::Pkg.ResolvableInstall(id, :pattern)
        logger.info "Adding pattern #{res.inspect}"
        Yast::PackagesProposal.AddResolvables(PROPOSAL_ID, :pattern, [id])
        proposal.solve_dependencies
        selected_patterns_changed

        true
      end

      def remove_pattern(id)
        return false unless pattern_exist?(id)

        res = Yast::Pkg.ResolvableNeutral(id, :pattern, force = false)
        logger.info "Removing pattern #{res.inspect}"
        Yast::PackagesProposal.RemoveResolvables(PROPOSAL_ID, :pattern, [id])
        proposal.solve_dependencies
        selected_patterns_changed

        true
      end

      def assign_patterns(add, remove)
        wrong_patterns = [add, remove].flatten.reject { |p| pattern_exist?(p) }
        return wrong_patterns unless wrong_patterns.empty?

        user_patterns = Yast::PackagesProposal.GetResolvables(PROPOSAL_ID, :pattern)
        user_patterns.each { |p| Yast::Pkg.ResolvableNeutral(p, :pattern, force = false) }
        logger.info "Adding patterns: #{add.inspect}, removing patterns: #{remove.inspect}"

        Yast::PackagesProposal.SetResolvables(PROPOSAL_ID, :pattern, add)
        add.each do |id|
          res = Yast::Pkg.ResolvableInstall(id, :pattern)
          logger.info "Adding pattern #{id}: #{res.inspect}"
        end

        remove.each do |id|
          res = Yast::Pkg.ResolvableNeutral(id, :pattern, force = false)
          logger.info "Removing pattern #{id}: #{res.inspect}"
          Yast::PackagesProposal.RemoveResolvables(PROPOSAL_ID, :pattern, [id])
        end

        proposal.solve_dependencies

        selected_patterns_changed

        []
      end

      # @return [Array<Array<String>,Array<String>] returns pair of arrays where the first one
      #   is user selected pattern ids and in other is auto selected ones
      def selected_patterns
        user_patterns = Yast::PackagesProposal.GetResolvables(PROPOSAL_ID, :pattern)

        patterns = Y2Packager::Resolvable.find(kind: :pattern, status: :selected)
        patterns.map!(&:name)
        logger.info "Currently selected patterns: #{patterns.inspect}"

        patterns.partition { |p| user_patterns.include?(p) }
      end

      def update_selected_patterns
        user_patterns = Yast::PackagesProposal.GetResolvables(PROPOSAL_ID, :pattern)
        patterns = Y2Packager::Resolvable.find(kind: :pattern, status: :selected).map!(&:name)

        unselect_patterns = user_patterns - patterns
        unselect_patterns.each do |id|
          logger.info "Unselecting pattern #{id}"
          Yast::PackagesProposal.RemoveResolvables(PROPOSAL_ID, :pattern, [id])
        end

        selected_patterns_changed if !unselect_patterns.empty?
      end

      def on_selected_patterns_change(&block)
        @selected_patterns_change_callbacks << block
      end

      # Determines whether a package is installed in the target system.
      #
      # @param name [String] Package name
      # @return [Boolean] true if it is installed; false otherwise
      def package_installed?(name)
        on_target { Yast::Package.Installed(name, target: :system) }
      end

      # Determines whether a package is available.
      #
      # @param name [String] Package name
      # @return [Boolean]
      def package_available?(name)
        # Beware: apart from true and false, Available can return nil if things go wrong.
        on_local { !!Yast::Package.Available(name) }
      end

      # Counts how much disk space installation will use.
      # @return [String]
      # @note Reimplementation of Yast::Package.CountSizeToBeInstalled
      # @todo move to Software::Proposal
      def used_disk_space
        return "" unless proposal.valid?

        # FormatSizeWithPrecision(bytes, precision, omit_zeroes)
        Yast::String.FormatSizeWithPrecision(proposal.packages_size, 1, true)
      end

      def registration
        @registration ||= Registration.new(self, logger)
      end

      # code is based on https://github.com/yast/yast-registration/blob/master/src/lib/registration/sw_mgmt.rb#L365
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
          raise ServiceError, format(_("Adding service '%s' failed."), service.name)
        end

        if !Yast::Pkg.ServiceSet(service.name, "autorefresh" => true)
          # error message
          raise ServiceError, format(_("Updating service '%s' failed."), service.name)
        end

        # refresh works only for saved services
        if !Yast::Pkg.ServiceSave(service.name)
          # error message
          raise ServiceError, format(_("Saving service '%s' failed."), service.name)
        end

        # Force refreshing due timing issues (bnc#967828)
        if !Yast::Pkg.ServiceForceRefresh(service.name)
          # error message
          raise ServiceError, format(_("Refreshing service '%s' failed."), service.name)
        end
      ensure
        Yast::Pkg.SourceSaveAll
      end
      # rubocop:enable Metrics/AbcSize

      def remove_service(service)
        if Yast::Pkg.ServiceDelete(service.name) && !Yast::Pkg.SourceSaveAll
          raise ServiceError, format(_("Removing service '%s' failed."), service_name)
        end

        true
      end

      # Issues associated to the product.
      #
      # These issues are not considered as software issues, see {#update_issues}.
      #
      # @return [Array<Agama::Issue>]
      def product_issues
        issues = []
        issues << missing_product_issue unless product
        issues << missing_registration_issue if missing_registration?
        issues
      end

      # Change the locale and activate new locale in the libzypp backend
      #
      # @param locale [String] the new locale
      def locale=(locale)
        change_process_locale(locale)
        language, = locale.split(".")

        # set the locale in the Language module, when changing the repository
        # (product) it calls Pkg.SetTextLocale(Language.language) internally
        Yast::Language.Set(language)

        # set libzypp locale (for communication only, Pkg.SetPackageLocale
        # call can be used for *installing* the language packages)
        Yast::Pkg.SetTextLocale(language)

        # refresh all enabled repositories to download the missing translation files
        Yast::Pkg.SourceGetCurrent(true).each do |src|
          Yast::Pkg.SourceForceRefreshNow(src)
        end

        # remember the currently selected packages and patterns by YaST
        # (ignore the automatic selections done by the solver)
        #
        # NOTE: we will need to handle also the tabooed and soft-locked objects
        # when we allow to set them via UI or CLI
        selected = Y2Packager::Resolvable.find(status: :selected, transact_by: :appl_high)

        # save and reload all repositories to activate the new translations
        Yast::Pkg.SourceSaveAll
        Yast::Pkg.SourceFinishAll
        Yast::Pkg.SourceRestore
        Yast::Pkg.SourceLoad

        # restore back the selected objects
        selected.each { |s| Yast::Pkg.ResolvableInstall(s.name, s.kind) }
      end

      def proposal
        @proposal ||= Proposal.new.tap do |proposal|
          proposal.on_issues_change { update_issues }
        end
      end

    private

      # @return [Agama::Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      # Generates a list of products according to the information of the config file.
      #
      # @return [Array<Agama::Software::Product>]
      def build_products
        ProductBuilder.new(config).build
      end

      # Determines the initially selected product.
      #
      # A product is automatically selected if it is the only product
      # and it does not require acccepting a license.
      def find_initial_product
        product = @products.first
        return product if @products.size == 1 && product.license.to_s.empty?

        nil
      end

      def import_gpg_keys
        gpg_keys = Dir.glob(GPG_KEYS_GLOB).map(&:to_s)
        logger.info "Importing GPG keys: #{gpg_keys}"
        gpg_keys.each do |path|
          Yast::Pkg.ImportGPGKey(path, true)
        end
      end

      def add_base_repos
        add_dud_repo
        return if add_repos_by_label
        return if add_repos_by_dir

        # local repositories not found, use the online repositories
        product.repositories.each { |url| repositories.add(url) }
      end

      def add_repos_by_dir
        # path to the installation repository present on the Live medium (only on the Full medium)
        dir_path = "/run/initramfs/live/install"
        return false unless File.exist?(dir_path)

        logger.info "/install found on Live medium"
        url = full_repo_url(dir_path, "/install")
        return false unless url

        logger.info "Using Full media installation repository #{url}"
        # disable autorefresh, the packages on DVD cannot be updated, for USB flash disks it can be
        # manually enabled in the installed system if needed (updating the packages need some user
        # interaction anyway)
        repositories.add(url, repo_alias: product.name, name: product.display_name,
          autorefresh: false)

        true
      end

      def add_repos_by_label
        # NOTE: support multiple labels/installation media?
        label = product.labels.first

        if label
          logger.info "Installation repository label: #{label.inspect}"
          # we cannot use the simple /dev/disk/by-label/* device file as there
          # might be multiple devices with the same label
          device = installation_device(label)
          if device
            logger.info "Installation device: #{device}"
            repositories.add("hd:/?device=" + device)
            return true
          end
        end

        false
      end

      # add a custom repository provided by DUD
      def add_dud_repo
        return unless File.directory?(DUD_REPOSITORY_DIR) && !Dir.empty?(DUD_REPOSITORY_DIR)

        logger.info "Adding DUD repository at #{DUD_REPOSITORY_DIR}"
        # if there is no repository metadata present in the dir:/ repository then libzypp
        # automatically uses the "plaindir" repository type
        repositories.add(self.class.dud_repository_url, repo_alias: DUD_REPOSITORY_NAME,
          name: DUD_REPOSITORY_NAME, priority: DUD_REPOSITORY_PRIORITY)
      end

      # find all devices with the required disk label
      # @return [Array<String>] returns list of devices, e.g. `["/dev/sr1"]`,
      # returns empty list if there is no device with the required label
      def disks_with_label(label)
        data = list_disks
        disks = data.fetch("blockdevices", []).map do |device|
          device["kname"] if device["label"] == label
        end
        disks.compact!
        logger.info "Disks with the installation label: #{disks.inspect}"
        disks
      end

      # get list of disks, returns parsed data from the `lsblk` call
      # @return [Hash] parsed data
      def list_disks
        # we need only the kernel device name and the label
        output = `lsblk --paths --json --output kname,label`
        JSON.parse(output)
      rescue StandardError => e
        logger.error "ERROR: Cannot read disk devices: #{e}"
        {}
      end

      # find the installation device with the required label
      # @return [String,nil] Device name (`/dev/sr1`) or `nil` if not found
      def installation_device(label)
        disks = disks_with_label(label)

        # multiple installation media?
        if disks.size > 1
          # prefer optical media (/dev/srX) to disk so the disk can be used as
          # the installation target
          optical = disks.find { |d| d.match(/\A\/dev\/sr[0-9]+\z/) }
          optical || disks.first
        else
          # none or just one disk
          disks.first
        end
      end

      # build URL for the Full installation repository
      # @param path [String] Local path where the Full repository is mounted
      # @param url_path [String] Path part of the resulting URL
      # @return [String,nil] URL or `nil` if the Full repository device was not found
      def full_repo_url(path, url_path)
        # find the device which is mounted at the repository location
        live_device = `findmnt -n -o SOURCE --target #{Shellwords.escape(path)}`.chomp
        logger.info "Installation device: #{live_device}"
        return nil unless live_device

        # distinguish between DVD and hard disks/USB flash
        if live_device.match(/\A\/dev\/sr[0-9]+\z/)
          "dvd:#{url_path}?devices=#{live_device}"
        else
          # try using a more stable by-id device name, important esp. for USB flash
          by_id_devices = `find -L /dev/disk/by-id -samefile #{Shellwords.escape(live_device)}`
            .chomp
          # if there are more names just use the first one
          by_id_device = by_id_devices.split("\n").first
          device = (by_id_device && !by_id_device.empty?) ? by_id_device : live_device
          "hd:#{url_path}?device=#{device}"
        end
      end

      # Adds resolvables for selected product
      def select_resolvables
        proposal.set_resolvables("agama", :pattern, product.mandatory_patterns)
        proposal.set_resolvables("agama", :pattern, product.optional_patterns, optional: true)
        proposal.set_resolvables("agama", :package, product.mandatory_packages)
        proposal.set_resolvables("agama", :package, product.optional_packages, optional: true)
      end

      def selected_patterns_changed
        @selected_patterns_change_callbacks.each(&:call)
      end

      # Updates the list of software issues.
      def update_issues
        self.issues = current_issues
      end

      # List of current software issues.
      #
      # @return [Array<Agama::Issue>]
      def current_issues
        return [] unless product

        issues = repos_issues

        # If none of the repositories could be probed, then do not report missing patterns and/or
        # packages. Those issues does not make any sense if there are no repositories to install
        # from.
        issues += proposal.issues if repositories.enabled.any?
        issues
      end

      # Issues related to the software proposal.
      #
      # Repositories that could not be probed are reported as errors.
      #
      # @return [Array<Agama::Issue>]
      def repos_issues
        repositories.disabled.map do |repo|
          Issue.new(_("Could not read repository \"%s\"") % repo.name,
            source:   Issue::Source::SYSTEM,
            severity: Issue::Severity::ERROR)
        end
      end

      # Issue when a product is missing
      #
      # @return [Agama::Issue]
      def missing_product_issue
        Issue.new(_("Product not selected yet"),
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end

      # Issue when a product requires registration but it is not registered yet.
      #
      # @return [Agama::Issue]
      def missing_registration_issue
        Issue.new(_("Product must be registered"),
          kind:     :missing_registration,
          source:   Issue::Source::SYSTEM,
          severity: Issue::Severity::ERROR)
      end

      # Whether the registration is missing.
      #
      # @return [Boolean]
      def missing_registration?
        return false unless product

        product.registration && missing_base_product?
      end

      # Whether the base product is missing
      #
      # @return [Boolean]
      def missing_base_product?
        products = Y2Packager::Resolvable.find(kind: :product, name: product.name)
        products.empty?
      end

      def pattern_exist?(pattern_name)
        !Y2Packager::Resolvable.find(kind: :pattern, name: pattern_name).empty?
      end

      # this reimplements the Pkg.SourceCacheCopyTo call which works correctly
      # only from the inst-sys (it copies the data from "/" where is actually
      # the Live system package manager)
      # @see https://github.com/yast/yast-pkg-bindings/blob/3d314480b70070299f90da4c6e87a5574e9c890c/src/Source_Installation.cc#L213-L267
      def copy_zypp_to_target
        # copy the zypp "raw" cache
        cache = File.join(TARGET_DIR, "/var/cache/zypp/raw")
        if Dir.exist?(cache)
          target_cache = File.join(Yast::Installation.destdir, "/var/cache/zypp")
          FileUtils.mkdir_p(target_cache)
          FileUtils.cp_r(cache, target_cache)
        end

        # copy the "solv" cache but skip the "@System" directory because it
        # contains empty installed packages (there were no installed packages
        # before moving the target to "/mnt")
        solv_cache = File.join(TARGET_DIR, "/var/cache/zypp/solv")
        target_solv = File.join(Yast::Installation.destdir, "/var/cache/zypp/solv")
        solvs = Dir.entries(solv_cache) - [".", "..", "@System"]
        solvs.each do |s|
          FileUtils.cp_r(File.join(solv_cache, s), target_solv)
        end

        # copy the zypp credentials if present
        credentials = File.join(TARGET_DIR, "/etc/zypp/credentials.d")
        if Dir.exist?(credentials)
          target_credentials = File.join(Yast::Installation.destdir, "/etc/zypp")
          FileUtils.mkdir_p(target_credentials)
          FileUtils.cp_r(credentials, target_credentials)
        end

        # copy the global credentials if present
        glob_credentials = File.join(TARGET_DIR, "/etc/zypp/credentials.cat")
        return unless File.exist?(glob_credentials)

        target_dir = File.join(Yast::Installation.destdir, "/etc/zypp")
        FileUtils.mkdir_p(target_dir)
        FileUtils.copy(glob_credentials, target_dir)
      end

      # private class to ensure that cfa reads installed system
      # YaST target file does not work reliably as Agama does not have
      # always switched SCR
      class TargetFile
        # Reads file content with respect of changed root in installation.
        def self.read(path)
          ::File.read(final_path(path))
        end

        # Writes file content with respect of changed root in installation.
        def self.write(path, content)
          ::File.write(final_path(path), content)
        end

        def self.final_path(path)
          ::File.join(Yast::Installation.destdir, path)
        end
        private_class_method :final_path
      end

      def modify_zypp_conf
        # use defaults unless user explicitelly sets flag
        return if proposal.only_required.nil?

        # minimal system does not need to have libzypp, so in this case do not
        # modify zypp.conf
        if !File.exist?(File.join(Yast::Installation.destdir, "/etc/zypp/zypp.conf"))
          logger.info "Target system does not have zypp.conf so skipping modification of it"
          return
        end

        zypp_conf = Yast::Packager::CFA::ZyppConf.new(file_handler: TargetFile)
        zypp_conf.load
        tree = zypp_conf.generic_get("main")
        if !tree
          tree = ::CFA::AugeasTree.new
          zypp_conf.generic_get("main", tree)
        end
        zypp_conf.generic_set("solver.onlyRequires", (!!proposal.only_required).to_s, tree)
        zypp_conf.save
      end

      # Is any local repository (CD/DVD, disk) currently used?
      # @return [Boolean] true if any local repository is used
      def local_repo?
        Agama::Software::Repository.all.any?(&:local?)
      end

      # update the zypp repositories for the new product, either delete them
      # or keep them untouched
      # @param new_product [Agama::Software::Product] the new selected product
      def update_repositories(new_product)
        # reuse the repositories when they are the same as for the previously
        # selected product and no local repository is currently used
        # (local repositories are usually product specific)
        # TODO: what about registered products?
        # TODO: allow a partial match? i.e. keep the same repositories, delete
        # additional repositories and add missing ones
        if product&.repositories&.sort == new_product.repositories.sort && !local_repo?
          # the same repositories, we just needed to reset the package selection
          Yast::Pkg.PkgReset()
        else
          # delete all, the #probe call will add the new repos
          repositories.delete_all
          # deleting happens only in memory, to really delete the caches we need
          # to write the repository setup to the disk
          Yast::Pkg.SourceSaveAll
        end
      end

      # disable all local repositories, remove device name from the DVD Full repository
      def disable_local_repos
        local_repos = Agama::Software::Repository.all.select(&:local?)
        local_repos.each(&:disable!)

        # remove the installation device from the URL, libzypp will probe all present devices,
        # this allows inserting the DVD medium into a different drive later
        full_dvd_repo = local_repos.find { |r| r.url.to_s.start_with?("dvd:/install?devices=") }
        return unless full_dvd_repo

        new_url = "dvd:/install"
        logger.info "Changing repository URL from #{full_dvd_repo.url} to #{new_url}"
        full_dvd_repo.url = new_url
      end

      def remove_dud_repo
        dud_repo = Agama::Software::Repository.all.find { |r| r.name == DUD_REPOSITORY_NAME }
        return unless dud_repo

        logger.info "Removing the temporary DUD repository"
        dud_repo.delete!
      end

      # Return all enabled repositories belonging to the base product.
      #
      # @return [Array<Integer>] List of repository IDs, returns empty list if
      # no repository is defined yet
      def base_repositories
        # process only the enabled repositories
        only_enabled_repos = true
        # the base product repo is the first added repository (the lowest number)
        base_src_id = Yast::Pkg.SourceGetCurrent(only_enabled_repos).min
        # a repository might not be defined yet
        return [] unless base_src_id

        # if the base repository comes from a service consider all repositories from that service
        # (SCC uses Pool + Updates, use both of them just in case a pattern is updated)
        service = Yast::Pkg.SourceGeneralData(base_src_id)["service"]

        if service.empty?
          [base_src_id]
        else
          logger.info "The base product is from a service"
          Yast::Pkg.SourceGetCurrent(only_enabled_repos).select do |r|
            Yast::Pkg.SourceGeneralData(r)["service"] == service
          end
        end
      end
    end
  end
end
