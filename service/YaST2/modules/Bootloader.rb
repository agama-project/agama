# frozen_string_literal: true

# File:
#      modules/Bootloader.rb
#
# Module:
#      Bootloader installation and configuration
#
# Summary:
#      Bootloader installation and configuration base module
#
# Authors:
#      Jiri Srain <jsrain@suse.cz>
#      Olaf Dabrunz <od@suse.de>
#
# $Id$
#
# DEVIATION FROM UPSTREAM: the #Export/#Import public methods and the private
# #import_bootloader helper have been removed, along with the `bootloader/autoyast_converter`
# and `bootloader/autoinst_profile/bootloader_section` requires they alone needed. Those two
# requires pull in ~700 lines across 5 files (autoyast_converter.rb and the autoinst_profile/
# *.rb section classes) that exist solely to support the interactive AutoYaST bootloader-import
# workflow. Agama never calls Export/Import: its own AutoYaST bootloader-section handling
# (service/lib/agama/autoyast/bootloader_reader.rb) reads the raw profile hash directly and
# never touches this module at all. See service/YaST2/README.md.

require "yast"
require "yast2/popup"
require "bootloader/exceptions"
require "bootloader/sysconfig"
require "bootloader/bootloader_factory"
require "bootloader/systemdboot"

Yast.import "Arch"
Yast.import "BootStorage"
Yast.import "Initrd"
Yast.import "Installation"
Yast.import "Mode"
Yast.import "Package"
Yast.import "Report"
Yast.import "Stage"
Yast.import "UI"

module Yast
  class BootloaderClass < Module
    include Yast::Logger

    BOOLEAN_MAPPING = { true => :present, false => :missing }.freeze

    def main
      textdomain "bootloader"

      # installation proposal help variables

      # Configuration was changed during inst. proposal if true
      @proposed_cfg_changed = false

      # old vga value handling function

      # old value of vga parameter of default bootloader section
      @old_vga = nil

      # general functions

      @test_abort = nil
    end

    # Check whether abort was pressed
    # @return [Boolean] true if abort was pressed
    def testAbort
      return false if Mode.commandline

      UI.PollInput == :abort
    end

    # NOTE: upstream's #Export/#Import (AutoYaST profile export/import) and the private
    # #import_bootloader helper were removed here - see the DEVIATION FROM UPSTREAM note at the
    # top of this file.

    # Read settings from disk
    # @return [Boolean] true on success
    def Read
      log.info "Reading configuration"

      return false if testAbort
      return false if testAbort

      begin
        ::Bootloader::BootloaderFactory.current.read
      rescue ::Bootloader::UnsupportedBootloader => e
        ret = Yast::Report.AnyQuestion(_("Unsupported Bootloader"),
          _("Unsupported bootloader '%s' detected. Use proposal of supported configuration instead?") %
            e.bootloader_name,
          _("Use"),
          _("Quit"),
          :yes) # focus proposing new one
        return false unless ret

        ::Bootloader::BootloaderFactory.current = ::Bootloader::BootloaderFactory.proposed
        ::Bootloader::BootloaderFactory.current.propose
      rescue ::Bootloader::BrokenConfiguration, ::Bootloader::UnsupportedOption => e
        msg = if e.is_a?(::Bootloader::BrokenConfiguration)
          # TRANSLATORS: %s stands for readon why yast cannot process it
          _("YaST cannot process current bootloader configuration (%s). " \
            "Propose new configuration from scratch?") % e.reason
        else
          e.message
        end

        ret = Yast::Report.AnyQuestion(_("Unsupported Configuration"),
          # TRANSLATORS: %s stands for readon why yast cannot process it
          msg,
          _("Propose"),
          _("Quit"),
          :yes) # focus proposing new one
        return false unless ret

        ::Bootloader::BootloaderFactory.current = ::Bootloader::BootloaderFactory.proposed
        ::Bootloader::BootloaderFactory.current.propose
      rescue Errno::EACCES
        # If the access to any needed file (e.g., grub.cfg when using GRUB bootloader) is not
        # allowed, just abort the execution. Using Yast::Confirm.MustBeRoot early in the
        # wizard/client is not enough since it allows continue.

        Yast2::Popup.show(
          # TRANSLATORS: pop-up message, beware the line breaks
          _("The module is running without enough privileges to perform all possible actions.\n\n" \
            "Cannot continue. Please, try again as root."),
          headline: :error
        )

        return false
      end

      true
    end

    # Reset bootloader settings
    def Reset
      return if Mode.autoinst

      log.info "Resetting configuration"

      ::Bootloader::BootloaderFactory.clear_cache
      if Stage.initial
        config = ::Bootloader::BootloaderFactory.proposed
        config.propose
      else
        config = ::Bootloader::BootloaderFactory.system
        config.read
      end
      ::Bootloader::BootloaderFactory.current = config
      nil
    end

    # Propose bootloader settings
    def Propose
      log.info "Proposing configuration"
      ::Bootloader::BootloaderFactory.current.propose

      log.info "Proposed settings: #{Export()}"

      nil
    end

    # Display bootloader summary
    # @return a list of summary lines
    def Summary(simple_mode: false)
      # kokso: additional warning that root partition is nfs type -> bootloader will not be installed
      if BootStorage.boot_filesystem.is?(:nfs)
        log.info "Bootloader::Summary() -> Boot partition is nfs type, bootloader will not be installed."
        return [_("The boot partition is of type NFS. Bootloader cannot be installed.")]
      end

      ::Bootloader::BootloaderFactory.current.summary(simple_mode: simple_mode)
    end

    # Update the whole configuration
    # @return [Boolean] true on success
    def Update
      Write() # write also reads the configuration and updates it
    end

    # Write bootloader settings to disk
    # @return [Boolean] true on success
    def Write
      ReadOrProposeIfNeeded()

      mark_as_changed

      log.info "Writing bootloader configuration"

      # Prepare system
      if !::Bootloader::BootloaderFactory.current.prepare
        log.error("System could not be prepared successfully, required packages were not installed")
        Yast2::Popup.show(_("Cannot continue without install required packages"))
        return false
      end

      transactional = Package.IsTransactionalSystem

      # Create initrd
      write_initrd || log.error("Error occurred while creating initrd") if !transactional

      # Save boot loader configuration
      ::Bootloader::BootloaderFactory.current.write(etc_only: transactional)
      if transactional
        # all writing to target is done in specific transactional command
        Yast::Execute.on_target!("transactional-update", "--continue", "bootloader")
      end

      true
    end

    # return default section label
    # @return [String] default section label
    def getDefaultSection
      ReadOrProposeIfNeeded()

      bootloader = Bootloader::BootloaderFactory.current
      return "" unless bootloader.respond_to?(:sections)

      bootloader.sections.default
    end

    FLAVOR_KERNEL_LINE_MAP = {
      :common    => "append",
      :xen_guest => "xen_append",
      :xen_host  => "xen_kernel_append"
    }.freeze

    # Gets value for given parameter in kernel parameters for given flavor.
    # @param [Symbol] flavor flavor of kernel, for possible values see #modify_kernel_param
    # @param [String] key of parameter on kernel command line
    # @return [String,:missing,:present] Returns string for parameters with value,
    #   `:missing` if key is not there and `:present` for parameters without value.
    #
    # @example get crashkernel parameter to common kernel
    #   Bootloader.kernel_param(:common, "crashkernel")
    #   => "256M@64B"
    #
    # @example get cio_ignore parameter for xen_host kernel when missing
    #   Bootloader.kernel_param(:xen_host, "cio_ignore")
    #   => :missing
    #
    # @example get verbose parameter for xen_guest which is there
    #   Bootloader.kernel_param(:xen_guest, "verbose")
    #   => :present
    #

    def kernel_param(flavor, key)
      if flavor == :recovery
        log.warn "Using deprecated recovery flavor"
        return :missing
      end

      current_bl = ::Bootloader::BootloaderFactory.current
      if current_bl.is_a?(::Bootloader::SystemdBoot)
        # systemd-boot
        kernel_params = current_bl.kernel_params
      elsif current_bl.respond_to?(:grub_default)
        # all grub bootloader types
        grub_default = current_bl.grub_default
        kernel_params = case flavor
        when :common then grub_default.kernel_params
        when :xen_guest then grub_default.xen_kernel_params
        when :xen_host then grub_default.xen_hypervisor_params
        else raise ArgumentError, "Unknown flavor #{flavor}"
        end
      else
        return :missing
      end

      ReadOrProposeIfNeeded() # ensure we have some data

      res = kernel_params.parameter(key)

      BOOLEAN_MAPPING[res] || res
    end

    # Modify kernel parameters for installed kernels according to values
    # @param [Array]  args parameters to modify. Last parameter is hash with keys
    #   and its values, keys are strings and values are `:present`, `:missing` or
    #   string value. Other parameters specify which kernel flavors are affected.
    #   Known values are:
    #     - `:common` for non-specific flavor
    #     - `:recovery` DEPRECATED: no longer use
    #     - `:xen_guest` for xen guest kernels
    #     - `:xen_host` for xen host kernels
    # @return [Boolean] true if params were modified; false otherwise.
    #
    # @example add crashkernel parameter to common kernel and xen guest
    #   Bootloader.modify_kernel_params(:common, :xen_guest, "crashkernel" => "256M@64M")
    #
    # @example same as before just with array passing
    #   targets = [:common, :xen_guest]
    #   Bootloader.modify_kernel_params(targets, "crashkernel" => "256M@64M")
    #
    # @example remove cio_ignore parameter for common kernel only
    #   Bootloader.modify_kernel_params("cio_ignore" => :missing)
    #
    # @example add cio_ignore parameter for xen host kernel
    #   Bootloader.modify_kernel_params(:xen_host, "cio_ignore" => :present)
    #
    def modify_kernel_params(*args)
      ReadOrProposeIfNeeded() # ensure we have data to modify
      current_bl = ::Bootloader::BootloaderFactory.current
      # currently only grub2 bootloader and systemd-boot supported
      if !current_bl.respond_to?(:grub_default) && !current_bl.is_a?(::Bootloader::SystemdBoot)
        return :missing
      end

      values = args.pop
      raise ArgumentError, "Missing parameters to modify #{args.inspect}" if !values.is_a? Hash

      args = [:common] if args.empty? # by default change common kernels only
      args = args.first if args.first.is_a? Array # support array like syntax

      if args.include?(:recovery)
        args.delete(:recovery)
        log.warn "recovery flavor is deprecated and not set"
      end

      remap_values = BOOLEAN_MAPPING.invert
      values.each_key do |key|
        values[key] = remap_values[values[key]] if remap_values.key?(values[key])
      end

      if current_bl.is_a?(::Bootloader::SystemdBoot)
        params = [current_bl.kernel_params]
      else
        grub_default = current_bl.grub_default
        params = args.map do |flavor|
          case flavor
          when :common then grub_default.kernel_params
          when :xen_guest then grub_default.xen_kernel_params
          when :xen_host then grub_default.xen_hypervisor_params
          else raise ArgumentError, "Unknown flavor #{flavor}"
          end
        end
      end

      changed = false
      values.each do |key, value|
        params.each do |param|
          old_val = param.parameter(key)
          next if old_val == value

          changed = true
          # at first clean old entries
          matcher = CFA::Matcher.new(key: key)
          param.remove_parameter(matcher)

          case value
          when false then next # already done
          when Array
            value.each { |val| param.add_parameter(key, val) }
          else
            param.add_parameter(key, value)
          end
        end
      end

      changed
    end

    # Get currently used bootloader, detect if not set yet
    # @return [String] botloader type
    def getLoaderType
      ::Bootloader::BootloaderFactory.current.name
    end

    # Check whether settings were read or proposed, if not, decide
    # what to do and read or propose settings
    def ReadOrProposeIfNeeded
      current_bl = ::Bootloader::BootloaderFactory.current
      return if current_bl.read? || current_bl.proposed?

      if Mode.config || (Stage.initial && !Mode.update)
        Propose()
      else
        if Stage.initial && Mode.update
          # SCR has been currently set to inst-sys. So we have
          # set the SCR to installed system in order to read
          # grub settings
          old_SCR = WFM.SCRGetDefault
          new_SCR = WFM.SCROpen("chroot=#{Yast::Installation.destdir}:scr",
            false)
          WFM.SCRSetDefault(new_SCR)
        end
        Read()
        if Stage.initial && Mode.update
          # settings have been read from the target system
          current_bl.read
          # reset target system to inst-sys
          WFM.SCRSetDefault(old_SCR)
          WFM.SCRClose(new_SCR)
        end
      end
    end

  private

    def mark_as_changed
      # always run mkinitrd at the end of S/390 installation (bsc#933177)
      # otherwise cio_ignore settings are not honored in initrd
      Initrd.changed = true if Arch.s390 && Stage.initial
    end

    NONSPLASH_VGA_VALUES = ["", "false", "ask"].freeze

    # regenerates initrd if needed
    # @return boolean true if succeed
    def write_initrd
      return true unless Initrd.changed

      # save initrd
      Initrd.Write
    end

    publish :function => :Propose, :type => "void ()"
    publish :function => :Read, :type => "boolean ()"
    publish :function => :Reset, :type => "void ()"
    publish :function => :Write, :type => "boolean ()"
    publish :function => :getDefaultSection, :type => "string ()"
    publish :function => :getLoaderType, :type => "string ()"
    publish :variable => :proposed_cfg_changed, :type => "boolean"
    publish :function => :blRead, :type => "boolean (boolean, boolean)"
    publish :function => :blSave, :type => "boolean (boolean, boolean, boolean)"
    publish :function => :blWidgetMaps, :type => "map <string, map <string, any>> ()"
    publish :function => :blDialogs, :type => "map <string, symbol ()> ()"
    publish :variable => :test_abort, :type => "boolean ()"
    publish :function => :Summary, :type => "list <string> ()"
    publish :function => :Update, :type => "boolean ()"
    publish :function => :WriteInstallation, :type => "boolean ()"
  end

  Bootloader = BootloaderClass.new
  Bootloader.main
end
