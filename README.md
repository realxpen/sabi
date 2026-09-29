# SABI

**SABI — AI Agent for the Informal Economy**

SABI is an agentic AI product that helps people get real-world products and services by expressing an outcome in natural language. Instead of forcing a user to search across Instagram, WhatsApp, Google, contacts, and marketplaces, SABI can understand the request, find relevant providers, contact them through channels they already use, collect factual information, compare options, and return the best qualifying choices while keeping the human in control of consequential actions.

> **Core principle:** Tell SABI what you need. SABI helps you get it done.

## Hackathon MVP

The MVP proves one end-to-end workflow:

```text
User request
  → structured mission
  → provider discovery
  → provider contact
  → structured quote collection
  → comparison
  → recommendation
  → human approval
```

Canonical demo mission:

> “I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.”

The MVP stops at human approval. It does **not** need real payments, escrow, delivery infrastructure, a full marketplace, advanced KYC, or a vendor app.

## Project structure

```text
Raw/
  Hackathon/
  PartnerDocs/
  Research/

Knowledge/
  Product/
  Research/
  UX/
  Technical/
  Business/
  Decisions/

AGENTS.md
PROJECT_STATE.md
README.md
```

This repository follows the AED knowledge-first pattern:

```text
Knowledge
  → Specification
  → Architecture
  → Experience
  → Code
```

## Team

- **Xpen — Product & Integration Lead**
- **Femi — Intelligence, Data & Knowledge Lead**
- **Lara — Agent Tools & Communication Lead**

See `Knowledge/Product/TEAM_OWNERSHIP.md`.

## Start here

Coding agents and contributors should read, in order:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `Knowledge/Product/SABI_PRODUCT_SOURCE.md`
4. `Knowledge/Product/MVP_SCOPE.md`
5. Relevant files under `Knowledge/`

Phase 0 is documentation and architecture only. Application scaffolding begins in Phase 1 after the team reviews and accepts the foundation.
