# frozen_string_literal: true

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
