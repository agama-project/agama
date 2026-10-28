# Copyright (c) [2017-2021] SUSE LLC
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
require "ui/dialog"
require "y2storage/secret_attributes"

Yast.import "UI"

module Y2Storage
  module Dialogs
    module Callbacks
      # Dialog to manage luks activation callbacks
      class ActivateLuks < UI::Dialog
        include SecretAttributes

        secret_attr :encryption_password

        # Whether the user selects to not decrypt any more devices
        #
        # @return [Boolean]
        attr_reader :always_skip
        alias_method :always_skip?, :always_skip

        # Constructor
        #
        # @param info [Callbacks::Activate::InfoPresenter]
        # @param attempt [Numeric]
        # @param always_skip [Boolean] default value for skip decrypt checkbox
        def initialize(info, attempt, always_skip: false)
          super()

          textdomain "storage"
          @info = info
          @attempt = attempt
          @always_skip = always_skip
        end

        def password_handler
          activate_button
        end

        def accept_handler
          self.encryption_password = password
          finish_dialog(:accept)
        end

        def cancel_handler
          finish_dialog(:cancel)
        end

        def dialog_content
          VBox(
            VSpacing(0.4),
            HBox(
              HSpacing(1),
              VBox(
                Left(Heading(_("Encrypted Device"))),
                VSpacing(0.2),
                Left(Label(_("The following device is encrypted:"))),
                Left(Label(info.to_text)),
                Left(password_widget),
                VSpacing(0.2),
                HBox(
                  HSpacing(0.8),
                  Left(skip_decrypt_widget)
                ),
                buttons_widget
              )
            )
          )
        end

        protected

        attr_reader :info, :attempt

        def create_dialog
          super
          activate_button
          true
        end

        def finish_dialog(value)
          @always_skip = skip_decrypt?

          super
        end

        def password_widget
          Password(Id(:password), Opt(:notify), _("Encryption Password"))
        end

        def skip_decrypt_widget
          CheckBox(Id(:skip_decrypt), _("Skip decryption for other devices"), always_skip?)
        end

        def buttons_widget
          ButtonBox(
            PushButton(Id(:accept), _("Decrypt")),
            PushButton(Id(:cancel), _("Skip"))
          )
        end

        # Entered password
        #
        # @return [String]
        def password
          Yast::UI.QueryWidget(Id(:password), :Value).to_s
        end

        # Whether the checkbox for skipping decrypt was checked
        #
        # @return [Boolean]
        def skip_decrypt?
          Yast::UI.QueryWidget(Id(:skip_decrypt), :Value)
        end

        def activate_button
          Yast::UI.ChangeWidget(Id(:accept), :Enabled, password.size > 0)
        end
      end
    end
  end
end
