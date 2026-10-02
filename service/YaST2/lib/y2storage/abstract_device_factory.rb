# Copyright (c) [2015] SUSE LLC
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
require "storage"
require "yaml"
require "tsort"
require "y2storage/exceptions"

module Y2Storage
  #
  # Abstract factory class to generate device trees and similar objects with
  # a tree structure from YAML. The FakeDeviceFactory is one example subclass.
  #
  # This class uses introspection and duck-typing with a number of predefined
  # methods that a subclass is required to implement.
  #
  # Subclasses are required to implement a create_xy() method for each
  # factory product 'xy' the factory is able to create and some methods to
  # support some basic sanity checks of the generated device tree:
  #
  # - valid_hierarchy()
  # - valid_toplevel()
  # - valid_param()
  #
  # Optional:
  # - fixup_param()
  # - dependencies()
  #
  # From the outside, use load_yaml_file() or build_tree() to start
  # generating the tree.
  #
  # Avoid create_xy() methods that are not factory methods.
  #
  class AbstractDeviceFactory
    include Yast::Logger

    class HierarchyError < Y2Storage::Error
    end

    attr_reader :devicegraph

    def initialize(devicegraph)
      @devicegraph = devicegraph
      @factory_methods = nil
      @factory_products_cache = nil
    end

    # Read a YAML file and build a fake device tree from it.
    #
    # @param yaml_file [String, IO] YAML file
    #
    def load_yaml_file(yaml_file)
      if yaml_file.respond_to?(:read)
        YAML.load_stream(yaml_file) { |doc| build_tree(doc) }
      else
        File.open(yaml_file) do |file|
          block = proc { |doc| build_tree(doc) }
          old_ruby = RUBY_VERSION.start_with?("2.")
          if old_ruby
            YAML.load_stream(file, yaml_file, &block)
          else
            YAML.load_stream(file, filename: yaml_file, &block)
          end
        end
      end
    rescue SystemCallError => e
      log.error(e.to_s)
      raise
    end

    # Build a device tree starting with 'obj' which was typically read from
    # YAML. 'obj' can be a hash with a single key or an array of hashes with
    # a single key each.
    #
    # @param obj [Hash or Array<Hash>]
    #
    def build_tree(obj)
      case obj
      when Hash
        build_tree_toplevel(obj)
      when Array
        obj.each do |element|
          raise TypeError, "Expected Hash, not #{element}" unless element.is_a?(Hash)

          build_tree_toplevel(element)
        end
      else
        raise HierarchyError, "Expected Hash or Array at toplevel"
      end
    end

    private

    # Build the toplevel for a device tree starting with 'obj'.
    #
    # @param obj [Hash]
    #
    def build_tree_toplevel(obj)
      name, content = break_up_hash(obj)
      raise HierarchyError, "Unexpected toplevel object #{name}" if !valid_toplevel.include?(name)

      build_tree_recursive(nil, name, content)
    end

    # Builds tree from hash
    # @see #build_tree_recursive
    def build_tree_recursive_from_hash(parent, name, content)
      # Check if all the parameters we got belong to this factory product
      check_param(name, content.keys)

      # Split up pure parameters and sub-product descriptions
      sub_prod = content.select { |k, _v| factory_products.include?(k) }
      param    = content.reject { |k, _v| factory_products.include?(k) }

      # Call subclass-defined fixup method if available
      # to convert known value types to a better usable type
      param = fixup_param(name, param) if respond_to?(:fixup_param, true)

      # Create the factory product itself: Call the corresponding create_ method
      child = call_create_method(parent, name, param)

      product_order = sort_by_product_order(sub_prod.keys)
      # Create any sub-objects of the factory product
      product_order.each do |product|
        build_tree_recursive(child, product, sub_prod[product])
      end
    end

    # Builds multiple trees from list of hashes
    # @see #build_tree_recursive
    def build_tree_recursive_from_array(parent, name, content)
      content.each do |element|
        raise TypeError, "Expected Hash, not #{element}" unless element.is_a?(Hash)

        child_name, child_content = break_up_hash(element)
        check_hierarchy(name, child_name)
        build_tree_recursive(parent, child_name, child_content)
      end
    end

    # Internal recursive version of build_tree: Build a device tree as child
    # of 'parent' for a new hierarchy level for a factory product 'name' with
    # content (parameters and sub-products) 'content'. 'parent' might be
    # 'nil' for toplevel objects. This class does not care about 'parent', it
    # only passes it as a parent parameter to the respective create_xy methods.
    #
    # @param parent [Object] parent object to be passed to the create_xy methods
    # @param name   [String] name of the factory product ("disk", "partition", ...)
    # @param content [Any]   parameters and sub-products of 'name'
    #
    def build_tree_recursive(parent, name, content)
      raise HierarchyError, "Don't know how to create a #{name}" if !factory_products.include?(name)

      case content
      when Hash
        build_tree_recursive_from_hash(parent, name, content)
      when Array
        build_tree_recursive_from_array(parent, name, content)
      else # Simple value, no hash or array
        # Intentionally not calling fixup_param() here since that method would
        # not get any useful information what about the value to convert
        # (since there is no hash key to compare to).
        call_create_method(parent, name, content)
      end
    end

    # rubocop:disable Lint/UselessAccessModifier

    protected

    # rubocop:enable Lint/UselessAccessModifier

    #
    # Methods subclasses need to implement:
    #

    # Return a hash for the valid hierarchy of the products of this factory:
    # Each hash key returns an array (that might be empty) for the child
    # types that are valid below that key.
    #
    # @return [Hash<String, Array<String>>]
    #
    # def valid_hierarchy
    #   VALID_HIERARCHY
    # end

    # Return an array for valid toplevel products of this factory.
    #
    # @return [Array<String>] valid toplevel products
    #
    # def valid_toplevel
    #   VALID_TOPLEVEL
    # end

    # Return an hash of valid parameters for each product type of this
    # factory. This does not include sub-products, only the parameters that
    # are passed directly to each individual product.
    #
    # @return [Hash<String, Array<String> >]
    #
    # def valid_param
    #   VALID_PARAM
    # end

    # Factory method to create a disk.
    #
    # @return [::Storage::Disk]
    #
    # def create_disk(parent, args)
    #   # Create a disk here
    #   nil
    # end

    # Fix up parameters to the create_xy() methods. This can be used to
    # convert common parameter value types to something that is better to
    # handle, possibly based on the parameter name (e.g., "size"). The name
    # of the factory product is also passed to possibly narrow down where to
    # do that kind of conversion.
    #
    # This method is optional. The base class checks with respond_to? if it
    # is implemented before it is called. It is only called if 'param' is a
    # hash, not if it's just a plain scalar value.
    #
    # @param name [String] factory product name
    # @param param [Hash] create_xy() parameters
    #
    # @return [Hash or Scalar] changed parameters
    #
    # def fixup_param(name, param)
    #   param
    # end

    # Return a hash describing dependencies from one sub-product (on the same
    # hierarchy level) to another so they can be produced in the correct order.
    #
    # For example, if there is an encryption layer and a file system in a
    # partition, the encryption layer needs to be created first so the file
    # system can be created inside that encryption layer.
    #
    #
    # def dependencies
    #   dep
    # end

    private

    # Return the factory methods of this factory: All methods that start with
    # "create_".
    #
    # @return [Array<Symbol>] create methods
    #
    def factory_methods
      @factory_methods ||= methods.grep(/^create_/)
    end

    # Return the products this factory can create. This is derived from the
    # factory methods minus the "create_" prefix.
    #
    # @return [Array<String>] product names
    #
    def factory_products
      if @factory_products_cache.nil?
        @factory_products_cache = factory_methods.map { |m| m.to_s.gsub(/^create_/, "") }

        # For some of the products there might not be a create_ method, so
        # let's add the valid hierarchy description
        @factory_products_cache += valid_hierarchy.keys + valid_hierarchy.values.flatten
        @factory_products_cache.uniq!
      end
      @factory_products_cache
    end

    # Make sure 'obj' is a hash with a single key and break it up into that
    # key and the content. Raise an exception if this is some other object.
    #
    # @param obj [Hash]
    # @return [String, Object] hash key and hash content
    #
    def break_up_hash(obj)
      name = obj.keys.first.to_s
      raise HierarchyError, "Expected hash, not #{obj}" unless obj.is_a?(Hash)
      raise HierarchyError, "Expected exactly one key in #{name}" if obj.size != 1

      content = obj[name]
      [name, content]
    end

    # Check if all the parameters in "param" are expected for factory product
    # "name".
    #
    # @param name  [String] factory product name
    # @param param [Array<Symbol> or Array<String>] parameters (hash keys)
    #
    def check_param(name, param)
      expected = valid_param[name]
      expected += valid_hierarchy[name] if valid_hierarchy.include?(name)
      param.each do |key|
        raise ArgumentError, "Unexpected parameter #{key} in #{name}" if !expected.include?(key.to_s)
      end
    end

    # Check if 'child' is a valid child of 'parent'.
    # Raise an exception if not.
    #
    # @param parent [String] name of parent factory product
    # @param child  [String] name of child  factory product
    #
    def check_hierarchy(parent, child)
      return if valid_hierarchy[parent].include?(child)

      raise HierarchyError, "Unexpected child #{child} for #{parent}"
    end

    # Call the factory 'create' method for factory product 'name'
    # with 'args' as argument. This requires a create_xy() method to exist
    # for each product 'xy'. Introspection is used to find those methods.
    #
    # @param parent [Object] parent object of 'name' (might be 'nil')
    # @param name [String] name of the factory product
    # @param arg [Hash or Scalar] argument to pass to the create method
    #
    def call_create_method(parent, name, arg)
      create_method = "create_#{name}".to_sym

      begin
        if respond_to?(create_method, true)
          log.info("#{create_method}( #{parent}, #{arg} )")
          send(create_method, parent, arg)
        else
          log.warn("WARNING: No method #{create_method}() defined")
          nil
        end
      rescue Storage::WrongNumberOfChildren
        raise HierarchyError, "Wrong number of children for #{parent} when creating #{name}"
      end
    end

    # Helper class for a topological sort for dependencies.
    # Taken from the Ruby TSort reference documentation.
    #
    class DependencyHash
      include TSort

      def initialize(hash)
        @nodes = hash
      end

      def tsort_each_node(&block)
        @nodes.each_key(&block)
      end

      def tsort_each_child(node, &block)
        @nodes.fetch(node, []).each(&block)
      end
    end

    # Sort products by product dependency.
    #
    # @param products [Array<String>] product names
    # @return [Array<String]
    #
    def sort_by_product_order(products)
      return products if products.size < 2
      return products unless respond_to?(:dependencies, true)

      dependency_order = DependencyHash.new(dependencies).tsort
      ordered = dependency_order.select { |p| products.include?(p) }
      rest = products.dup
      rest.delete_if { |p| dependency_order.include?(p) }
      ordered.concat(rest)
    end
  end
end
