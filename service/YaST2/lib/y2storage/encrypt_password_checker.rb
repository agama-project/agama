# Copyright (c) [2017-2018] SUSE LLC
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

Yast.import "InstExtensionImage"

module Y2Storage
  # Helper class to validate the password of an encryption device entered by the
  # user in any form.
  class EncryptPasswordChecker
    include Yast::Logger
    include Yast::I18n

    # Minimum allowed size of the password
    MIN_SIZE = 8

    # Set of characters accepted as part of the password
    ALLOWED_CHARS =
      "0123456789" \
      "abcdefghijklmnopqrstuvwxyz" \
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ" \
      "#* ,.;:._-+=!$%&/|?{[()]}@^\\<>"

    # RPM containing the cracklib dictionary to check password strength
    CRACKLIB_PACKAGE = "cracklib-dict-full.rpm"

    private_constant :MIN_SIZE, :ALLOWED_CHARS, :CRACKLIB_PACKAGE

    # Constructor
    def initialize
      textdomain "storage"
    end

    # Method to be called when quiting the form
    #
    # This unloads the installation extension used to check memory strength, so
    # the memory becomes available again.
    def tear_down
      unload_cracklib
    end

    # Blocking error detected in the passwords entered in the form
    #
    # @param passwd [String] content of the password field
    # @param repeat_passwd [String] content of the password confirmation field
    # @return [String, nil] already localized string or nil if the content of
    #   both fields is valid
    def error_msg(passwd, repeat_passwd)
      blank_error(passwd) || match_error(passwd, repeat_passwd) || format_error(passwd)
    end

    # Non-blocking warning about the password
    #
    # @note Currently this method can only be called during installation, since
    # it may load a cracklib installation module to check the password strength.
    #
    # @return [String, nil] localized warning message, nil if successful or cracklib
    #   cannot be loaded
    def warning_msg(passwd)
      load_cracklib
      return nil unless cracklib_loaded?

      msg = Yast::SCR.Execute(Yast::Path.new(".crack"), passwd)
      # Password is considered strong when cracklib returns an empty message.
      return nil if msg.empty?

      _("The password is too simple:") + "\n" + msg
    end

    private

    # Whether the cracklib installation module is loaded
    attr_reader :cracklib_loaded
    alias_method :cracklib_loaded?, :cracklib_loaded

    # @return [String, nil]
    def blank_error(password)
      _("A password is needed") if password.empty?
    end

    # @return [String, nil]
    def match_error(password, repeat_password)
      _("Password does not match") unless password == repeat_password
    end

    # @return [String, nil]
    def format_error(password)
      correct = min_size?(password) && allowed_chars?(password)
      return nil if correct

      messages = [
        _("The password must have at least %d characters.") % MIN_SIZE,
        _("The password may only contain the following characters:\n" \
          "0..9, a..z, A..Z, and any of \"@#* ,.;:._-+=!$%&/|?{[()]}^\\<>\".")
      ]
      messages.join("\n")
    end

    def min_size?(password)
      password.size >= MIN_SIZE
    end

    def allowed_chars?(password)
      password.chars.all? { |c| ALLOWED_CHARS.include?(c) }
    end

    # Loads the installation module containing the cracklib dictionary if it's
    # not already loaded.
    #
    # @return [Boolean] true if the module was already loaded or was
    #   successfully loaded
    def load_cracklib
      return true if cracklib_loaded?

      message = "Loading to memory package #{CRACKLIB_PACKAGE}"
      loaded = Yast::InstExtensionImage.LoadExtension(CRACKLIB_PACKAGE, message)
      log.warn("WARNING: Failed to load cracklib. Please check logs.") unless loaded
      @cracklib_loaded = loaded
    end

    # Unloads the cracklib installation module.
    #
    # @see #load_cracklib
    #
    # @return [Boolean] true if the module was correctly unloaded
    def unload_cracklib
      return false unless cracklib_loaded?

      message = "Removing from memory package #{CRACKLIB_PACKAGE}"
      unloaded = Yast::InstExtensionImage.UnLoadExtension(CRACKLIB_PACKAGE, message)
      log.warn("Warning: Failed to remove cracklib. Please check logs.") unless unloaded
      @cracklib_loaded = !unloaded
    end
  end
end
