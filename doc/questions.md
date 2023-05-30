## Questions

[Questions][] are mechanism that allows user to react on certain situations that happen in installer.

[Questions]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama.Questions1.html

### Questions and Unattended Installation

Questions works well, but in some cases like automatic installation or installation driven by CLI
blocking questions can be problematic. So we introduce mechanism how to make even questions
non-blocking and non-interactive. The main goal is to allow user flexible way to answer questions that they
know in advance and for rest that is not specified or do not see yet, simply use the default answer.

#### Requirements for Questions

To make it works there are several requirements for questions:

1. each question has ID that is hierarchical so partial match can be used. Example `storage.luks.password` or
`software.repository.checksum`
2. each question has defined default safe answer.
3. questions can be up to 4 additional params that helps user to answer them. Example repository url and its checksum.
   Partition identification for luks password.
4. Question can work in attended and unattended mode.

#### Features of Unattended Installation

1. Questions beside ids contain also values ( up to 4 with keys value1..4 ) that can be matched. For matching
id and values it can be used string, regexp or array. Array list all possible values and regexp is used for matching.
2. if value is not specified in answer that it matches all of them ( so partial answer is possible )
3. For questions without defined answer default answer will be used.
4. All questions and answers ( together with source from where it comes )
   will be logged for later audit ( maybe own file? or maybe directly write
   it as answers.yml? )
5. asnwers can be provided also in interactive mode. In that case it auto answer known answers and
   do not use defaults for others.


#### Use Cases and Its Solutions

1. I run unattended installation for first time and want to see what questions appear to be able to
modify it to my needs for mass deployment. -> There is questions.log which writes down exact questions
with all its params, ids, etc and used answer with note if it is automatic answer or one comming from
file.
2. I run modified ISO which points to my own software repository. I want to auto agree with my own
  GPG key that I know in advance. -> use answers.yml file
3. I do mass deployment in environment where previous requirement was to have luks encryption with some
   random password and this partition should not be reused -> do nothing as default answer is to skip such partition
4. I have my own vendor iso and I want to preconfigure installer using CLI before showing web UI. And some actions can/will
   provide questions that I want to answer before user see UI -> Providing to CLI answers.yml but
   do not set unattended installation, so user actions that result in questions are answered by user.
