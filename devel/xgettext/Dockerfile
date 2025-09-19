FROM registry.opensuse.org/opensuse/tumbleweed:latest

# install gettext-tools and then clean the libzypp caches to keep the image small
RUN zypper --non-interactive install --no-recommends gettext-tools \
    && zypper clean -a

# by default run the xgettext tool when starting the container 
ENTRYPOINT [ "/usr/bin/xgettext" ]

# define a volume so it can used for accessing files outside the container
VOLUME [ "/root/run" ]
WORKDIR /root/run
