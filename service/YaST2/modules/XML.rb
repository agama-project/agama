# ***************************************************************************
#
# Copyright (c) 2002 - 2020 SUSE LLC
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact SUSE LCC.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.suse.com
#
# ***************************************************************************

require "yast"

require "nokogiri"
require "pathname"

module Yast
  # Exception used when trying to serialize a Ruby object that we cannot
  # represent in XML:
  # - non-String Hash key
  # - a special object, like a Regexp
  # - nil
  class XMLSerializationError < RuntimeError
    attr_reader :object

    def initialize(message, object)
      @object = object
      super(message)
    end
  end

  # Exception used when parsing a XML string:
  # - syntax error (Nokogiri::XML::SyntaxError is reraised as this)
  # - cannot be represented as Ruby data
  class XMLDeserializationError < RuntimeError
    def self.for_node(node, message)
      new("Element <#{node.name}> at line #{node.line}: #{message}")
    end
  end

  class XMLClass < Module
    include Yast::Logger

    def main
      # Sections in XML file that should be treated as CDATA when saving
      @cdataSections = []

      # How to call a list entry in the XML output
      @listEntries = {}

      # The system ID, or the DTD URI
      @systemID = nil

      # root element of the XML file
      @rootElement = ""

      # Global Namespace xmlns=...
      @nameSpace = "http://www.suse.com/1.0/yast2ns"

      # Type name space xmlns:config for YCP data (http://www.suse.com/1.0/configns)
      @typeNamespace = "http://www.suse.com/1.0/configns"

      @docs = {}
    end

    # define a new doc type with custom settings, if not defined, global settings will
    # be used.
    # @param symbol Document type identifier
    # @param map  Document type Settings
    # @return [void]
    def xmlCreateDoc(doc, doc_settings)
      doc_settings = deep_copy(doc_settings)
      current_settings = {
        "cdataSections" => Ops.get_list(
          doc_settings,
          "cdataSections",
          @cdataSections
        ),
        "systemID"      => doc_settings["systemID"],
        "rootElement"   => Ops.get_string(
          doc_settings,
          "rootElement",
          @rootElement
        ),
        "listEntries"   => Ops.get_map(doc_settings, "listEntries", @listEntries)
      }
      if Ops.get_string(doc_settings, "typeNamespace", "") != ""
        Ops.set(
          current_settings,
          "typeNamespace",
          Ops.get_string(doc_settings, "typeNamespace", "")
        )
      end

      if Ops.get_string(doc_settings, "nameSpace", "") != ""
        Ops.set(
          current_settings,
          "nameSpace",
          Ops.get_string(doc_settings, "nameSpace", "")
        )
      end
      Ops.set(@docs, doc, current_settings)
      nil
    end

    # YCPToXMLFile()
    # Write YCP data into formated XML file
    # @param [Symbol] doc_type Document type identifier
    # @param [Hash] contents  a map with YCP data
    # @param [String] output_path the path of the XML file
    # @return [Boolean] true on sucess
    # @raise [XMLSerializationError] when non supported contents is passed
    def YCPToXMLFile(doc_type, contents, output_path)
      xml = YCPToXMLString(doc_type, contents)
      return false unless xml

      SCR.Write(path(".target.string"), output_path, xml)
    end

    # Write YCP data into formated XML string
    # @param [Symbol] doc_type Document type identifier
    # @param [Hash] contents  a map with YCP data
    # @return [String, nil] String with XML data or nil if error happen
    # @raise [XMLSerializationError] when non supported content is passed
    def YCPToXMLString(doc_type, contents)
      metadata = @docs[doc_type]
      if !metadata
        log.error "Calling YCPToXML with unknown doc_type #{doc_type.inspect}. " \
                  "Known types #{@docs.keys.inspect}"
        return nil
      end

      doc = Nokogiri::XML::Document.new("1.0")
      root_name = metadata["rootElement"]
      if !root_name || root_name.empty?
        log.warn "root element missing in docs #{metadata.inspect}"
        return nil
      end

      doc.create_internal_subset(root_name, nil, metadata["systemID"])

      root = doc.create_element root_name
      root.default_namespace = metadata["nameSpace"] if metadata["nameSpace"]
      root.add_namespace("config", metadata["typeNamespace"]) if metadata["typeNamespace"]

      add_element(doc, metadata, root, contents)

      doc.root = root
      doc.to_xml
    end

    # Reads XML file
    # @param [String] xml_file XML file name to read
    # @return [Hash] parsed content
    # @raise [XMLDeserializationError] when non supported XML is passed
    def XMLToYCPFile(xml_file)
      raise ArgumentError, "XMLToYCPFile() received nil" if xml_file.nil?
      raise XMLDeserializationError, "Cannot find XML file #{xml_file}" if SCR.Read(path(".target.size"), xml_file) <= 0

      log.info "Reading #{xml_file}"
      XMLToYCPString(SCR.Read(path(".target.string"), xml_file))
    end

    # Reads XML string
    # @param [String] xml_string to read
    # @return [Hash] parsed content
    # @raise [XMLDeserializationError] when non supported xml is passed
    def XMLToYCPString(xml_string)
      raise XMLDeserializationError, "Cannot convert empty XML string" if !xml_string || xml_string.empty?

      doc = Nokogiri::XML(xml_string, &:strict)
      doc.remove_namespaces! # remove fancy namespaces to make user life easier

      result = {}
      # inspect only element nodes
      doc.root.children.select(&:element?).each { |n| parse_node(n, result) }

      result
    rescue Nokogiri::XML::SyntaxError => e
      raise XMLDeserializationError, e.message
    end

    # Validates a XML document against a given schema.
    #
    # @param xml [Pathname, String] path or content of XML (if the string contains a new
    #  line character it is considered as a XML string, otherwise as a file name)
    # @param schema [Pathname, String] path or content of relax ng schema
    # @return [Array<String>] array of strings with errors or empty array if
    #   well formed and valid
    # @raise [Yast::XMLDeserializationError] if the document is not well formed
    #   (there are syntax errors)
    def validate(xml, schema)
      xml = SCR.Read(path(".target.string"), xml.to_s) if xml.is_a?(Pathname)
      if schema.is_a?(::String)
        validator = Nokogiri::XML::RelaxNG(schema)
      else
        schema_content = SCR.Read(path(".target.string"), schema.to_s)
        schema_path = File.dirname(schema)
        # change directory so relative include works
        Dir.chdir(schema_path) { validator = Nokogiri::XML::RelaxNG(schema_content) }
      end

      doc = Nokogiri::XML(xml, &:strict)
      validator.validate(doc).map(&:message)
    rescue Nokogiri::XML::SyntaxError => e
      raise XMLDeserializationError, e.message
    end

    # The error string from the XML parser.
    # It should be used when the agent did not return content.
    # A reset happens before a new XML parsing starts.
    # @return nil
    # @deprecated Exception is used instead
    def XMLError
      nil
    end

    publish function: :xmlCreateDoc, type: "void (symbol, map)"
    publish function: :YCPToXMLFile, type: "boolean (symbol, map, string)"
    publish function: :YCPToXMLString, type: "string (symbol, map)"
    publish function: :XMLToYCPFile, type: "map <string, any> (string)"
    publish function: :XMLToYCPString, type: "map <string, any> (string)"
    publish function: :XMLError, type: "string ()"

  private

    BOOLEAN_MAP = {
      "true"  => true,
      "false" => false
    }.freeze

    def parse_node(node, result)
      name = node.name
      # use only element children
      children = node.children
      children = children.select(&:element?)
      # we need just direct text under node. Can be splitted with another elements
      # but remove whitespace only text
      #
      # Do NOT strip surrounding white space in CDATA blocks (bsc#1195910).
      # This restores the behavior prior to SLE15-SP3.
      #
      # See also #add_element.
      text_nodes = node.xpath("text()")
      text = text_nodes.map { |n| n.cdata? ? n.content : n.content.strip }.join

      type = fetch_type(text, children, node)

      result[name] = case type
      # disksize is our own design mistake. deprecated.
      when "string", "disksize" then text
      when "symbol"
        raise XMLDeserializationError.for_node(node, "empty symbols are invalid") if text.empty?

        text.to_sym
      when "integer"
        raise XMLDeserializationError.for_node(node, "cannot be parsed as an integer") if text !~ /-?\d+/

        text.to_i
      when "boolean"
        v = BOOLEAN_MAP[text]
        raise XMLDeserializationError.for_node(node, "booleans can only be 'true' or 'false'") if v.nil?

        v
      when "list"
        children.map do |kid|
          # always pass new hash to prevent overwrite for list with same elements
          r = {}
          parse_node(kid, r)
          r.values.first
        end
      when "map"
        v = {}
        children.each { |kid| parse_node(kid, v) }
        v
      else
        raise XMLDeserializationError.for_node(node, "invalid type #{type.inspect}")
      end

      result
    end

    # @param [Nokogiri::XML::Document] doc
    # @param [Hash] metadata for current doc
    # @param [Nokogiri::XML::Node] parent
    # @param [Hash] contents content to write
    # @param [Array] parent_array (for better error reporting)
    # @return [void]
    def add_element(doc, metadata, parent, contents, parent_array: nil)
      # backward compatibility. Keys are sorted and needs old ycp sort to be able to compare also classes
      Builtins.sort(contents.keys).each do |key|
        raise XMLSerializationError.new("Cannot represent non-string key '#{key.inspect}', part of #{contents.inspect}", contents) unless key.is_a?(::String)

        value = contents[key]
        type_attr = "t"
        element = Nokogiri::XML::Node.new(key, doc)
        case value
        when ::String
          # Write CDATA block if string has surrounding white space. This matches
          # the stripping in #parse_node.
          if value.match?(/\A\s|\s\z/)
            element.add_child(doc.create_cdata(value))
          else
            element.content = value
          end
        when ::Integer
          element[type_attr] = "integer"
          element.content = value.to_s
        when ::Symbol
          element[type_attr] = "symbol"
          element.content = value.to_s
        when true, false
          element[type_attr] = "boolean"
          element.content = value.to_s
        when ::Array
          element[type_attr] = "list"
          special_names = metadata["listEntries"] || {}
          element_name = special_names[key] || "listentry"
          value.each do |list_value|
            add_element(doc, metadata, element, { element_name => list_value }, parent_array: value)
          end
        when ::Hash
          element[type_attr] = "map"
          add_element(doc, metadata, element, value)
        else # including nil
          # without parent_array, a ["foo", nil, "bar"] would always
          # unhelpfully report {"listentry"=> nil} as the parent object
          o = parent_array || contents
          raise XMLSerializationError.new("Cannot represent #{value.inspect}, part of #{o.inspect}", o)
        end

        parent << element
      end
    end

    # @return [String] the 't' or 'type' attribute, or inferred
    # @raise if there is conflicting type information
    def fetch_type(text, children, node)
      raise XMLDeserializationError.for_node(node, "contains both 't' and 'type' attributes") if node["t"] && node["type"]

      node["t"] || node["type"] || detect_type(text, children, node)
    end

    def detect_type(text, children, node)
      # backward compatibility. Newly maps should have its type
      if text.empty? && !children.empty?
        "map"
      elsif (!text.empty? && children.empty?) ||
          # keep cdata trick to create empty string
          !node.children.reject(&:text?).select(&:cdata?).empty? ||
          # default type is text if nothing is specified and cannot interfere
          (text.empty? && children.empty?)
        "string"
      else
        raise XMLDeserializationError.for_node(node, "contains both text #{text.inspect} and elements #{children.inspect}.")
      end
    end
  end

  XML = XMLClass.new
  XML.main
end
