## Questions

[Questions][] are a mechanism that allows the installer to ask for additional data which is needed without knowing it in advance.
Examples are Luks password when Luks encrypted partition occur, whenever activate multipath if installer is not sure
or when software repository is signed with unknown GPG key.

Questions can have answering mode allowing to have unattended installation without stopping by questions. Question can be
also answered from predefined answers. Predefined answers with interactive mode means that question is not asked to user
and instead answer will be used immediatelly. In unattended mode it will prefer predefined answer over default ones.

[Questions]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama.Questions1.html

### Questions and Machine Answers

Questions can be answered by user or by machine. Having machine answers is useful to make questions
non-blocking and non-interactive. Another option is combination that some questions are answered by machine and rest
is answered by user.

#### Requirements for Questions

To make it work there are several requirements for questions:

1. each question has a hierarchical ID to allow partial matching. For example `storage.luks.password` or
software.repository.checksum. Why: it allows in the future when questions are consistent enough to allow something like
storage.* -> :skip. Also it is needed for matching of answers with type of generic question.
2. every question has a defined default secure answer. Why: it allows user to define that he wants default answers for all questions
   to prevent questions to block installation.
3. questions can define additional params in map that help user to answer them. Example repository url and its checksum.
   Partition identification for luks password. Why: Getting data only from question text is hard and very unreadable with regexp.
   So questions need to specify some easy to match data in addition to the pure text.
   E.g. checksum and repository url for automatic repository approval.
4. Question API has method to set answers as path to JSON file. In such case if question
   with known answer is asked, it get immediate response.
   Why: To allow user define machine answers in advance.
5. Questions API have property that defines if for questions without answer default one is used or if ask user.

#### Answers Features

1. Answers contain values in addition to ids that can be matched. To match
id and values, string or array can be used. Array lists all possible values for matching.
2. if key for value is not specified in answer and question contain it, then value is considerd as matched (so partial answer is possible and also it makes backward compatibility easier)
3. For questions without a defined answer, the default strategy for questions will be used. ( so either ask user or use default answer )
4. All questions and answers ( along with the source from where it comes )
   will be logged for later audit ( ideally write it directly as answers.yml or at least with answers yml compatible syntax ). But! question can define if any value or answer is sensitive and in such case
   it will be replaced in the audit. Example answer from luks encryption password question.


#### Use cases and their solutions

1. I am running an unattended installation for the first time and would like to see what questions appear to be able to modify it to
to my needs for mass deployment. -> There is audit which contain logs the exact questions
with all their params, ids, etc. and the answer used with a note if it is answer from answers files, user or default.
Sensitive answers or params will be replaced, so the user has to explicitly specify it again in the file.
2. I run a modified ISO that points to my own software repository. I want it to automatically use my own
  GPG key that I know in advance. -> Use answers.yml file
3. I am doing a mass deployment in an environment where the previous requirement was to encrypt luks with a random password
   and this partition should not be reused. Also mass deployment should not be blocked by questions. -> Use answers.yml and explicitely specify to skip luks questions. And define to use
   default answer instead of asking user.
4. I have my own vendor iso and want to pre-configure installer using CLI before showing web UI. And some actions can/will
   questions that I want to answer before user sees UI -> Use answers.yml file

### Question Types

| class  | description  | possible answers  | available data  | notes  |
|---     |---           |---                |---              |---     |
| `software.medium_error` | When there is issue with access to medium  | `Retry` `Skip`  | `url` with url where failed access happen  |   |
| `software.unsigned_file`  | When file from repository is not digitally signed. If it should be used  | `Yes` `No`  | `filename` with name of file  |   |
| `software.import_gpg`  | When signature is sign with unknown GPG key  | `Trust` `Skip`  | `id` of key `name` of key and `fingerprint` of key |   |
| `storage.activate_multipath` | When it looks like system has multipath and if it should be activated | `yes` `no` |  | Here it is used lower case. It should be unified. |
| `storage.commit_error` | When some storage actions failed and if it should continue | `yes` `no` |  | Also here it is lowercase |
| `storage.luks_activation` | When LUKS encrypted device is detected and it needs password to probe it | `skip` `decrypt` | `device` name, `label` of device, `size` of device and `attempt` the number of attempt | Answer contain additional field password that has to be filled if answer is `decrypt`. Attempt data can be used to limit passing wrong password. |
