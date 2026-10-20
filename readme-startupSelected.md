FutureAdvisor for first-time homebuyers

Original startup: FutureAdvisor offered online wealth management at a fraction of the cost of a traditional financial advisor. Link: https://www.ycombinator.com/companies/futureadvisor

Proposed startup: An AI-powered app for first-time homebuyers that analyzes their finances to determine whether they can afford a specific house, gives them a likelihood score based on market trends, and provides a personalized plan to help them reach their homebuying goal.

Criteria:

1. Solves one problem extremely well: Helps first-time homebuyers find out whether they can afford a specific house based on their real finances, and what they need to change if they can't.
2. Access to target customers: First-time homebuyers are often young professionals and recent graduates, who are accessible through university alumni, friends, and early-career networks. They can test the app using houses they are actually considering.
3. Familiarity with infrastructure: The MVP can use a React web interface, a Python backend, a multimodal LLM API, a database, and free public market data such as mortgage rate and house price index datasets. These technologies are practical to learn and integrate.
4. Reimagines the problem space: Instead of using generic mortgage calculators and scattered online advice, users start with the house they want. The system works backward from their full financial picture and current market conditions to show their odds and a concrete roadmap to buy it.
5. LLM is core to the solution: A multimodal model extracts income, taxes, debts, and assets from uploaded documents like pay stubs, W-2s, and bank statements, and parses house listings into structured data. After a financial engine computes affordability and the likelihood score, the LLM generates a personalized, plain-language plan.
6. Validation guardrail: Every output must pass a validator that checks extracted figures for consistency with the source documents, recomputes every number in the generated plan, and blocks recommendations that are financially impossible or give prohibited advice such as guaranteeing loan approval. Outputs that fail are not shown.
7. Self-correction loop: Validation errors are automatically sent back to the LLM with the source documents, computed values, and failed fields. The model retries extraction or plan generation within a fixed retry limit. Persistent failures are rejected, and the user is asked to confirm the affected fields manually.
8. Deployability: A fully deployable MVP could use a hosted frontend, backend, database, encrypted document storage, and LLM API. To avoid dependence on bank or real estate listing integrations, the first version would rely on user-uploaded documents, user-entered listings, and free public market data.
