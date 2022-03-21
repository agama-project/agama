# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "yast"
require "dinstaller/errors"

Yast.import "Language"

module DInstaller
  # Backend for handling language settings
  class Language
    # @return [Hash<Array<String,Array<String>>>] Known languages, where the key
    #   is the language code and value is an array containing the translated name,
    #   the english name, etc.
    attr_reader :languages

    def initialize(logger)
      @logger = logger
      @languages = []
    end

    def probe(_progress)
      logger.info "Probing languages"
      @languages = Yast::Language.GetLanguagesMap(true)
    end

    def install(_progress)
      Yast::Language.Save
    end

    def language=(name)
      raise Errors::InvalidValue unless languages.include?(name)

      Yast::Language.Set(name)
      Yast::Language.languages = Yast::Language.RemoveSuffix(name)
      Yast::Language.PackagesInit([name])
    end

    def language
      Yast::Language.language
    end

  private

    attr_reader :logger
  end
end
