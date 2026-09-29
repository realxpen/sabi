# SABI — Product Source

Status: ACTIVE
Target: Hackathon MVP with a path to a broader product

## 1. Executive summary

SABI is an AI-powered commerce and coordination agent designed to make the informal/local economy easier to access.

Instead of making a user manually search Instagram, WhatsApp, Google, contacts, and marketplaces, SABI lets the user describe the outcome they want in natural language.

Examples:

- Find a photographer around Yaba tomorrow under ₦50,000.
- Find 20 yards of black Ankara and get it delivered tomorrow under ₦70,000.
- Find lunch that fits my normal preferences, stays under ₦6,000, and can arrive quickly.

SABI can interpret the request, identify relevant providers, contact them where necessary, verify current information such as price and availability, compare valid options, and present the user with the best qualifying choices.

Consequential actions remain under human control.

## 2. Core problem

Informal/local commerce is fragmented.

People often discover providers through:

- friends and referrals
- Instagram
- WhatsApp
- Google
- social media DMs
- phone calls
- physical markets
- community knowledge

The user has to coordinate discovery, trust, availability, pricing, and logistics manually.

Many good providers do not have sophisticated websites or APIs.

Traditional marketplaces generally require the provider to come onto the platform. SABI's longer-term thesis is different: the agent should also be able to meet providers through channels they already use.

## 3. Product vision

Anything the user needs from the local economy should be expressible as an **intent**, not only a search query.

Current pattern:

```text
Search
→ browse
→ compare
→ contact
→ negotiate
→ coordinate
```

SABI pattern:

```text
Tell SABI what you need
→ SABI coordinates the work
→ user approves consequential action
```

## 4. Core product loop

```text
USER INTENT
→ UNDERSTAND
→ PLAN
→ DISCOVER
→ VERIFY
→ CONTACT
→ COLLECT
→ COMPARE
→ RECOMMEND
→ HUMAN APPROVAL
→ TRANSACT / CONNECT
→ FULFILMENT
→ LEARN
```

The hackathon MVP demonstrates the loop only through HUMAN APPROVAL.

## 5. Canonical procurement journey

User:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

SABI extracts:

- mission type: PROCUREMENT
- item: Black Ankara
- quantity: 20
- unit: yards
- maximum budget: ₦70,000
- location: Yaba
- deadline: tomorrow
- approval required: yes

SABI finds candidate providers, contacts them, asks factual questions, records structured quotes, filters out invalid options, compares the remaining offers, explains the recommendation, and requests human approval.

Example result:

- 3 providers contacted
- 2 available
- 1 unavailable
- best qualifying offer: ₦60,000 goods + ₦3,000 delivery
- total: ₦63,000
- delivery: tomorrow
- next step: human approval

## 6. Service journey

Example:

> I need a photographer in Yaba tomorrow. Budget is ₦50,000.

SABI may evaluate:

- service match
- location
- availability
- price
- verification
- portfolio/reputation signals
- missing information that requires contact

## 7. Personalization and food

Future SABI can use user preferences and history.

Example preference context:

- usual lunch budget: ₦4,000–₦6,000
- preferred meals: jollof rice/chicken
- preferred delivery time: under 40 minutes
- previous vendor ratings
- explicit dietary preferences

SABI may proactively prepare suggestions in future, but the default product principle is that spending remains human-approved unless the user explicitly creates a limited-autonomy rule.

## 8. Memory

SABI should eventually learn from:

- explicit user preferences
- past completed orders/bookings
- previous providers
- satisfaction/ratings
- delivery performance
- price outcomes
- response behavior

Memory must not be confused with durable platform Knowledge.

## 9. Provider model

A provider may have:

- name
- category
- contact information
- operating location
- verification status
- products/services
- languages
- hours
- ratings/reviews
- transaction/fulfilment history
- reliability signals

The long-term design does not require every provider to install a dedicated SABI app.

## 10. Trust model

Trust comes from layers, not from one badge.

Potential layers:

- identity/business verification
- verified contact information
- physical-location evidence where practical
- bank/account verification where appropriate
- business registration where applicable
- completed transaction history
- reviews and ratings
- cancellation/dispute history
- response and fulfilment reliability
- repeat customers
- escrow in later phases
- human approval

Verification improves accountability; it does not guarantee that a provider is trustworthy.

## 11. Permission model

Long-term permission levels:

1. **Recommend** — search, compare, explain.
2. **Communicate** — search, call/message, gather information, negotiate within bounded constraints.
3. **Prepare** — create a booking/order/transaction draft that still requires approval.
4. **Limited autonomy** — explicitly authorized, bounded repetitive actions such as a small recurring purchase below a user-defined limit.

The hackathon MVP uses the first three ideas only and stops before financial commitment.

## 12. Product positioning

Avoid reducing SABI to:

- “AI marketplace”
- “AI chatbot for vendors”

Preferred framing:

> SABI is an AI agent that connects people to the informal economy and coordinates the work required to get products and services.

Short version:

> Tell SABI what you need. It figures out how to get it.

## 13. Bigger thesis

Search engines made information searchable.

Marketplaces made products searchable.

Social platforms made people discoverable.

Agentic systems can make outcomes executable.

SABI moves the user from:

> Where can I find X?

toward:

> Can you sort out X for me?

The product combines intent, discovery, communication, trust, action, and memory.

## 14. Relationship to Hustle

SABI can later become an agentic/intelligence layer within Hustle, but the hackathon product should stand on its own.

The relationship is:

```text
Hustle = economic network
SABI = intelligence/action layer that can operate on top of a network
```

SABI must not replace Hustle's human Agent role. Human agents handle relationship-heavy, strategic, complex work; AI agents handle repetitive discovery, qualification, coordination, and bounded execution.

## 15. One-line vision

> SABI is an AI agent for the informal economy that understands what you need, finds trusted providers, communicates with them through channels they already use, compares the available options, and helps you get it done while keeping you in control of important decisions.
