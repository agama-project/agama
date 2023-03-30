# Running D-Installer on a z/VM machine

In order to run **D-Installer** on IBM Z we need to bear in mind that the live image does not contain **linuxrc**, **wicked** and the **installation-images** packages, therefore, most of the [SLE-15-SP4](https://documentation.suse.com/sles/15-SP4/html/SLES-all/cha-zseries.html) documentation is still useful and valid but the devices activation and configuration need some adaptation and so by now there is no interactive menu for configuring some parameters of the installation as that was provided by linuxrc.

The process for IPLing a z/VM installation is very similar to what is described at https://documentation.suse.com/sles/15-SP4/html/SLES-all/cha-zseries.html#sec-prep-ipling-vm but differs a little bit in the **iso** layout, in the provided **parmfile** and what is more important in the way the devices are activated and configured as well as how the installation source medium is provided, next we will describe how to do it with fetching the data from your own **FTP** server:

## Obtain the ALP iso image

Latest ALP **iso** images can be downloaded from:

https://download-repositories.opensuse.org/repositories/SUSE:/ALP:/Products:/Installer:/0.8/images/iso/

```bash
wget https://download-repositories.opensuse.org/repositories/SUSE:/ALP:/Products:/Installer:/0.8/images/iso/d-installer-live.s390x-ALP.iso
Prepare the ISO to be served by your FTP server
```

Currently there is an already fixed issue in kiwi which makes the initrd root-readable only, therefore for modifying it we will extract the iso content instead of just mounting it.

```bash
# once the issue mentioned above is fixed mounting the iso should be enough
# sudo mount -t iso9660 -o loop d-installer-live.s390x-ALP.iso /srv/ftp

sudo mv d-installer-live.s390x-ALP.iso /srv/ftp/d-installer.iso
sudo cd /srv/ftp/
sudo isoinfo -R -X -i d-installer.iso
sudo chmod a+u boot s390x/initrd 
```

**Note:** Setting up an installation server (NFS or FTP) is out of the scope of this document, refer to preparing for installation documentation for installation details.

## Example of z/VM machine installation

For connecting to the z/VM console we will use a 3270 terminal emulator provided by the x3270 package

Use the x3270 console to connect to your LPAR server

Login with your username and password

Enter the CMS (Conversational Monitoring System)
```bash
#CP IPL CMS
```

Link the TCPMAINT disk in order to have the FTP command available:

```
VMLINK TCPMAINT 592
```

Connect to the FTP server and download the needed files for IPLing the installation (in our case anonymous user is allowed):

```bash
FTP example.org (addr ipv4 
anonymous 

cd boot/s390x
locsite fix 80
ascii
get parmfile sles.parmfile.a (repl
get sles.exec sles.exec.a (repl
locsite fix 80
binary
get linux sles.linux.a (repl 
get initrd sles.initrd.a (repl 
quit
```

**Note:** the command `locsite fix 80`, which sets the VM file format to fixed length 80, the file format necessary for punching the binary files to the virtual machine reader.

You can use the FILELIST command to list the files and edit the **parmfile** if needed with XEDIT.

For our machine the parmfile is:

```txt
cio_ignore=all,!condev
rd.cio_accept=0.0.0160
rd.zdev=qeth,0.0.0800:0.0.0801:0.0.0802,layer2=1,portno=0
ip=192.168.0.111::192.168.0.1:24:zvmtest.example.org:enc800:none
nameserver=192.168.0.1
root=live:http://example.org/d-installer.iso
```

Although **cio_ignore** parameter is optional we used it in order to list only the relevant installation devices accepting the ones which we will use for the installation. 

As we do not have an interactive dialog for enabling and configuring our network device we need to provide the settings through the kernel command line, in this case we will use rd.zdev option for activating our qeth device and the ip option for configuring network settings the enc800 linux network interface.

We even could activate our DASD device with the **rd.zdev=dasd,0.0.0160** option which in that case the **rd.cio_accept=0.0.0160** could be omitted as it is superfluous but for this documentation we will do it later with D-Installer.

Finally we will boot from a live image retrieved from an url using the **root=live:<url>** parameter.
  
The content of the sles.exec file is:

```txt
/* REXX LOAD EXEC FOR SUSE LINUX S/390 VM GUESTS       */
/* LOADS SUSE LINUX S/390 FILES INTO READER            */
SAY ''                                                   
SAY 'LOADING SLES FILES INTO READER...'                  
'CP CLOSE RDR'                                           
'PURGE RDR ALL'                                          
'SPOOL PUNCH * RDR'                                      
'PUNCH SLES LINUX A (NOH'                                
'PUNCH SLES PARMFILE A (NOH'                             
'PUNCH SLES INITRD A (NOH'                               
'IPL 00C'                                                
```

Once ready boot the installation running the **sles.exec** REXX file

```bash
sles
```

Once the installation system finish the booting process just connect to the machine with the web browser (e.g. https://s390vsl111.suse.de:9090) or by SSH with (root / linux) user.

## Complete installation Z/VM installation workflow screenshots

For taking the screenshots we have omitted the cio_ignore parameter from the parmfile and as dhcp config is supported the config is quite simple as we can see below:
```txt
rd.zdev=qeth,0.0.0800:0.0.0801:0.0.0802,layer2=1,portno=0
root=live:http://example.org/d-installer.iso
```

Below you will find the screenshots of an z/VM installation selecting the ALP Micro product and doing the activation and format of the DASD device with D-Installer:

![x3269 terminal](https://user-images.githubusercontent.com/7056681/228835939-f6f5f9c8-e81c-4fe7-ac3d-2c6f2590e2cd.png)
![SLES REXX ](https://user-images.githubusercontent.com/7056681/228842954-2ab59682-b82e-4759-9c1e-3e8575947b09.png)
![Cockpit login](https://user-images.githubusercontent.com/7056681/228842974-8c1f4ea5-8165-4bb9-9e8b-51a39e89f321.png)
![Product Selection](https://user-images.githubusercontent.com/7056681/228847895-38e900c3-f20d-40ca-9def-90d7ca547947.png)
![Installation Summary](https://user-images.githubusercontent.com/7056681/228847915-701d5d80-0218-4986-8456-813b1461080a.png)
![Storage Section](https://user-images.githubusercontent.com/7056681/228847920-306d72ee-6be1-42eb-8a6d-beac593e44ab.png)
![Configure DASD](https://user-images.githubusercontent.com/7056681/228848927-63ba80d9-b607-4536-bd96-4de2942f2495.png)
![DASDs list](https://user-images.githubusercontent.com/7056681/228842819-eb8261f1-040e-45d7-b299-80b67cf05615.png)
![DASD activation](https://user-images.githubusercontent.com/7056681/228842827-5b73a37a-4576-408e-90a4-0250b1ce2fc1.png)
![DASD list refreshed](https://user-images.githubusercontent.com/7056681/228842840-88104726-f640-40cc-af99-7948bed68f42.png)
![DASD format](https://user-images.githubusercontent.com/7056681/228846800-6e31ec83-b0d5-4bb2-9fb3-315a1ab12198.png)
![Format Progress](https://user-images.githubusercontent.com/7056681/228849469-b0a43d9b-62b0-4c77-aa99-a4f8f5b0ca02.png)

## Example of formatting 3 DASDs in parallel

![Select DASDs](https://user-images.githubusercontent.com/7056681/228841345-d22260f5-f3a9-4a92-a3b5-526880449a34.png)
![Format progress](https://user-images.githubusercontent.com/7056681/228841358-69ae66f4-f05c-48ba-b047-b24c8aca843a.png)

## Enable diagnose access example

![Select FBA disk](https://user-images.githubusercontent.com/7056681/228841751-b5b37538-7d51-4a0a-9b97-4f2efdfe9e60.png)
![Set use diag](https://user-images.githubusercontent.com/7056681/228841761-dec26714-30b2-4c9a-aaed-0e449698c74b.png)
