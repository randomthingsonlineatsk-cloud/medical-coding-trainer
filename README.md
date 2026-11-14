# Medical Coding Trainer

Code adverse events, medical history and concomitant medications the way a clinical coding
team does: autoencoder, synonym lists, coding conventions, site queries, independent review,
consistency checks and dictionary upversioning, across about 480 verbatim terms from three
fictional studies.

Live: https://randomthingsonlineatsk-cloud.github.io/medical-coding-trainer/

Training only. The studies are fictional, and the two dictionaries are training dictionaries
shaped like MedDRA and WHODrug Global, with invented names, codes and classes and none of their
content.

## What you do

- **Coding workbench**: run the autoencoder (exact matches and approved synonyms), then code
  the rest by verbatim group. Search the medical dictionary at the lowest-level term with its
  preferred term and system class; search the drug dictionary by name or ingredient and choose
  the class by indication and route. Query the site to clarify a term, split two events, or
  move a non-drug; receive the site's answers and code the new terms.
- **Dictionaries**: browse the five-level medical hierarchy with multiaxial links and
  non-current terms, the drug records (record number, sequence 1 and 2, trade names) and their
  classes, and what each new version changes.
- **Synonym lists**: company and study lists, proposed by a coder and approved by a second
  person. Retire wrong entries and re-open the records they coded.
- **Review and QC**: approve by coded term, send back with a reason, the consistency report
  (the same verbatim coded two ways) and flagged records.
- **Upversioning**: the impact report for SMD 1.0 to 1.1 and SDD 2026 Q1 to Q3 (retired
  terms, PT and system class changes, a drug class change, a trade name that now means another
  product), then a signed upgrade, recoding and re-review.
- **Indications**: each medication's indication is coded with the medical dictionary (the
  autoencoder codes exact ones), and an indication cross-check lists medications whose
  indication matches no history or event of the same participant.
- **Languages**: training language versions (German, Spanish, Japanese, Chinese, Hindi) share
  codes with English; exact matches autoencode, other foreign terms need a recorded translation,
  and words with two meanings (German "Schwindel", Japanese めまい) are queried.
- **AI coding assistant**: a simulated suggestion model with a model card proposes a term or a
  query for what the autoencoder leaves; it is usually right and sometimes confidently wrong.
  The coder accepts or rejects each suggestion (with a reason), and the trainer counts wrong
  suggestions accepted.
- **Retrieval**: Standard Search Groups (training analogues of Standardised MedDRA Queries) with
  narrow and broad scopes, counts by system class with and without secondary links, and custom
  queries.
- **Import from the CDM console**: its archive or interim zip (or the ae.csv, mh.csv and cm.csv
  in it) becomes a coding project.
- **Outputs**: the coded SDTM variables of AE, MH and CM (LLT, DECOD, HLT, HLGT, BODSYS/SOC,
  CMDECOD, CMCLAS, CMCLASCD) as CSV, and a coding report.

Three roles: coder, coding reviewer and coding lead. Nobody approves their own coding or their
own synonym.

## Conventions

Nineteen study coding conventions (CC-01 to CC-12 and CC-28 for the medical dictionary, CC-21
to CC-27 for drugs), written on the principles of ICH's MedDRA Term Selection: Points to Consider:
closest current LLT, no added or dropped information, misspellings, diagnosis over symptoms,
separate events, vague terms, death and consequences, procedures, worsening of a condition,
test results, medication errors; trade names, salts, combinations, class by indication and
route, drug classes and non-drugs. Every verbatim in the answer key cites its convention.

## Missions

- **M1** Code the adverse events and medical history of HLV-204-201.
- **M2** Code the concomitant medications of three studies.
- **M3** Audit the company synonym list (five entries should not be there).
- **M4** Upgrade the dictionaries mid-study.
- **M5** Code three studies at scale.
- **M6** Retrieve the safety data: search groups, system classes and a custom query.
- **M7** Code with the AI assistant without accepting its confident mistakes.

Guided, standard and expert levels. Passing all seven gives a certificate with a verification
code and a record for the
[Regulatory Skills Passport](https://randomthingsonlineatsk-cloud.github.io/pharmolecule/passport.html).

## Run it

```bash
npm ci
npm run dev
npm test
npm run build
```

## Sources

- ICH, MedDRA and the MedDRA Points to Consider documents (Term Selection; Data Retrieval and
  Presentation). MedDRA versions 29.0 (March 2026) and 29.1 (September 2026).
- Uppsala Monitoring Centre, WHODrug Global (March and September 2026 releases).
- FDA, Federal Register notice of 24 October 2017: WHODrug Global B3 format for studies starting
  after 15 March 2019.
- CDISC SDTMIG: AE, MH and CM coded variables.
- ICH, MedDRA Data Retrieval and Presentation: Points to Consider.
- FDA draft guidance, Considerations for the Use of Artificial Intelligence to Support Regulatory
  Decision-Making for Drug and Biological Products (January 2025); EMA and FDA, guiding principles
  of good AI practice in drug development (January 2026).

## Licence

Apache License 2.0. See `LICENSE` and `NOTICE`.

Built by Khan Gulrez Shagufa Fazal Ahmed.
