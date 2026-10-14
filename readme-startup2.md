## NewsCatcher for cybersecurity intelligence
Original startup: NewsCatcher turns information spread across web pages into structured, searchable records of real-world events. Link: https://www.ycombinator.com/companies/newscatcher

Proposed startup: An AI-powered intelligence platform for small cybersecurity teams that tracks newly disclosed vulnerabilities, security incidents, and software vendor advisories in one structured, searchable feed.

Criteria
1. **Solves one problem extremely well: **
Helps small cybersecurity teams monitor relevant vulnerability disclosures and vendor security advisories without manually checking numerous sources.
2. **Access to target customers: **
Potential early testers include computer science students interested in cybersecurity, university IT teams, cybersecurity clubs, and small organizations with limited security staff. Access to actual security professionals should be validated through interviews.
3. **Familiarity with infrastructure: **
The MVP can use Python, web or news APIs, a relational database, scheduled data ingestion, and an LLM API. These components are well suited to a data pipeline and can be learned incrementally.
4. **Reimagines the problem space: **
Instead of presenting a stream of articles, the product organizes disclosures into normalized records with affected products, vulnerability identifiers, publication dates, severity where explicitly reported, and source links. Multiple articles about the same event are deduplicated.
5. **LLM is core to the solution: **
The LLM identifies relevant disclosures, extracts structured fields from inconsistent reports, and determines whether multiple sources refer to the same underlying event. Ordinary keyword search alone cannot reliably normalize all these variations.
6. **Validation guardrail: **
Every vulnerability record must pass a schema validator. Identifiers, dates, source URLs, and other required fields are checked, and factual claims must be supported by the cited source. Severity is not inferred when it cannot be verified.
7. **Self-correction loop: **
Validation errors are automatically returned to the LLM along with the source text and invalid fields. The model retries extraction within a fixed limit. Records that remain invalid are withheld from the main feed, and unsupported claims are never presented as verified facts.
8. **Deployability: **
A hosted web dashboard and scheduled ingestion pipeline can be deployed using public vulnerability feeds and a limited set of vendor advisories. A small, defined source set keeps data collection, processing costs, and reliability manageable.
