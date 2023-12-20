# Software conflicts in Agama

Agama uses *yast2-packager* and *yast2-pkg-bindings* API for selecting patterns/packages and solving dependencies, calling to the *libzypp* C++ library under the hood.

Sometimes there are conflicts with the selected packages/patterns. In that cases, the *zypp* resolver fails and reports a list of problems. In that cases, the YaST Packager UI shows the poblems to the user, allowing to select a solution for each problem.

Agama needs something similar to YaST Packager in order to notify and fix the solver problems. This document analyzes how to bring that feature to Agama.

## Solver problems from libzypp

At low level, the solver problems are obtained in `libzypp` by calling to `#resolvePool` and then to `#problems` method:

~~~
bool success = zypp::getZYpp()->resolver()->resolvePool();
zypp::ResolverProblemList = zypp::getZYpp()->resolver()->problems()
~~~

Each reported problem contains a list of possible solutions:

~~~
zypp::ResolverProblem
    #details
    #solutions (zypp::ProblemSolutionList)

zypp::ProblemSolution
    #description
    #details
~~~

A list of solutions can be passed to `#applySolutions` method in order to fix the reported problems. The list of solutions is built by selecting a solution from the problems. Then the solver (`#resolvePool`) can be called again. Note that `applySolutions` does not require a solution for all the problems. Sometimes a problem is gone as consequence of solving another problem.

~~~
zypp::ProblemSolutionList solutions;
...
zypp::getZYpp()->resolver()->applySolutions(solutions);
bool success = zypp::getZYpp()->resolver()->resolvePool();
~~~

## Managing solver problems in Agama

From Agama point of view, the software proposal could be considered as a not finished task meanwhile there are dependency conflicts. Following that approach, the questions mechanism fits well as a strategy for requesting user intervesion.

Therefore, when a software proposal is calculated, Agama could raise a question if needed in order to make possible to finish the proposal without conflicts. The user should be able to answer the question by selecting a solution for any of the conflicts. Then, Agama would try to calculate the proposal again. If the user decides to cancel the question and finish without solving the problems, then Agama would generate an issue indicating the dependency problems. Note that the installation will not start if there is any issue with level error. Consequently, such a dependency issue would prevent the installation to start.

### Solver problems

The current API in *yast-pkg-bindings* only offers methods to call the solver and to get the number of problems:

~~~
#PkgSolve -> calls to #resolvePool
#PkgSolveErrors -> returns size of #problems
~~~

The API has to be extended to allow getting the list of problems and to indicate the selected solutions for each problem, for example:

~~~
#PkgSolveProblems -> returns the list of problems
#PkgSetSolveSolutions -> sets the list of solutions
~~~

### D-Bus API

Agama needs to provide a new type of question for reporting and selecting solutions for each solver problem.

This could be accomplished by adding a new question interface (e.g., *WithSelection*), which allows selecting an option from a set:

~~~
"org.opensuse.Agama1.Questions.WithSelection"
    #SelectionGroups a(usa{sv})
        id (u)
        description (s)
        options (a{sv})
            id (u)
            description (s)
            details (s)

    #SelectOptions(options a(uu))
        groupId (u)
        optionId (u)
~~~

This new interface would offer a property `SelectionGroups`, which returns a list of selection groups. Each selection group has a list of options for selection. Moreover, there is a `SelectOptions` method which receives a list of pairs. A pair contains a group id and an option id. If the question is accepted, then a new proposal is calculated with the options provided by `SelectOptions`.

In case of canceling the question, an issue is generated in software D-Bus object.

### Notes

Agama can be easily fixed to show an issue when selecting a pattern produces some conflicts. But the dependency issue reported by Agama is far from ideal. It only indicates the number of conflicts (e.g., *Found 2 dependency issues.*).

The feature for reporting and fixing solver problems could be iteratively improved in several steps:

1) Start by showing the dependency issue when selecting a pattern.
2) Extend *yast-pkg-bindings* and improve the issue message, showing the details of the problems.
3) Raise a question when the solver generates problems. This should be done for each call to the solver, not only for selecting patterns.
