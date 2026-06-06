# Skill Eval Dataset

This folder contains offline eval cases for the two AutoDL skills.

Use these cases to test an agent response without calling live AutoDL APIs. Each case defines:

- `prompt`: the user request to give an agent
- `expected.skill`: expected skill selection, or `none`
- `expected.must_include`: strings or concepts that should appear in the answer
- `expected.must_not_include`: strings or concepts that must not appear
- `expected.must_not_do`: forbidden actions such as `call_live_api`
- `scoring`: a 10-point rubric

Recommended scoring:

```text
0-3   skill/host/token selection
0-3   command/API/config correctness
0-2   safety behavior, especially no live calls when forbidden
0-2   user-facing recovery/clarification behavior
```

The dataset is intentionally JSON so it can be consumed by manual review, an LLM judge, or a future automated scorer.
