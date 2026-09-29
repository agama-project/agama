# Vendored from yast-installation's installation/src/lib/installation/cio_ignore.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-installation` RPM
# is no longer a runtime dependency of Agama.
#
# The UI-only `Installation::CIOIgnoreProposal` class has been removed since Agama
# does not use the interactive AutoYaST/YaST proposal UI.

require "yast"

module Installation
  class CIOIgnore
    # FIXME
    # The class name is a bit outdated now that it handles both cio_ignore
    # and rd.zdev kernel parameters.
    include Singleton
    include Yast::Logger
    Yast.import "Mode"
    Yast.import "AutoinstConfig"

    attr_accessor :cio_enabled
    attr_accessor :autoconf_enabled

    def initialize
      reset
    end

    def reset
      @autoconf_enabled = autoconf_setting
      @cio_enabled = cio_setting
    end

  private

    # Get current I/O device autoconf setting (rd.zdev kernel option)
    #
    # @return [Boolean]
    def autoconf_setting
      Yast.import "Bootloader"

      rd_zdev = Yast::Bootloader.kernel_param(:common, "rd.zdev")
      log.info "current rd.zdev setting: rd.zdev=#{rd_zdev.inspect}"

      rd_zdev != "no-auto"
    end

    # Get current device blacklist setting (cio_ignore kernel option).
    #
    # @return [Boolean]
    def cio_setting
      if Yast::Mode.autoinst
        Yast::AutoinstConfig.cio_ignore
      else
        Yast.import "Arch"
        # In case of given as a kernel parameter we should respect it,
        # if not it will depend on the installation environment (bsc#1210525)
        # cio_ignore does not make sense for KVM or z/VM (fate#317861)
        # but for other cases return true as requested FATE#315586
        cio_ignore_given? || !(Yast::Arch.is_zkvm || Yast::Arch.is_zvm)
      end
    end

    # Whether the cio_ignore kernel parameter was given or not
    #
    # @return [Boolean]
    def cio_ignore_given?
      Yast::Bootloader.kernel_param(:common, "cio_ignore") != :missing
    end
  end

  class CIOIgnoreFinish
    include Yast::Logger
    include Yast::I18n

    USABLE_WORKFLOWS = [
      :installation,
      :live_installation,
      :autoinst
    ].freeze

    YAST_BASH_PATH = Yast::Path.new ".target.bash_output"
    YAST_LOCAL_BASH_PATH = Yast::Path.new ".local.bash_output"

    def initialize
      textdomain "installation"
    end

    def run(*args)
      func = args.first
      param = args[1] || {}

      log.debug "cio ignore finish client called with #{func} and #{param}"

      case func
      when "Info"
        Yast.import "Arch"
        usable = Yast::Arch.s390

        {
          "steps" => 1,
          # progress step title
          "title" => _(
            "Blacklisting Devices..."
          ),
          "when"  => usable ? USABLE_WORKFLOWS : []
        }

      when "Write"
        write_cio_setting
        write_autoconf_setting

        nil
      else
        raise "Unknown action #{func} passed as first parameter"
      end
    end

  private

    # Update kernel options according to blacklist device setting
    #
    def write_cio_setting
      return unless CIOIgnore.instance.cio_enabled

      res = Yast::WFM.Execute(YAST_LOCAL_BASH_PATH, "/sbin/cio_ignore --unused --purge")

      log.info "result of cio_ignore --unused --purge call: #{res.inspect}"

      raise "cio_ignore command failed with stderr: #{res["stderr"]}" if res["exit"] != 0

      # add kernel parameters that ensure that ipl and console device is never
      # blacklisted (fate#315318)
      add_cio_boot_kernel_parameters

      # store activelly used devices to not be blocked
      store_active_devices
    end

    # Update kernel options according to I/O device autoconf setting
    #
    def write_autoconf_setting
      Yast.import "Bootloader"

      if CIOIgnore.instance.autoconf_enabled
        log.info "removing rd.zdev kernel parameter"
        Yast::Bootloader.modify_kernel_params("rd.zdev" => :missing)
      else
        log.info "adding rd.zdev=no-auto kernel parameter"
        Yast::Bootloader.modify_kernel_params("rd.zdev" => "no-auto")
      end
    end

    def add_cio_boot_kernel_parameters
      Yast.import "Bootloader"

      param = Yast::Bootloader.kernel_param(:common, "cio_ignore")

      return unless param == :missing

      res = Yast::WFM.Execute(YAST_LOCAL_BASH_PATH, "/sbin/cio_ignore -k")

      raise "cio_ignore -k failed with #{res["stderr"]}" if res["exit"] != 0

      # boot code is already proposed and will be written in next step, so just modify
      Yast::Bootloader.modify_kernel_params("cio_ignore" => res["stdout"].lines.first.strip)
    end

    ACTIVE_DEVICES_FILE = "/boot/zipl/active_devices.txt".freeze
    def store_active_devices
      Yast.import "Installation"
      res = Yast::WFM.Execute(YAST_LOCAL_BASH_PATH, "/sbin/cio_ignore -L")

      raise "cio_ignore -L failed with #{res["stderr"]}" if res["exit"] != 0

      # lets select only lines that looks like device. Regexp is not perfect, but good enough
      devices_lines = res["stdout"].lines.grep(/^(?:\h.){0,2}\h{4}.*$/)

      devices = devices_lines.map(&:chomp)
      # make sure the file ends with a new line character
      devices << "" unless devices.empty?

      devices_txt = devices.join("\n")
      log.info "active devices to be written: #{devices_txt}"

      target_file = File.join(Yast::Installation.destdir, ACTIVE_DEVICES_FILE)
      File.write(target_file, devices_txt)
    end
  end
end
