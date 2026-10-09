# frozen_string_literal: true

# DEVIATION FROM UPSTREAM: #set_boot_msg below has been modified. Upstream dynamically
# dispatches to a "reipl_bootloader_finish" YaST client (shipped by the separate
# `yast2-reipl` package) via Yast::WFM.call on s390. That client's only real effect is
# running `chreipl node /boot/zipl` (it always returns a hardcoded "different" => false,
# making the message-customization branch below dead code even upstream). To avoid
# vendoring the whole yast2-reipl package for one shell command, and to finally drop the
# `yast2-reipl` RPM dependency, the chreipl call is inlined directly and the dead
# finish_ret/ipl_msg branching has been removed. See service/YaST2/README.md.

require "bootloader/bootloader_factory"
require "bootloader/exceptions"
require "installation/finish_client"
require "yast2/execute"

Yast.import "Arch"
Yast.import "Misc"
Yast.import "Mode"
Yast.import "Report"

module Bootloader
  # Finish client for bootloader configuration
  class FinishClient < ::Installation::FinishClient
    include Yast::I18n

    def initialize
      textdomain "bootloader"

      super
    end

    def steps
      3
    end

    def title
      _("Saving bootloader configuration...")
    end

    def modes
      [:installation, :live_installation, :update, :autoinst]
    end

    def write
      # message after first round of packet installation
      # now the installed system is run and more packages installed
      # just warn the user that the screen is going back to text mode
      # and yast2 will come up again.
      set_boot_msg

      bl_current = ::Bootloader::BootloaderFactory.current
      # we do nothing in upgrade unless we have to change bootloader
      return true if Yast::Mode.update && !bl_current.read? && !bl_current.proposed?

      # we do not manage bootloader, so relax :)
      return true if bl_current.name == "none"

      begin
        # read one from system, so we do not overwrite changes done in rpm post install scripts
        ::Bootloader::BootloaderFactory.clear_cache
        system = ::Bootloader::BootloaderFactory.system
        system.read
        system.merge(bl_current)
        system.write
      rescue BrokenConfiguration => e
        # bug#1138930: although there should never be errors in this phase
        # (unless udev is broken), aborting the installation is not nice
        Yast::Report.LongMessage(e.message)
      end

      # and remember result of merge as current one
      ::Bootloader::BootloaderFactory.current = system

      if !BootloaderFactory.current.is_a?(SystemdBoot)
        # Not for SystemdBoot bootloader because
        # kexec and dracut regeneration will be done by sdbootutil directly.

        # call dracut to ensure initrd is properly set, it is especially needed
        # in live system install ( where it is just copyied ) and image based
        # installation where post install script is not executed
        # (bnc#979719,bnc#977656, bsc#1189374)
        # --regenerate-all is needed for generating initrd image for all kernels (bsc#1189915)
        Yast::Execute.on_target("/usr/bin/dracut", "--force", "--regenerate-all")
      end

      true
    end

  private

    def set_boot_msg
      # Tell the firmware/hypervisor to re-IPL (reboot) from the /boot/zipl bootmap on the next
      # boot - matters for s390 guests (LPAR/z/VM) so the newly-installed system actually boots.
      # See the DEVIATION FROM UPSTREAM note at the top of this file.
      Yast::Execute.on_target("chreipl", "node", "/boot/zipl") if Yast::Arch.s390

      # Final message after all packages from CD1 are installed
      # and we're ready to start (boot into) the installed system
      # Message that will be displayed along with information
      # how the boot loader was installed
      Yast::Misc.boot_msg = _("The system will reboot now...")
    end
  end
end
