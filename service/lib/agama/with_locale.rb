# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

Yast.import "WFM"

module Agama
  # Mixin that implements methods for handling with the localization
  module WithLocale
    include Yast::I18n
    include Yast::Logger

    def change_process_locale(locale)
      language, encoding = locale.split(".")
      Yast::WFM.SetLanguage(language, encoding)
      # explicitly set ENV to get localization also from libraries like libstorage
      ENV["LANG"] = locale
      log.info "set yast locale to #{locale}"
      # explicit call to textdomain to force fast gettext change of language ASAP
      textdomain "agama"
    end
  end
end
