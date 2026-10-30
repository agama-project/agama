# |***************************************************************************
# |
# | Copyright (c) [2023] SUSE LLC
# | All Rights Reserved.
# |
# | This program is free software; you can redistribute it and/or
# | modify it under the terms of version 2 of the GNU General Public License as
# | published by the Free Software Foundation.
# |
# | This program is distributed in the hope that it will be useful,
# | but WITHOUT ANY WARRANTY; without even the implied warranty of
# | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# | GNU General Public License for more details.
# |
# | You should have received a copy of the GNU General Public License
# | along with this program; if not, contact SUSE LLC
# |
# | To contact Novell about this file by physical or electronic mail,
# | you may find current contact information at www.suse.com
# |
# |***************************************************************************

# Vendored from yast2-iscsi-client's src/lib/y2iscsi_client/authentication.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-iscsi-client`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "yast2/secret_attributes"

module Y2IscsiClient
  # Class to represent the authentication information for discovery and login operations
  #
  # When performing any of the two mentioned operations, an iSCSI system can be optionally
  # configured to request authentication between controllers (targets) and hosts (initiators) using
  # CHAP (Challenge Handshake Authentication Protocol). There are three options:
  #
  # - No authentication. No usernames or passwords are needed.
  # - CHAP authentication performed by the target. The target authenticates the initiator by sending
  #   it a CHAP challenge. The initiator must know {#username} and {#password}.
  # - Bidirectional CHAP authentication. The target authenticates the initiator as above and then
  #   the initiator authenticates the target by sending it a CHAP challenge. In addition to knowing
  #   the {#username} and {#password} for the first challenge, the initiator must set {#username_in}
  #   and {#password_in} for the second one.
  #
  # In the yast2-iscsi-client source code, authentication is typically represented by one of these
  # two forms:
  #
  # - Just like four separate strings representing the possible usernames and passwords.
  # - Has a hash in which the keys correspond to the names typically used by Open-iscsi in its
  #   configuration files: "authmethod" ("CHAP" or "None"), "username", "username_in",
  #   "password" and "password_in".
  #
  # In both cases, empty strings are used to represent blank values. Leaving the corresponding
  # username/password empty is the main mechanism used to indicate a given authentication direction
  # (by target / by initiator) is not wanted.
  #
  # This class allows to encapsulates that information and the associated logic.
  class Authentication
    include Yast
    include Yast::Logger
    include Yast2::SecretAttributes

    # @return [String] Username for the CHAP challenge during authentication by the target
    attr_accessor :username

    # @return [String] Username for the CHAP challenge during authentication by the initiator
    attr_accessor :username_in

    # @!attribute password
    #   @return [String] Password for the CHAP challenge during authentication by the target
    secret_attr :password

    # @!attribute password_in
    #   @return [String] Password for the CHAP challenge during authentication by the initiator
    secret_attr :password_in

    # Creates a new authentication object from a legacy YaST hash (see description of this class)
    #
    # @param values [Hash{String => String}]
    def self.new_from_legacy(values)
      auth = new
      auth.initialize_from_legacy(values)
      auth
    end

    # Constructor
    def initialize
      @username = ""
      @username_in = ""
      self.password = ""
      self.password_in = ""
    end

    # @see .new_from_legacy
    #
    # @param values [Hash{String => String}]
    def initialize_from_legacy(values)
      # Ignore usernames and passwords if there is an explicit method and is not CHAP
      return if present?(values["authmethod"]) && !values["authmethod"].casecmp?("CHAP")

      @username = values["username"]
      self.password = values["password"]

      # Ignore authentication by initiator if authentication by target is not set
      @username_in = values["username_in"]
      self.password_in = values["password_in"]
    end

    # Whether CHAP authentication should be performed by the target
    #
    # CHAP authentication always implies authentication by target (authentication by initiator
    # is an optional second layer on top).
    #
    # @return [Boolean]
    def by_target?
      present?(username) && present?(password)
    end

    alias_method :chap?, :by_target?

    # Whether CHAP authentication should be performed by the initiator
    #
    # @return [Boolean]
    def by_initiator?
      # Authentication by initiator only makes sense in addition to authentication by target
      return false unless by_target?

      present?(username_in) && present?(password_in)
    end

  private

    # Whether the given variable contains a non-blank string
    #
    # @return [Boolean]
    def present?(attrib)
      !attrib.nil? && !attrib.empty?
    end
  end
end
