# frozen_string_literal: true

# Vendored from yast2-bootloader's src/lib/bootloader/none_bootloader.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require "yast"

require "bootloader/bootloader_base"

Yast.import "HTML"

module Bootloader
  # Represents when bootloader want user manage itself
  class NoneBootloader < BootloaderBase
    include Yast::I18n
    def summary(simple_mode: false)
      textdomain "bootloader"

      if simple_mode
        [_("Do not install any boot loader")]
      else
        [Yast::HTML.Colorize(
          _("Do not install any boot loader"),
          "red"
        )]
      end
    end

    def name
      "none"
    end

    def packages
      # explicitly empty as it is often used with network bootstrapping
      # so no bootloader related packages is needed, including dracut
      []
    end
  end
end
