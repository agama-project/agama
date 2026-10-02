# frozen_string_literal: true

# Vendored from yast2-bootloader's src/lib/bootloader/language.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require "cfa/base_model"
require "cfa/augeas_parser"

module Bootloader
  # read only model to get system language from sysconfig
  # Uses CFA base model with augeas parser
  # @note If it is useful also in other places, then please consider to move
  # this class Yast2 and rename to something like Sysconfig::Language
  class Language < CFA::BaseModel
    PARSER = CFA::AugeasParser.new("sysconfig.lns")
    PATH = "/etc/sysconfig/language"

    def initialize(file_handler: nil)
      super(PARSER, PATH, file_handler: file_handler)
    end

    def rc_lang
      generic_get("RC_LANG")
    end
  end
end
