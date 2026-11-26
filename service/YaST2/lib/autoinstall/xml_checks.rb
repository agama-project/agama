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

require "singleton"

require "yast"
require "autoinstall/xml_validator"

Yast.import "AutoinstConfig"

module Y2Autoinstallation
  # Validates an AutoYaST XML document. Invalid documents are not rejected, the validation
  # problems are only logged and the processing continues.
  #
  # NOTE: the upstream implementation displayed a popup allowing the user to continue
  # or abort. That code was removed because we cannot display a popup in Agama.
  class XmlChecks
    include Singleton
    include Yast::Logger

    # paths to the default AutoYaST schema files
    PROFILE_SCHEMA = "/usr/share/YaST2/schema/autoyast/rng/profile.rng".freeze
    RULES_SCHEMA = "/usr/share/YaST2/schema/autoyast/rng/rules.rng".freeze
    CLASSES_SCHEMA = "/usr/share/YaST2/schema/autoyast/rng/classes-use.rng".freeze

    # Is the file a valid AutoYaST XML profile?
    # @param file [String] pahth to the classes file
    # @return [Boolean] true (invalid documents are only logged)
    def valid_profile?(file = Yast::AutoinstConfig.xml_tmpfile)
      check(file, PROFILE_SCHEMA)
    end

    # Is the file a valid AutoYaST XML profile?
    # @return [Boolean] true (invalid documents are only logged)
    def valid_modified_profile?
      check(Yast::AutoinstConfig.modified_profile, PROFILE_SCHEMA)
    end

    # Is the file a valid AutoYaST rules file?
    # @return [Boolean] true (invalid documents are only logged)
    def valid_rules?
      check(Yast::AutoinstConfig.local_rules_file, RULES_SCHEMA)
    end

    # Is the file a valid AutoYaST class file?
    # @param file [String] path to the classes file
    # @return [Boolean] true (invalid documents are only logged)
    def valid_classes?(file)
      check(file, RULES_SCHEMA)
    end

    # Generic validation check. Validation problems are only logged, the result is always true.
    # @param file [String] path to the XML file
    # @param schema [String] path to the RNG schema
    # @return [Boolean] always true
    def check(file, schema)
      validator = XmlValidator.new(file, schema)

      if validator.valid?
        log.info "XML file #{file} is valid."
      else
        log.warn "XML file #{file} is NOT valid"
        log.warn "Note: The following errors reported by libxml2 are very often misleading,"
        log.warn "it is recommended to use the 'jing' tool which reports much more accurate errors."
        log.warn "Validation errors: #{validator.errors.join("\n")}"
      end

      true
    end
  end
end
