# frozen_string_literal: true

require "yast"
require "logger"
require "dinstaller/config"
require "transfer/file_from_url"

Yast.import "URL"
Yast.import "Directory"

module DInstaller
  # This class is responsible for reading DInstaller configuration from different locations
  # including kernel cmdline options
  class ConfigReader
    include Yast::Transfer::FileFromUrl
    include Yast::I18n

    # Default DInstaller configuration wich should define all the possible values
    SYSTEM_PATH = "/etc/d-installer.yaml"
    GIT_PATH = File.expand_path("#{__dir__}/../../etc/d-installer.yaml")
    CMDLINE_PATH = "/proc/cmdline"
    REMOTE_BOOT_CONFIG = "d-installer_boot.yaml"
    CMDLINE_PREFIX = "dinst."

    PATHS = [
      "/usr/lib/d-installer.d",
      "/etc/d-installer.d",
      "/run/d-installer.d"
    ].freeze

    attr_reader :logger
    attr_reader :workdir

    # Constructor
    #
    # @param logger [Logger]
    def initialize(logger: nil, workdir: "/")
      @logger = logger || ::Logger.new($stdout)
      @workdir = workdir
    end

    # Return an {Array} with the different {Config} objects read from the different locations
    #
    # TODO: handle precedence correctly
    #
    # @returm [Array<Config>] an array with all the configurations read from the system
    def configs
      @configs ||= config_paths.map { |path| config_from_file(path) }.concat(boot_configs)
    end

    # Return a {Config} oject
    # @return [Config] resultant Config after merging all the configurations
    def config
      config = configs.first || Config.new
      (configs[1..-1] || []).each { |c| config = config.merge(c) }
      config
    end

  private

    # Copy a file from a potentially remote location
    #
    # @param location [String] File location. It might be an URL-like string (e.g.,
    #   "http://example.net/example.yml").
    # @param target [String] Path to copy the file to.
    # @return [Boolean] Whether the file was sucessfully copied or not
    def copy_file(location, target)
      url = Yast::URL.Parse(location)

      res = get_file_from_url(
        scheme:    url["scheme"],
        host:      url["host"],
        urlpath:   url["path"],
        localfile: target,
        urltok:    url,
        destdir:   "/"
      )

      # TODO: exception?
      logger.error "script #{location} could not be retrieved" unless res
      res
    end

    # @return [Hash] Cmdline DInstaller options
    def cmdline_opts
      options = File.read(File.join(workdir, CMDLINE_PATH))

      options.split.each_with_object({}) do |option, result|
        next unless option.start_with?(CMDLINE_PREFIX)

        key, value = option.split("=")
        key.gsub!(CMDLINE_PREFIX, "")
        if key.include?(".")
          section, key = key.split(".")
          result[section] = {} unless result.keys.include?(section)
          result[section][key] = value
        else
          result[key.gsub(CMDLINE_PREFIX, "")] = value
        end
      end
    end

    # @return [Array<Config>]
    def boot_configs
      options = (cmdline_opts || {})
      return [] if options.empty?

      result =  [Config.new.tap { |c| c.pure_data = options }]
      return result if options.fetch("config_url", "").empty?

      file_path = File.join(Yast::Directory.tmpdir, REMOTE_BOOT_CONFIG)
      logger.info "Copying boot config to #{file_path}"

      copy_file(options.fetch("config_url"), file_path)
      result.prepend(config_from_file(file_path))
      result
    end

    # loads correct yaml file
    def config_from_file(path = nil)
      raise "Missing config file at #{path}" unless File.exist?(path)

      Config.new.tap { |c| c.pure_data = YAML.safe_load(File.read(path)) }
    end

    def default_path
      File.exist?(GIT_PATH) ? GIT_PATH : SYSTEM_PATH
    end

    def config_paths
      paths = PATHS.each_with_object([]) do |path, all|
        all.concat(file_paths_in(File.join(workdir, path)))
      end

      paths.uniq! { |f| File.basename(f) }
      # Sort files lexicographic
      paths.sort_by! { |f| File.basename(f) }
      paths.prepend(default_path)

      paths
    end

    def file_paths_in(path)
      if File.file?(path)
        [path]
      elsif File.directory?(path)
        Dir.glob("#{path}/*.{yml,yaml}")
      else
        logger.debug("Ignoring not valid path: #{path}")

        []
      end
    end
  end
end
