## Retrofit for college students recreating outfits from photos
Original startup: Retrofit uses AI to personalize vintage clothing discovery based on users' style, size, budget, and trends. Link: https://www.ycombinator.com/companies/retrofit 

Proposed startup: An AI-powered shopping tool that helps college students recreate outfits from Pinterest, Instagram, or other inspiration photos using affordable and secondhand clothing.

Criteria:
1. Solves one problem extremely well:
Helps college students find affordable clothing items that closely match an outfit in a photo, without manually searching multiple shopping websites.
2. Access to target customers:
College students are an accessible target audience through university friends, student organizations, and campus communities. They can test the tool using outfits they already want to recreate.
3. Familiarity with infrastructure:
The MVP can use a React web interface, a Python backend, a vision-capable LLM API, and a small product catalog stored in a database. These technologies are practical to learn and integrate.
4. Reimagines the problem space:
Instead of searching by keywords or browsing generic recommendations, users start with the outfit they want. The system breaks the photo into individual pieces and finds affordable alternatives that match the overall look.
5. LLM is core to the solution:
A multimodal model interprets the outfit image, identifies clothing categories, colors, patterns, and styles, and converts them into structured product-search criteria. A separate matching step ranks actual products against those criteria.
6. Validation guardrail:
Every recommendation must pass a validator that checks its product URL, price, availability, size where available, and consistency with the extracted clothing attributes. Products that fail are blocked from the results.
7. Self-correction loop:
Validation errors are automatically sent back to the LLM with the original image, product listing, and failed fields. The model retries extraction or matching within a fixed retry limit. Persistent failures are rejected rather than displayed.
8. Deployability:
A fully deployable MVP could use a hosted frontend, backend, database, and LLM API. To avoid dependence on large-scale retailer integrations, the first version would use a curated catalog of accessible product listings.
