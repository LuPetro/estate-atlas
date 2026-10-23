# First owner feedback round

The first experiment seeks five conversations with private owners or landlords who currently organize several properties in spreadsheets, folders or notes. Recruitment is a goal, not a claim that participants already exist. The purpose is to find a useful recurring workflow before choosing more features.

## Recruit for a specific task

Use [Discussions](https://github.com/LuPetro/estate-atlas/discussions) as the public feedback entry point. Ask interested people how they manage properties today, what information they last had to search for, and whether they can try adding or importing a property. Never ask them to post an address, financial document, account email, credential or a portfolio export publicly.

The first source launch supports the documented [Docker installation](docker.md). A self-hosting participant needs their own suitable environment. For owners who do not self-host, demonstrate the labeled synthetic portfolio in a scheduled conversation and record interest in a hosted pilot. Advertise hosted signup only after the real public verification and recovery flow has passed [the web-launch checks](web-launch.md). The password-protected Dev preview is not a public demo.

Publish one personal announcement and one relevant community post whose current rules allow project feedback. The source-first drafts are in [the outreach plan](marketing-launch.md). Answer people who choose to respond; do not send unsolicited direct messages or repeat identical posts across groups. Keep recruitment open for two weeks and record actual responses.

## A 15-minute session

1. **Minutes 0–4:** Ask how the person handles several properties now and what they last needed to find. Ask about a real recent task before demonstrating features.
2. **Minutes 4–10:** Ask them to add a property or import a copy of a list in their own installation. Let them operate it. For a demonstration, use only the app's explicitly labeled test data. Observe unclear fields, import errors and points where help is needed.
3. **Minutes 10–13:** Ask them to find a saved item and identify one task they would come back for next week. Observe whether reminders, documents, rental dates or valuation notes match their actual workflow.
4. **Minutes 13–15:** Ask what would prevent them using it and whether they agree to one follow-up in a week. Record the agreed follow-up channel privately. A positive comment is not evidence of continued use.

Participants choose whether to use their own information and control their own installation. Do not request database access, document copies or recordings. Keep public feedback generalized and obtain permission before quoting someone.

## Measure one path

There is currently no analytics service configured. Count only observable actions or voluntary participant reports, and label them accordingly. Stars, clones and downloads do not establish an active property owner. Keep anonymous aggregate totals in the weekly summary; store consented contact details and participant notes outside Git.

| Stage               | Hosted pilot, once validated                 | Self-hosted source launch                                    |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Interest            | Person agrees to try the product             | Person agrees to install or review their workflow            |
| Account             | Email confirmed in the actual hosted service | Participant confirms their own installation and account work |
| First useful action | Their first property is saved or imported    | They report their first saved or imported property           |
| Return              | Useful action in the following week          | Participant reports a useful action in the following week    |

Use source labels for shared links, for example `utm_source=linkedin&utm_medium=organic&utm_campaign=opensource_pilot`. These labels alone do not collect or count visits. Until measurement is implemented, ask responders how they found the project and leave unknown counts blank.

## Decide after two weeks

The initial target is five owner conversations and three participants who add or import a property. Follow up the next week to learn whether they returned and why. These numbers are experiment targets, not a forecast.

Record each obstacle with the affected task and whether it prevented completion. Prioritize an onboarding fix when people cannot start, and a recurring task when they start successfully but have no reason to return. A feature becomes a candidate when several independent participants describe the same unmet task. Share a short anonymized update in Discussions, including what did not work and the next change chosen from the evidence.
