## Questions

[Questions][] are a mechanism that allows the user to react to certain situations that occur in the installer.

[Questions]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama.Questions1.html

### Questions and unattended installation

Questions work well, but in some cases, such as automatic or CLI-driven installation, questions can be problematic. So we introduce a mechanism to make even questions
non-blocking and non-interactive. The main goal is to give the user a flexible way of answering questions that he knows in advance.
and for the rest, which are not specified or not yet seen, simply use the default answer.

#### Requirements for Questions

To make it work there are several requirements for questions:

1. each question has a hierarchical ID to allow partial matching. For example `storage.luks.password` or
software.repository.checksum. Why: it allows in the future when questions are consistent enough to allow something like
storage.* -> :skip.
2. every question has a defined default secure answer. Why: it allows real unattended mode even if user does not specify all questions.
3. questions can define additional params in map that help user to answer them. Example repository url and its checksum.
   Partition identification for luks password. Why: Getting data only from question text is hard and very unreadable with regexp.
   So questions need to specify some easy to match data in addition to the pure text.
   E.g. checksum and repository url for automatic repository approval.
4. Question can work in attended and unattended mode. Why: To know when to apply default answer. See 2.

#### Unattended Installation Features

1. Questions contain values in addition to ids that can be matched. To match
id and values, string, regexp or array can be used. Array lists all possible values and regexp is used for matching.
2. if value is not specified in answer that it matches all of them (so partial answer is possible)
3. For questions without a defined answer, the default answer will be used.
4. All questions and answers ( along with the source from where it comes )
   will be logged for later audit ( maybe own file? or maybe write it directly as answers.yml? ). But! question can define if any value or answer is sensitive and in such case
   it will be replaced in the audit. Example answer from luks encryption password question.
5. answers can also be provided in interactive mode. In this case, known answers will be used automatically and
interactively prompts for others. TODO: Is this feature needed?


#### Use cases and their solutions

1. I am running an unattended installation for the first time and would like to see what questions appear to be able to modify it to
to my needs for mass deployment. -> There is questions.log which logs the exact questions
with all their params, ids, etc. and the answer used with a note if it is an automatic answer or one from a
file. Sensitive answers or params will be replaced, so the user has to explicitly specify it again in the file.
2. I run a modified ISO that points to my own software repository. I want it to automatically use my own
  GPG key that I know in advance. -> Use answers.yml file
3. I am doing a mass deployment in an environment where the previous requirement was to encrypt luks with a random password
   and this partition should not be reused -> do nothing as default answer is to skip such partition
4. I have my own vendor iso and want to pre-configure installer using CLI before showing web UI. And some actions can/will
   questions that I want to answer before user sees UI -> Deploy to CLI answers.yml but
   do not set unattended mode, so user actions that result in questions will be answered by the user.
   TODO: Let us clarify if all these use cases are the ones we want to support or if there is another one we want to support.