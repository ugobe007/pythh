# Funding Participation Ontology

Participation language is evidence, not interchangeable marketing copy.

| Source language | Stored role | Relationship meaning |
|---|---|---|
| “X invested in Company” | `participant` | `INVESTED_IN`: X supplied capital to the company in this financing. It does not imply leadership. |
| “X led the round” | `lead` | `LED_ROUND`: X led this specific financing. |
| “X and Y co-led the round” | `co_lead` | `CO_LED_ROUND`: each named firm jointly led this financing. |
| “X participated in the round” | `participant` | `PARTICIPATED_IN_ROUND`: X joined this financing; check size and leadership remain unknown. |
| “the round was led by X, joined by Y” | `lead` for X; `participant` for Y | The `joined by` clause ends the leadership clause; Y must not inherit lead status. |
| “X participated in the syndicate” | `syndicate_member` | `PARTICIPATED_IN_SYNDICATE`: X belongs to the named financing syndicate. This does not by itself establish lead status. |
| “existing investor X participated” | `existing_investor` | Follow-on participation in this financing. |

`CO_INVESTED_WITH` is never extracted merely because two firms occur in the
same article. It is derived only when both firms are verified participants in
the same canonical financing round. The edge must retain that round ID.

Unknown or ambiguous phrases remain `unknown`. “Backed by,” portfolio-page
membership, an investor quote, an advisor role, lending, grants, acquisition
financing, and investment talks do not automatically establish participation.
