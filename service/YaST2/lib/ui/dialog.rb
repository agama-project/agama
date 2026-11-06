require "yast"
require "ui/event_dispatcher"

module UI
  # Base class for dialogs in Yast. Includes useful modules and provides
  # glue between them
  # @example simple OK/cancel dialog
  #   class OKDialog < UI::Dialog
  #     def initialize
  #       super
  #       textdomain "example"
  #     end
  #
  #     def dialog_content
  #       HBox(
  #         PushButton(Id(:ok), _("OK")),
  #         PushButton(Id(:cancel), _("Cancel"))
  #       )
  #     end
  #
  #     def ok_handler
  #       finish_dialog(:ok)
  #       log.info "OK button pressed"
  #     end
  #   end
  #
  #   # run dialog
  #   OKDialog.run
  #
  class Dialog
    # we want event dispatching in dialog
    include EventDispatcher
    # It is always good to have easy way to create UI content
    include Yast::UIShortcuts
    # Standard logger
    include Yast::Logger
    # All dialogs should be localized
    include Yast::I18n

    # Runs dialog and return value of last handler from {UI::EventDispatcher}
    def self.run
      new.run
    end

    def initialize
      Yast.import "UI"
    end

    def run
      raise "Failed to create dialog. See logs" unless create_dialog

      begin
        event_loop
      ensure
        close_dialog
      end
    end

  protected

    def create_dialog
      dialog_opts = dialog_options
      if dialog_opts
        Yast::UI.OpenDialog(dialog_opts, dialog_content)
      else
        Yast::UI.OpenDialog(dialog_content)
      end
    end

    def close_dialog
      Yast::UI.CloseDialog
    end

    # Optional abstract method to specify options for dialog.
    # @see http://doc.opensuse.org/projects/YaST/openSUSE11.3/tdg/OpenDialog_with_options.html
    # @return [Yast::Term,nil] options. By default returns nil for no special options
    def dialog_options; end

    # Abstract method to specify content of dialog.
    # @see http://doc.opensuse.org/projects/YaST/openSUSE11.3/tdg/OpenDialog_with_options.html
    # @return [Yast::Term] ui content for dialog
    # @raise [NoMethodError] if not implemented
    def dialog_content
      raise NoMethodError, "Missing implementation for abstract method dialog content for #{self}"
    end
  end
end
