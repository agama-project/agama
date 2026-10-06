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

# Vendored from yast-autoyast2's autoinstallation/src/lib/autoinstall/xml_checks.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama. This still relies on `Yast::XML`
# (yast2-xml), which stays a kept dependency for this reason.

require "erb"

require "yast"
require "autoinstall/xml_validator"
require "yast2/popup"
require "yaml"

Yast.import "AutoinstConfig"
Yast.import "Report"

module Y2Autoinstallation
  # Validates an AutoYaST XML document and displays an error popup
  # for not well formed or invalid documents. It is possible to continue
  # anyway and ignore the found problems at your risk.
  class XmlChecks
    include Singleton
    include Yast::Logger
    include Yast::I18n

    # paths to the default AutoYaST schema files
    PROFILE_SCHEMA = "/usr/share/YaST2/schema/autoyast/rng/profile.rng".freeze
    RULES_SCHEMA = "/usr/share/YaST2/schema/autoyast/rng/rules.rng".freeze
    CLASSES_SCHEMA = "/usr/share/YaST2/schema/autoyast/rng/classes-use.rng".freeze

    ERRORS_PATH = "/var/lib/YaST2/xml_checks_errors".freeze

    # Constructor
    def initialize
      textdomain "autoinst"

      @reported_errors = errors_from_file
    end

    # Is the file a valid AutoYaST XML profile?
    # @param file [String] pahth to the classes file
    # @return [Boolean] true if valid, false otherwise
    def valid_profile?(file = Yast::AutoinstConfig.xml_tmpfile)
      # TRANSLATORS: Error message
      msg = _("The AutoYaST profile is not a valid XML document.")
      check(file, PROFILE_SCHEMA, msg)
    end

    # Is the file a valid AutoYaST XML profile?
    # @return [Boolean] true if valid, false otherwise
    def valid_modified_profile?
      # TRANSLATORS: Error message
      msg = _("The AutoYaST pre-script generated an invalid XML document.")
      check(Yast::AutoinstConfig.modified_profile, PROFILE_SCHEMA, msg)
    end

    # Is the file a valid AutoYaST rules file?
    # @return [Boolean] true if valid, false otherwise
    def valid_rules?
      # TRANSLATORS: Error message
      msg = _("The AutoYaST rules file is not a valid XML document.")
      check(Yast::AutoinstConfig.local_rules_file, RULES_SCHEMA, msg)
    end

    # Is the file a valid AutoYaST class file?
    # @param file [String] path to the classes file
    # @return [Boolean] true if valid, false otherwise
    def valid_classes?(file)
      # TRANSLATORS: Error message
      msg = _("The AutoYaST class file is not a valid XML document.")
      check(file, RULES_SCHEMA, msg)
    end

    # generic validation check
    # @param file [String] path to the XML file
    # @param schema [String] path to the RNG schema
    # @param msg [String] title displayed in the popup when validation fails
    # @return [Boolean] true if valid, false otherwise
    def check(file, schema, msg)
      validator = XmlValidator.new(file, schema)
      return true if validator.valid? || !new_errors?(validator.errors)

      if ENV["YAST_SKIP_XML_VALIDATION"] == "1"
        log.warn "Skipping invalid XML!"
        return true
      end

      ret = Yast2::Popup.show(message(msg, validator.errors, file, schema),
        richtext: true,
        headline: :warning,
        buttons:  :continue_cancel,
        timeout:  Yast::Report.Export["warnings"]["timeout"],
        focus:    :cancel) == :continue

      if ret
        log.warn "Skipping invalid XML on user request and storing validation errors!"
        store_errors(validator.errors)
      end

      ret
    end

  private

    # Convenience method to check whether the list of validation errors have
    # been already reported and accepted by the user or not.
    #
    # @param errors [Array<String>] list of validation errors
    # @return [Boolean] whether the validation errors are new or not
    def new_errors?(errors)
      return true if (reported_errors || []).empty?

      !reported_errors.include?(digest_hash(errors))
    end

    # Convenience method to save to a file the hash sum of the already
    # reported errors
    #
    # @param errors [Array<String>] list of validation errors
    def store_errors(errors)
      @reported_errors << digest_hash(errors)

      File.write(ERRORS_PATH, reported_errors.to_yaml)
    end

    # Convenience method to obtain the digest hash for the given errors
    #
    # @param errors [Array<String>] list of validation errors
    def digest_hash(errors)
      Digest::MD5.hexdigest(errors.to_yaml)
    end

    # Convenience method to load the errors reported from a file
    def errors_from_file
      return [] unless File.exist?(ERRORS_PATH)

      YAML.safe_load(File.read(ERRORS_PATH))
    end

    # @return [Array<String>] array with the reported errors hash sums
    def reported_errors
      @reported_errors ||= []
    end

    # an internal helper for building the error message
    # @param msg [String] title text
    # @param errors [Array<String>] list of validation errors
    # @param file [String] path to the XML file (only the base name is displayed)
    # @param schema [String] path to the RNG schema
    def message(msg, errors, file, schema)
      xml_file = File.basename(file)
      jing_command = "jing #{schema} #{xml_file}"
      xmllint_command = "xmllint --noout --relaxng #{schema} #{xml_file}"

      "<h3>" + msg + "</h3>" + "<p>" +
        # TRANSLATORS: Warn user about using invalid XML
        _("Using an invalid XML document might result in an unexpected behavior, " \
          "crash or even data loss!") +
        "</p><h4>" + _("Details") + "</h4><p>" +
        ERB::Util.html_escape(errors.join("<br>")) + "</p><h4>" + _("Note") + "</h4>" +
        # TRANSLATORS: A hint how to check a XML file, displayed as a part of the
        # validation error message, %{jing} and %{xmllint} are replaced by shell commands,
        # use HTML tags and entities (non-breaking space) for formatting the message
        "<p>" + format(_("You can check the file manually with these commands:<br><br>" \
                         "&nbsp;&nbsp;%{jing}<br>" \
                         "&nbsp;&nbsp;%{xmllint}"), jing: jing_command, xmllint: xmllint_command) +
        "</p>"
    end
  end
end
