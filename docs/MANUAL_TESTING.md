# RepairMe manual testing checklist

## Development demo

1. Run `npm install` then `npm run dev`.
2. From the landing page choose **Diagnose my device**, then **I need a repair**, then **Try Customer Demo**.
3. Open **Diagnose device**, enter a refrigerator symptom, and continue to partner comparison. Book a sample slot.
4. Sign out, choose **I’m a Repair Partner**, and enter the partner demo. The same browser should show the shared request under **Incoming requests**.
5. Accept it → start inspection → enter findings and an itemized quote → submit quote.
6. Sign out and return to the customer demo. In **My repair requests**, approve or reject the submitted quote. Refresh after every stage to confirm persistence.
7. If approved, return to partner demo and progress it to **In progress** then **Completed**. Confirm invalid buttons are absent at each stage.
8. Reset demo data from the sidebar before another walkthrough.

## Safety and validation

1. In diagnosis, enter “I saw sparks and a burning smell.” Confirm the safety intervention appears and no price or booking action is offered.
2. Try submitting under 12 symptom characters. Confirm validation explains what is missing.
3. Upload a non-image or a file over 5 MB. Confirm it is rejected.

## Supabase / Google OAuth

1. Complete the OAuth setup guide, run the schema, and create a new Customer account.
2. Refresh and confirm the session remains active and the stored role does not change.
3. Create a Repair Partner account separately. Confirm its verification status is **pending**, not approved.
4. Use the browser’s Supabase client with another user and confirm it cannot read another customer’s requests or update a status outside the RPC transition rules.
5. Verify the Google provider callback and application `/auth/callback` are both configured as described.
