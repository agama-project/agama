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

# Vendored from yast-autoyast2's autoinstallation/src/lib/autoinstall/xml_validator.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "pathname"

Yast.import "XML"

module Y2Autoinstallation
  # Validates an XML document against a given RNG schema
  class XmlValidator
    include Yast::Logger

    attr_reader :xml, :schema

    # Constructor
    # @param xml [String] path to a XML file
    # @param schema [String] path to the RNG schema
    def initialize(xml, schema)
      @xml = xml
      @schema = schema
      @errors = nil
    end

    # runs the validation
    # @return [Array<String>] Returns a list of errors, if the document is not
    #  well formed it contains syntax errors, if it is not valid it contains
    #  the validation errors, if it is valid it returns an empty list
    def errors
      return @errors if @errors

      validate
      @errors
    end

    # runs the validation
    # @return [Boolean] returns true if the document is well formed and valid,
    #  false otherwise
    def valid?
      errors.empty?
    end

  private

    def validate
      log.info "Validating #{xml} against #{schema}..."
      @errors = Yast::XML.validate(Pathname.new(xml), Pathname.new(schema))

      if errors.empty?
        log.info "The XML is valid"
      else
        log.error "XML validation errors: #{errors.inspect}"
      end
    rescue Yast::XMLDeserializationError => e
      log.error "Cannot parse XML: #{e.message}"
      @errors = [e.message]
    end
  end
end
