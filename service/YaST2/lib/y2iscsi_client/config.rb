# Vendored from yast2-iscsi-client's src/lib/y2iscsi_client/config.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-iscsi-client`
# RPM is no longer a runtime dependency of Agama.

require "yast"

module Y2IscsiClient
  # Class to represent the content of the main configuration file (/etc/iscsi/iscsid.conf)
  class Config
    include Yast
    include Yast::Logger

    # Path of the sendtargets authentication in the config file
    DISCOVERY_AUTH = "discovery.sendtargets.auth".freeze
    private_constant :DISCOVERY_AUTH

    # Constructor
    def initialize
      @raw_data = {}
    end

    # Array with all the entries of the configuration
    #
    # Each entry is represented by hash that follows the structure of the yast init-agent.
    #
    # @return [Array<Hash>]
    def entries
      raw_data.fetch("value", [])
    end

    # Setter for #entries
    #
    # @param values [Array<Hash>]
    def entries=(values)
      raw_data["value"] = values
    end

    # Whether the object contains information obtained from a configuration file
    #
    # @return [Boolean]
    def empty?
      raw_data.empty?
    end

    # Load information from the system
    def read
      @raw_data = Yast::SCR.Read(path(".etc.iscsid.all"))
      log.debug("read config #{raw_data}")
    end

    # Write configuration to the system
    def save
      Yast::SCR.Write(path(".etc.iscsid.all"), raw_data)
      Yast::SCR.Write(path(".etc.iscsid"), nil)
    end

    # Modifies the needed entries in order to set the given configuration for discovery
    # authentication
    #
    # @param auth [Authentication]
    def set_discovery_auth(auth) # rubocop:disable Naming/AccessorMethodName
      if auth.chap?
        self.entries = set_or_add(entries, "#{DISCOVERY_AUTH}.authmethod", "CHAP")
        self.entries = set_or_add(entries, "#{DISCOVERY_AUTH}.username", auth.username)
        self.entries = set_or_add(entries, "#{DISCOVERY_AUTH}.password", auth.password)
      else
        self.entries = delete(entries, "#{DISCOVERY_AUTH}.authmethod")
        self.entries = delete(entries, "#{DISCOVERY_AUTH}.username")
        self.entries = delete(entries, "#{DISCOVERY_AUTH}.password")
      end

      if auth.by_initiator?
        self.entries = set_or_add(entries, "#{DISCOVERY_AUTH}.username_in", auth.username_in)
        self.entries = set_or_add(entries, "#{DISCOVERY_AUTH}.password_in", auth.password_in)
      else
        self.entries = delete(entries, "#{DISCOVERY_AUTH}.username_in")
        self.entries = delete(entries, "#{DISCOVERY_AUTH}.password_in")
      end
    end

    # Modifies the needed entries in order to set the given ISNS configuration
    def set_isns(address, port)
      if address.empty? || port.empty?
        self.entries = delete(entries, "isns.address")
        self.entries = delete(entries, "isns.port")
      else
        self.entries = set_or_add(entries, "isns.address", address)
        self.entries = set_or_add(entries, "isns.port", port)
      end
    end

  private

    # Internal representation of the data
    #
    # Due to the way YaST ini-agent works, this variable follows the structure
    # {"kind"=>"section", "type"=>-1, "value"=> Array<Hash> }
    # in which that latter array of hashes represents the relevant entries in the
    # configuration file.
    #
    # return [Hash]
    attr_reader :raw_data

    # Converts the given hash into the format needed by ini-agent
    #
    # @param old_map [Hash] hash with two keys "KEY" and "VALUE"
    # @return [Hash]
    def create_map(old_map)
      {
        "name"    => old_map.fetch("KEY", ""),
        "value"   => old_map.fetch("VALUE", ""),
        "kind"    => "value",
        "type"    => 1,
        "comment" => ""
      }
    end

    # Modifies the value of the entry with the given name, creating a new entry if none exists
    #
    # @param old_list [Array<Hash>] list of maps in the format used by ini-agent (see {#create_map})
    # @param key [String] name of the entry
    # @param value [Object] new value for the entry
    # @return [Array<Hash>] modified list of maps
    def set_or_add(old_list, key, value)
      new_list = deep_copy(old_list)

      element = new_list.find { |row| row["name"] == key }
      if element
        element["value"] = value
      else
        new_list << create_map({ "KEY" => key, "VALUE" => value })
      end

      new_list
    end

    # Deletes the entry with the given key
    #
    # @param old_list [Array<Hash>] list of maps in the format used by ini-agent (see {#create_map})
    # @param key [String] name of the entry to be deleted
    # @return [Array<Hash>] modified list of maps
    def delete(old_list, key)
      log.info("Delete record for #{key}")
      old_list.reject { |row| row["name"] == key }
    end
  end
end
