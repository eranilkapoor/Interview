# AI Agents and Tool Calling

An AI agent uses an LLM to decide actions, call tools, observe results, and continue until a task is complete. Tool calling lets an LLM invoke external functions such as search, database queries, calculators, ticket creation, or workflow APIs.

Agents are powerful but risky. They need boundaries, budgets, permissions, observability, and fallback behavior. In interviews, strong answers mention reliability and safety, not just autonomy.

## Agent Components

- Goal/task
- Planner
- Tools/functions
- Memory/state
- Executor
- Guardrails
- Evaluation
- Human approval for risky actions

## Interview Questions & Answers

**Q: What is tool calling?**  
A: The model selects a predefined function/tool and provides structured arguments. The application executes the tool and returns results to the model.

**Q: When should you use an agent?**  
A: Use agents for multi-step tasks requiring tool use and decisions. Avoid agents when a deterministic workflow is simpler, safer, and easier to test.

**Q: What can go wrong with agents?**  
A: Infinite loops, wrong tool choice, unsafe actions, prompt injection, high cost, slow execution, hidden failures, and poor observability.

**Q: How do you make agents safer?**  
A: Limit tools, validate arguments, enforce permissions, set step/time/cost limits, require human approval for sensitive actions, log traces, and evaluate scenarios.

