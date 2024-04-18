#! /bin/bash

echo 'add memory size check for livenetroot installation'

[[ -f /usr/lib/dracut/modules.d/90livenet/livenetroot.sh ]] || exit 1

echo 'let memsize=$(($(sed -n "s/MemTotal: *\([[:digit:]]*\).*/\1/p" /proc/meminfo) / 1024))' > /tmp/livenetroot-mod
echo 'let imgsize=$(($(curl -sI "$liveurl" | sed -n "s/Content-Length: *\([[:digit:]]*\).*/\1/p") / (1024 * 1024)))' >> /tmp/livenetroot-mod
echo '' >> /tmp/livenetroot-mod
echo 'if [ $((memsize - imgsize)) -lt 1024 ]; then' >> /tmp/livenetroot-mod
echo "   sed -i 'N;/echo \"\$RDSOSREPORT\"/s/echo$/echo\\" >> /tmp/livenetroot-mod
echo '           echo Warning!!!\' >> /tmp/livenetroot-mod 
echo '           echo The memory size of your system is too small for this live image.\' >> /tmp/livenetroot-mod
echo '           echo Expect killed processes due to out of memory conditions.\' >> /tmp/livenetroot-mod
echo "           echo /' usr/bin/dracut-emergency" >> /tmp/livenetroot-mod
echo '    emergency_shell' >> /tmp/livenetroot-mod
echo 'fi' >> /tmp/livenetroot-mod

sed -i '/info "fetching $liveurl"$/ r /tmp/livenetroot-mod' /usr/lib/dracut/modules.d/90livenet/livenetroot.sh
