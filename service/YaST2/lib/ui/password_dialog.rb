# Copyright (c) [2020] SUSE LLC
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
require "shellwords"

require "ui/dialog"
require "yast2/popup"

Yast.import "UI"
Yast.import "Label"

module UI
  # Dialog that asks for password. It returns String password or nil if aborted.
  #
  class PasswordDialog < UI::Dialog
    extend Yast::I18n
    extend Yast::UIShortcuts

    # @param label [String] intention of password e.g. "Encrypted autoyast profile."
    # @param confirm [Boolean] if double password entry is required.
    #   Usually when new password is specified.
    def initialize(label, confirm: false)
      textdomain "autoinst"
      @confirm = confirm
      @label = label

      super()
    end

    def dialog_content
      res = VBox(
        Left(Heading(@label)),
        Password(Id(:password), Yast::Label.Password, "")
      )
      res << Password(Id(:password2), Yast::Label.ConfirmPassword, "") if @confirm

      res << HBox(
        PushButton(Id(:ok), Yast::Label.OKButton),
        PushButton(Id(:abort), Yast::Label.AbortButton)
      )

      res
    end

    def abort_handler
      finish_dialog(nil)
    end

    def ok_handler
      password = Yast::UI.QueryWidget(:password, :Value)
      if @confirm
        password2 = Yast::UI.QueryWidget(:password2, :Value)
        if password != password2
          Yast2::Popup.show(_("Passwords does not match."), headline: :error)
          return
        end
      end
      finish_dialog(password)
    end
  end
end
