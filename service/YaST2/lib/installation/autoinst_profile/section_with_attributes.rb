# Copyright (c) [2020-2021] SUSE LLC
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
require "installation/autoinst_profile/element_path"

module Installation
  module AutoinstProfile
    # Abstract base class to be used when dealing with AutoYaST profiles
    #
    # ## Motivation
    #
    # Historically, AutoYaST has used hash objects to handle the profile data.
    # The import method expects to receive a hash with the profile content while
    # the export method returns a hash. For simple cases, it is just fine.
    # However, for complex scenarios (like storage or networking settings),
    # using a hash can be somewhat limiting.
    #
    # ## Features
    #
    # This class offers a starting point for a better API when working with
    # AutoYaST profiles, abstracting some details. The idea is that by creating
    # a derived class and specifying the known profile elements (attributes)
    # you get a basic class that you can extend to offer a convenient API.
    #
    # These classes would be responsible for:
    #
    # * Converting profile related information from/to hash objects. It includes
    #   logic to support old-style profiles (renaming attributes and so on).
    #
    # * Generating a section from the running system. See
    #   [PartitioningSection#new_from_storage] or
    #   [NetworkingSection#new_from_network] to take some inspiration. Bear in
    #   mind that the former does not inherit from {SectionWithAttributes}, but
    #   relies on other classes that do so.
    #
    # * Offering convenient query methods when needed. See
    #   [PartitioningSection#disk_drives] or [PartitionSection#used?] as
    #   examples.
    #
    # * Interpreting some values like the dash (-) in [networking route
    #   sections](https://github.com/yast/yast-network/blob/1441831ff9edb3cff1dd5c76ceb27c99d9280e19/src/lib/y2network/autoinst_profile/route_section.rb#L133).
    #
    # [PartitioningSection#new_from_storage]: https://github.com/yast/yast-storage-ng/blob/e2e714a990bed5b9e21d5967e6e3454a8de37778/src/lib/y2storage/autoinst_profile/partitioning_section.rb#L81
    # [NetworkingSection#new_from_network]: https://github.com/yast/yast-network/blob/1441831ff9edb3cff1dd5c76ceb27c99d9280e19/src/lib/y2network/autoinst_profile/networking_section.rb#L88
    # [PartitioningSection#disk_drives]: https://github.com/yast/yast-storage-ng/blob/e2e714a990bed5b9e21d5967e6e3454a8de37778/src/lib/y2storage/autoinst_profile/partitioning_section.rb#L102
    # [PartitionSection#used?]: https://github.com/yast/yast-storage-ng/blob/e2e714a990bed5b9e21d5967e6e3454a8de37778/src/lib/y2storage/autoinst_profile/drive_section.rb#L594
    #
    # ## Scope
    #
    # Validation or setting default values is out of the scope of these classes,
    # as it belongs to the code which imports the profile data. However, nothing
    # is set in stone and we could change this decision in the future if needed.
    #
    # ## Limitations
    #
    # This class only handles scalar data types. If you need to deal with
    # arrays, you must extend your derived class. The reason is that, usually,
    # those arrays are composed of other sections like [partitions], [network
    # interfaces], etc. Take into account that you will need to write code
    # import and export those structures. Check the partitions and network
    # interfaces examples to find out the details.
    #
    # [partitions]: https://github.com/yast/yast-storage-ng/blob/e2e714a990bed5b9e21d5967e6e3454a8de37778/src/lib/y2storage/autoinst_profile/drive_section.rb#L139
    # [network interfaces]: https://github.com/yast/yast-network/blob/1441831ff9edb3cff1dd5c76ceb27c99d9280e19/src/lib/y2network/autoinst_profile/networking_section.rb#L112
    #
    # ## Examples
    #
    # @example Custom section definition
    #   class SignatureHandlingSection < SectionWithAttributes
    #     class << self
    #       def attributes
    #        [
    #          { name: :accept_file_without_checksum },
    #          { name: :accept_usigned_file }
    #        ]
    #       end
    #     end
    #   end
    #
    # @example Importing a section from the profile
    #   def import(settings)
    #     section = SignatureHandlingSection.new_from_hashes(settings)
    #     # Do whatever you need to do with the section content.
    #   end
    #
    # @example Exporting the values from the system
    #   def export
    #     section = SignatureHandlingSection.new_from_system(signature_handling)
    #     section.to_hashes
    #   end
    #
    # @example Adding a query API method
    #   class SignatureHandlingSection < SectionWithAttributes
    #     # Omiting attributes definition for simplicity reasons.
    #
    #     # Determines whether the signature checking is completely disabled
    #     #
    #     # @return [Boolean]
    #     def disabled?
    #       accept_file_without_checksum && accept_unsigned_file
    #     end
    #   end
    class SectionWithAttributes
      include Yast::Logger

      class << self
        # Description of the attributes in the section.
        #
        # To be defined by each subclass. Each entry contains a hash with:
        #   * :name        : (mandatory) name of the attribute.
        #   * :xml_name    : (optional) name of the attribute in the xml profile. This is useful
        #                    when the attribute is required to be called different to the its xml
        #                    name.
        #   * :allow_blank : (optional, false by default) whether blank values (i.e, "" or []) are
        #                    allowed. If set to false, then the value of the attribute will be nil
        #                    when a blank is detected.
        #
        # @return [Array<Hash>]
        def attributes
          []
        end

        # Creates an instance based on the profile representation used by the
        # AutoYaST modules (nested arrays and hashes).
        #
        # This method provides no extra validation, type conversion or
        # initialization to default values. Those responsibilities belong to the
        # AutoYaST modules. The hash is expected to be valid and
        # contain the relevant information. Attributes are set to nil for
        # missing keys and for blank values.
        #
        # @param hash [Hash,Array<Hash>] content of the corresponding section of
        #   the profile. Each element of the hash corresponds to one of the
        #   attributes defined in the section. When the section is a list, the
        #   method can receive an array containing one hash per each element.
        # @param parent [#parent,#section_name] parent section
        # @return [SectionWithAttributes]
        def new_from_hashes(hash, parent = nil)
          result = new(parent)
          result.init_from_hashes(hash) if hash.is_a?(Enumerable)
          result
        end

      protected

        # Macro used in the subclasses to define accessors for all the
        # attributes defined by {.attributes}
        def define_attr_accessors
          attributes.each do |attrib|
            attr_accessor attrib[:name]
          end
        end
      end

      # This value only makes sense when {.new_from_hashes} is used.
      #
      # @return [#parent,#section_name] Parent section
      attr_reader :parent

      # Constructor
      #
      # @param parent [SectionWithAttributes] Parent section
      def initialize(parent = nil)
        @parent = parent
      end

      # Method used by {.new_from_hashes} to populate the attributes.
      #
      # By default, it simply assigns the non-empty hash values to the
      # corresponding attributes, logging unknown keys. The subclass is expected
      # to refine this behavior if needed.
      #
      # @param hash [Hash] see {.new_from_hashes}
      def init_from_hashes(hash)
        init_scalars_from_hash(hash)
      end

      # Content of the section in the format used by the AutoYaST modules
      # (nested arrays and hashes).
      #
      # @return [Hash] each element of the hash corresponds to one of the
      #     attributes defined in the section. Blank attributes are not
      #     included.
      def to_hashes
        attributes.each_with_object({}) do |attrib, result|
          key = attrib_key(attrib)
          value = attrib_value(attrib)

          next if attrib_skip?(key, value)

          result[key] = value
        end
      end

      # Returns the section name
      #
      # In some cases, the section name does not match with the XML name
      # and this method should be redefined.
      #
      # @example
      #   section = PartitioningSection.new
      #   section.section_name #=> "partitioning"
      #
      # @return [String] Section name
      def section_name
        klass_name = self.class.name.split("::").last
        klass_name
          .gsub(/([a-z])([A-Z])/, "\\1_\\2").downcase
          .chomp("_section")
      end

      # Returns the collection name
      #
      # If the section belongs to a collection, returns its name.
      # Otherwise, it returns nil.
      #
      # @return [String,nil] Collection name
      def collection_name
        nil
      end

      # Returns the position within the collection
      #
      # @return [Integer,nil] Index or nil if it does not belong to a collection
      #   or the parent is not set.
      def index
        return nil unless collection_name && parent

        parent.send(collection_name).index(self)
      end

      # Returns the section's path
      #
      # @return [ElementPath] Section path
      def section_path
        return ElementPath.new(section_name) if parent.nil?

        if collection_name
          parent.section_path.join(collection_name, index)
        else
          parent.section_path.join(section_name)
        end
      end

    protected

      def attributes
        self.class.attributes
      end

      def attrib(key)
        attributes.find { |a| a[:xml_name] == key.to_sym || a[:name] == key.to_sym }
      end

      # Whether an attribute must be skipped during import/export.
      #
      # @return [Boolean] true is the attribute allows to skip and its value is blank
      def attrib_skip?(key, value)
        attrib = attrib(key)

        return true unless attrib
        return false if attrib[:allow_blank]

        value.nil? || value == [] || value == ""
      end

      def attrib_key(attrib)
        (attrib[:xml_name] || attrib[:name]).to_s
      end

      def attrib_value(attrib)
        value = send(attrib[:name])
        if value.is_a?(Array)
          value.map { |v| attrib_scalar(v) }
        else
          attrib_scalar(value)
        end
      end

      def attrib_scalar(element)
        element.respond_to?(:to_hashes) ? element.to_hashes : element
      end

      def attrib_name(key)
        attrib = attrib(key)
        return nil unless attrib

        attrib[:name]
      end

      def init_scalars_from_hash(hash)
        hash.each_pair do |key, value|
          name = attrib_name(key)

          if name.nil?
            log.warn "Attribute #{key} not recognized by #{self.class}. Check the XML schema."
            next
          end

          # This method only reads scalar values
          next if value.is_a?(Array) || value.is_a?(Hash)

          if attrib_skip?(key, value)
            log.debug "Ignored blank value (#{value}) for #{key}"
            next
          end

          send(:"#{name}=", value)
        end
      end
    end
  end
end
