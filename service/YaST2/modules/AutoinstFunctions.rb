# Vendored from yast-autoyast2's autoinstallation/src/modules/AutoinstFunctions.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "y2packager/product"
require "y2packager/product_reader"
require "y2packager/product_spec"
require "y2packager/medium_type"

module Yast
  # Helper methods to be used on autoinstallation.
  class AutoinstFunctionsClass < Module
    include Yast::Logger

    # special mapping for handling dropped or renamed products,
    # a map with <old product name> => <new_product name> values
    PRODUCT_MAPPING = {
      # the SLE_HPC product was dropped and replaced by standard SLES in SP6
      "SLE_HPC" => "SLES"
    }.freeze

    def main
      textdomain "installation"

      Yast.import "Stage"
      Yast.import "Mode"
      Yast.import "AutoinstConfig"
      Yast.import "InstURL"
      Yast.import "ProductControl"
      Yast.import "Profile"
      Yast.import "Pkg"

      # Force to read the list of products from libzypp. See {#check_result} for
      # further details.
      @force_libzypp = false
    end

    # Determines if the second stage should be executed
    #
    # Checks Mode, AutoinstConfig and ProductControl to decide if it's
    # needed.
    #
    # FIXME: It's almost equal to InstFunctions.second_stage_required?
    # defined in yast2-installation, but exists to avoid a circular dependency
    # between packages (yast2-installation -> autoyast2-installation).
    #
    # @return [Boolean] 'true' if it's needed; 'false' otherwise.
    def second_stage_required?
      return false unless Stage.initial

      if (Mode.autoinst || Mode.autoupgrade) && !AutoinstConfig.second_stage
        Builtins.y2milestone("Autoyast: second stage is disabled")
        false
      else
        ProductControl.RunRequired("continue", Mode.mode)
      end
    end

    # Checking the environment the installed system
    # to run a second stage if it is needed.
    #
    # @return [String] empty String or error messsage about missing packages.
    def check_second_stage_environment
      error = ""
      return error unless second_stage_required?

      missing_packages = Profile.needed_second_stage_packages.reject do |p|
        Pkg.IsSelected(p)
      end
      unless missing_packages.empty?
        log.warn "Second stage cannot be run due missing packages: #{missing_packages}"
        # TRANSLATORS: %s will be replaced by a package list
        error = format(_("AutoYaST cannot run second stage due to missing packages \n%s.\n"),
          missing_packages.join(", "))
        unless registered?
          if Profile.current["suse_register"] &&
              Profile.current["suse_register"]["do_registration"] == true
            error << _(
              "The registration has failed. " \
              "Please check your registration settings in the AutoYaST configuration file."
            )
            log.warn "Registration has been called but has failed."
          else
            error << _("You have not registered your system. " \
                       "Missing packages can be added by configuring the registration " \
                       "in the AutoYaST configuration file.")
            log.warn "Registration is not configured at all."
          end
        end
      end
      error
    end

    # Tries to find a base product if could be identified from the AY profile
    #
    # There are several ways how can base product be defined in the profile
    # 1) explicitly
    # 2) impllicitly according to software selection
    # 3) if not set explicitly and just one product is available on media - use it
    #
    # @return [Y2Packager::ProductSpec] a base product or nil.
    def selected_product
      return @selected_product if @selected_product

      profile = Profile.current
      product = identify_product_by_selection(profile)

      # user asked for a product which is not available -> exit, not found
      return nil if product.nil? && base_product_name(profile)

      @selected_product = if product
        log.info("selected_product - found explicitly defined base product: #{product.inspect}")
        product
      elsif (product = identify_product_by_patterns(profile))
        log.info("selected_product - base product identified by patterns: #{product.inspect}")
        product
      elsif (product = identify_product_by_packages(profile))
        log.info("selected_product - base product identified by packages: #{product.inspect}")
        product
      else
        # last instance
        base_products = available_base_products
        base_products.first if base_products.size == 1
      end

      @selected_product
    end

    #
    # Evaluate all available base products and returns a list of product.
    # CAUTION: The type of the return values depend of the kind of where
    # the product information has been read (libzypp, or product specs).
    # So the type could be Product or ProductSpec derived class.
    #
    # The behaviour of this method can be affected by the `force_libzypp` attribute.
    # Check {#reset_product} for further details.
    #
    # @return [Array<Y2Packager::Product|Y2Packager::ProductSpec>] List of base products
    def available_base_products
      return @base_products if @base_products

      @base_products = Y2Packager::ProductReader.new.available_base_products(
        force_repos: @force_libzypp
      )
      return @base_products if @force_libzypp

      libzypp_names = @base_products.map(&:name)
      Y2Packager::ProductSpec.base_products.each do |product|
        @base_products << product unless libzypp_names.include?(product.name)
      end

      @base_products
    end

    # force selected product to be read from libzypp and not from product location
    def reset_product
      @selected_product = nil
      @base_products = nil
      @force_libzypp = true
    end

  private

    # Determine whether the system is registered
    #
    # @return [Boolean]
    def registered?
      require "registration/registration"
      Registration::Registration.is_registered?
    rescue LoadError
      false
    end

    # Tries to identify a base product according to the condition in block
    #
    # @return [Y2Packager::Product] a product if exactly one product matches
    # the criteria, nil otherwise
    def identify_product
      log.info "Found base products : #{available_base_products.inspect}"

      products = available_base_products.select do |product|
        yield(product.name)
      end

      return products.first if products.size == 1

      nil
    end

    # Try to find base product according to patterns in profile
    #
    # searching for patterns like "sles-base-32bit"
    #
    # @param [Hash] profile - a hash representation of AY profile
    # @return [Y2Packager::Product] a product if exactly one product matches
    # the criteria, nil otherwise
    def identify_product_by_patterns(profile)
      software = profile.fetch_as_hash("software")

      identify_product do |name|
        software.fetch_as_array("patterns").any? { |p| p =~ /#{name.downcase}-.*/ }
      end
    end

    # Try to find base product according to packages selection in profile
    #
    # searching for packages like "sles-release"
    #
    # @param [Hash] profile - a hash representation of AY profile
    # @return [Y2Packager::Product] a product if exactly one product matches
    # the criteria, nil otherwise
    def identify_product_by_packages(profile)
      software = profile.fetch_as_hash("software")

      identify_product do |name|
        software.fetch_as_array("packages").any? { |p| p =~ /#{name.downcase}-release/ }
      end
    end

    # Try to identify base product using user's selection in profile
    #
    # @param [Hash] profile - a hash representation of AY profile
    # @return [Y2Packager::Product] a product if exactly one product matches
    # the criteria, nil otherwise
    def identify_product_by_selection(profile)
      identify_product do |name|
        name == base_product_name(profile)
      end
    end

    # Reads base product name from the profile
    #
    # FIXME: Currently it returns first found product name. It should be no
    # problem since this section was unused in AY installation so far.
    # However, it might be needed to add a special handling for multiple
    # products in the future. At least we can filter out products which are
    # not base products.
    #
    # @param profile [Hash] AutoYaST profile
    # @return [String] product name
    def base_product_name(profile)
      software = profile.fetch_as_hash("software", nil)

      if software.nil?
        log.info("Error: given profile has not a valid software section")

        return nil
      end

      product = software.fetch_as_array("products").first
      new_product = PRODUCT_MAPPING[product]

      if new_product
        log.info "Replacing requested product #{product.inspect} with #{new_product.inspect}"
        return new_product
      end

      product
    end
  end

  AutoinstFunctions = AutoinstFunctionsClass.new
  AutoinstFunctions.main
end
