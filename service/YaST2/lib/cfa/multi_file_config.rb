# Copyright (c) [2019] SUSE LLC
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

module CFA
  # API to handle configuration of services that are split between {/usr/etc} + {/etc} directories
  #
  # This class is intended to work as base to implement support for that kind of configuration. It
  # abstracts the details about which files are read/written, precedence, etc.
  #
  # Individual files are handled through a separate class (usually CFA based).
  #
  # @example Defining a class to handle a Foo service configuration
  #   class FooConfig < MultiFileConfig
  #     self.file_name = "foo.conf"
  #     self.yast_file_name = "70-yast.conf"
  #     self.file_class = CFA::Foo
  #   end
  #
  # @example Using the previous Foo configuration handler class
  #   config = FooConfig.load
  #   config.some_param = "some_value1"
  #   config.save
  #
  # @example Detecting conflicts
  #   config = FooConfig.load
  #   config.conflicts #=> [:conflicting_param]
  #
  # @see LoginDefsConfig
  class MultiFileConfig
    include Yast::Logger

    class << self
      # Instantiates and loads configuration
      #
      # Convenience method to create instance and load the configuration in just one call.
      #
      # @return [MultiFileConfig]
      def load
        new.tap(&:load)
      end

      # Define an attribute
      #
      # @param attr [Symbol] Attribute name
      def define_attr(attr)
        define_method attr do
          file = files.reverse.find { |f| f.present?(attr) }
          return file.public_send(attr) if file

          yast_config_file.public_send(attr)
        end

        define_method "#{attr}=" do |value|
          yast_config_file.public_send("#{attr}=", value)
        end
      end

      # @!attribute [rw] file_name
      #   @return [String] Base file name (like 'login.defs'  or 'sysctl.conf')
      attr_accessor :file_name

      # @!attribute [rw] yast_file_name
      #   @return [String] YaST specific configuration file name (like '70-yast.conf')
      attr_accessor :yast_file_name

      # @!attribute [r] file_class
      #   @return [Class] CFA file class
      attr_reader :file_class

      def file_class=(klass)
        raise "It is not possible to redefine the associated file class" if @file_class

        @file_class = klass
        define_attrs_from(klass)
      end

    private

      def define_attrs_from(file_class)
        file_class.known_attributes.each { |a| define_attr(a) }
      end
    end

    # Loads the configuration
    def load
      files.each(&:load)
    end

    # Save changes to the YaST specific file
    def save
      log_conflicts
      yast_config_file.save
    end

    # Returns the conflicting attributes
    #
    # Conflicting attributes are the ones which override some value from the YaST specific
    # configuration file.
    #
    # @return [Array<Symbol>]
    def conflicts
      higher_precedence_files.each_with_object([]) do |file, attrs|
        attrs.concat(yast_config_file.conflicts(file))
      end
    end

  private

    # Return the involved configuration files
    #
    # @return [Array<Class>] Configuration files
    # @see #paths
    def files
      @files ||= paths.map { |p| self.class.file_class.new(file_path: p) }
    end

    # Return the paths to the configuration files
    #
    # @return [Array<String>]
    def paths
      @paths ||=
        if Yast::FileUtils.Exists(local_file_path)
          [local_file_path] + local_override_paths
        else
          paths = Yast::FileUtils.Exists(vendor_file_path) ? [vendor_file_path] : []
          paths + vendor_override_paths + local_override_paths
        end
    end

    # Returns the path to the local configuration file
    #
    # @return [String] File path
    def local_file_path
      File.join("/etc", file_name)
    end

    # Returns the path to the vendor configuration file
    #
    # @return [String] File path
    def vendor_file_path
      File.join("/usr/etc", file_name)
    end

    # Returns the paths of the local override files (including the YaST one)
    #
    # @return [Array<String>]
    def local_override_paths
      local_override_dir = override_directory(local_file_path)
      (paths_in(local_override_dir) + [yast_file_path]).uniq.sort
    end

    # Returns the paths of the vendor override files
    #
    # @return [Array<String>]
    def vendor_override_paths
      vendor_override_dir = override_directory(vendor_file_path)
      paths_in(vendor_override_dir)
    end

    # Returns the paths to all files in a given directory
    #
    # @param directory [String]
    # @return [Array<String>]
    def paths_in(directory)
      paths = Yast::SCR.Read(Yast::Path.new(".target.dir"), directory)
      return [] if paths.nil?

      paths.sort.map { |p| File.join(directory, p) }
    end

    # Override directory for a given file
    #
    # @param path [String] File path
    # @return [String]
    def override_directory(path)
      "#{path}.d"
    end

    # Returns the YaST specific configuration file
    #
    # @return [Class]
    def yast_config_file
      @yast_config_file ||= files.find { |f| f.file_path == yast_file_path }
    end

    # Returns the files with higher precedence that the YaST one
    #
    # @return [Array<Class>] List of files
    def higher_precedence_files
      return @higher_precedence_files if @higher_precedence_files

      yast_config_file_idx = files.find_index { |f| f == yast_config_file }
      @higher_precedence_files ||= files[yast_config_file_idx + 1..-1]
    end

    # Path to the YaST override file
    #
    # @return [String]
    def yast_file_path
      @yast_file_path ||= File.join(override_directory(local_file_path), yast_file_name)
    end

    # Configuration file name
    #
    # This is a helper method to get the configuration file name which is defined at class level.
    #
    # @return [String]
    def file_name
      self.class.file_name
    end

    # YaST specific configuration file name
    #
    # This is a helper method to get the YaST specific configuration file name which is defined at
    # class level.
    #
    # @return [String]
    def yast_file_name
      self.class.yast_file_name
    end

    # Logs conflicts
    def log_conflicts
      conflicting_attrs = conflicts
      return if conflicting_attrs.empty?

      log.warn "These configuration values are overridden: #{conflicting_attrs.map(&:to_s).join(", ")}"
    end
  end
end
