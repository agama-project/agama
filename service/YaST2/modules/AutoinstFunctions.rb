# Vendored from yast-autoyast2's autoinstallation/src/modules/AutoinstFunctions.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.
#
# DEVIATION FROM UPSTREAM: dropped #selected_product, #available_base_products, #reset_product,
# the PRODUCT_MAPPING constant and the private #identify_product/#identify_product_by_*/
# #base_product_name helpers they alone needed, along with the require "y2packager/product"/
# "y2packager/product_reader"/"y2packager/product_spec"/"y2packager/medium_type" lines. This is
# AutoYaST's own base-product auto-detection (reading patterns/packages/explicit product name
# from the profile, matched against products available on the install media via
# Y2Packager::ProductSpec/ProductReader) - nothing in Agama's closure calls any of it (grep
# confirms zero references anywhere, including in this file's own #main/#second_stage_required?/
# #check_second_stage_environment). Agama has its own, independent AutoYaST product detection
# (service/lib/agama/autoyast/product_reader.rb), which reads the raw profile hash directly
# instead. y2packager/product_spec.rb and medium_type.rb are genuinely yast2-packager-only
# (confirmed via `rpm -qf` - unlike most of the rest of the y2packager/ namespace, which has
# moved into the base yast2 package over time), and yast2-packager can't be a runtime dependency
# of Agama at all: it has a circular RPM `Requires:` on yast2-storage-ng, which this whole
# vendoring effort exists to drop - see service/YaST2/README.md.

module Yast
  # Helper methods to be used on autoinstallation.
  class AutoinstFunctionsClass < Module
    include Yast::Logger

    def main
      textdomain "installation"

      Yast.import "Stage"
      Yast.import "Mode"
      Yast.import "AutoinstConfig"
      Yast.import "InstURL"
      Yast.import "ProductControl"
      Yast.import "Profile"
      Yast.import "Pkg"
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
  end

  AutoinstFunctions = AutoinstFunctionsClass.new
  AutoinstFunctions.main
end
