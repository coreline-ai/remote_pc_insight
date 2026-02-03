---
description: Start a new project with requirements in one command. Usage: /new <requirements>
---

1. [Check Input] Check if the user provided text after `/new`.
   - If provided: Overwrite `d:/projects/anti_agents_skills/docs/PRD.md` with the input text.
   - If NOT provided: Ask the user "What service would you like to build?" and wait for input.

2. [Launch Orchestrator] Execute the following command:
   > @Agent_PM, orchestrator 스킬을 실행해. docs/ 폴더 분석부터 시작해.
