# Universal Record Merge \- User Guide

Version: 1.0  
Last updated: March 2026  
Applies to: Salesforce Lightning Experience

## 1\. What Universal Record Merge Is For

Duplicate data is one of the biggest threats to CRM performance.

It leads to fragmented customer views, inaccurate reporting, broken automations, and lost revenue opportunities. Standard Salesforce merge functionality is limited, restricted to a few objects, and often unavailable in Lightning.

Universal Record Merge is a powerful solution that enables teams to identify, review, and merge duplicate records across any object \- safely, efficiently, and at scale.

Designed for both business users and administrators, it delivers a guided merge experience while preserving critical data and maintaining full control over the process.

Universal Record Merge helps users combine duplicate records in a guided, step-by-step workspace.

The normal user flow is:

1. Choose how to find records.  
2. Select records to merge.  
3. Choose which field values to keep.  
4. Review the impact.  
5. Execute the merge.

The app supports two ways to find duplicates:

- By Duplicate Matching Rules  
- By Name / Manual Search

Use By Duplicate Matching Rules when Salesforce Duplicate Rules are already configured and active. Use By Name / Manual Search when users need full manual control over which records are selected.

## 2\. Who Should Use This Guide

This guide is for:

- Salesforce admins who configure merge objects, search behavior, and access.  
- Business users who perform merges in the Lightning app.  
- Support users who review merge logs and troubleshoot failed merges.

## 3\. Before You Start

Before the app can be used successfully, both access and object setup must be in place.

## 3.1 Required Access

- Admin User must have the merge permission set assigned. The default permission set name used by the app is `Universal_Merge_Admin`  
- User must have the merge permission set assigned. The default permission set name used by the app is `Universal_Merge_User`. You can assign this permission via a dedicated tab in Universal Record Merge admin settings.  
- User must have the Salesforce permissions required to read, update, and delete the target records being merged.

## 3.2 Required Object Setup

- The object must be enabled in Universal Record Merge admin settings.  
- The object must be technically eligible for merge in the org.  
- Max Records Per Merge must be 2 or higher.  
- If users will use By Duplicate Matching Rules, that object must have at least one active Salesforce Duplicate Rule.

## 4\. Admin Setup

Admin setup controls which objects users can merge, how manual search behaves, and which users are allowed to run merges.

## 4.1 Open the Admin Area

![][image1]

1. Open the Universal Record Merge app.  
2. Open the admin tab.

This page is the control center for:

- object availability  
- search behavior  
- merge-user assignment

## 4.2 Enable an Object for Merge

Use this when you want an object to appear in the merge workspace.  
![][image2]  
Steps:

1. In Object Configuration, select the object.  
2. Turn on Enabled.  
3. Enter Max Records Per Merge.  
4. Save.

What this setting means:

- Enabled controls whether the app should allow merges for that object.  
- Max Records Per Merge controls how many records a user can include in one merge session.  
- Allowed values are 2 to 200\.

What happens after save:

- The app deploys the object configuration as custom metadata.  
- If the object is also eligible in Salesforce, it becomes available in the merge workspace.

When an object still does not appear:

- It may not be schema-eligible for merge.  
- It may be hidden in Duplicate Matching Rules mode because there is no active Duplicate Rule for that object.

## 4.3 Configure Manual Search with a Field Set

Use this when you want manual search to focus on a defined set of fields instead of relying only on Name.  
![][image3]  
Steps:

1. In Search Configuration, select the object.  
2. Choose a field set.  
3. Save.

What this setting does:

- The chosen field set becomes the runtime source for manual search.  
- The app reads the selected field set from object metadata and uses its fields during search.

If you choose None:

- The app resets search behavior to default Name-field fallback.

What happens in the background:

- Existing search configuration rows that are no longer part of the active selection are deactivated, not deleted.  
- The object configuration is updated to mark that runtime field-set search should be used.

Admin recommendation:

- Keep the field set focused on high-value fields users actually search by.  
- Avoid very broad field sets that mix many low-value fields.

## 4.4 Supported Field Set Search Types

The app does not enforce a strict field-type whitelist when reading the selected field set.

Current implemented behavior:

- The app accepts any field-set member that is a valid field on the object.  
- The field must be accessible to the running user.  
- Duplicate field names are ignored.  
- If no usable fields remain, the app falls back to Name search.

In practical terms, the best-supported search fields are text-like fields that Salesforce SOSL can search effectively, such as:

- Name  
- Text  
- Text Area and Long Text Area  
- Email  
- Phone  
- URL  
- Auto Number  
- Text-based external ID fields

Important note:

- The app includes accessible field-set members at runtime, but actual search quality still depends on Salesforce SOSL behavior for the selected field values.  
- If a field set is technically valid but does not produce useful results in your org, use more user-searchable text-like fields.

Best practice for field sets:

- Prefer fields that users naturally type into search.  
- Good examples: Name, Email, Phone, Customer Number, External Reference, Legacy ID.  
- Avoid using the field set as a dump of every available field.

## 4.5 Assign or Remove Merge Users

Use this when granting or revoking access to the merge process.  
![][image1]  
Steps:

1. Search for a user in the admin page.  
2. Assign or remove merge permission.

What this does:

- The app creates or removes permission-set assignments for the merge permission set.

Admin note:

- The running admin must have permission to create and delete Permission Set Assignment records.

## 5\. End-User Workflow

The user experience is a wizard with four steps: Configure, Select, Map, and Review.

## 5.1 Step 1: Configure

In this step, the user chooses how the merge will be run.  
![][image4]  
User actions:

1. Choose Merge Type.  
2. Choose Object.  
3. Choose how many records can be included in this merge session.

Merge type options:

- By Duplicate Matching Rules  
- By Name / Manual Search

What users should know:

- In Duplicate Matching Rules mode, the object list is automatically filtered. Users only see objects that are enabled and also have active Duplicate Rules.  
- In Manual Search mode, active Duplicate Rules are not required.

## 5.2 Step 2: Select Records

### By Name / Manual Search

Use this mode when the user already knows which records should be merged.

Steps:

1. Enter a search term.  
2. Search for records.  
3. Add the correct records to the merge list.

### By Duplicate Matching Rules

Use this mode when the org already identifies likely duplicates through Salesforce matching logic.

Steps:

1. Search for the source record.  
2. Select one source record.  
3. Click Find Matches.  
4. Review duplicate candidates returned by Salesforce.  
5. Add the candidates that should be merged.

Possible results in this mode:

- Duplicate candidates found  
- No duplicates found  
- No active matching rules for this object  
- Discovery error

Selection rules:

- At least 2 records are required.  
- One record must be designated as master.  
- The number of selected records cannot exceed the configured limit for that session.

## 5.3 Step 3: Map Values

In this step, the user decides which values should survive on the master record.

User actions:

1. Review the compared field values.  
2. Choose the value to keep for each field that can be updated.  
3. Review warnings where records contain different values.

What users will see:

- Updateable fields that can be changed on the master.  
- Non-updateable fields for reference only.  
- Warnings when field values differ across selected records.

Impact summary categories may include:

- Lookup Relationships  
- Master-Detail Relationships  
- Activities  
- Files  
- Notes  
- Emails

## 5.4 Step 4: Review and Execute

This is the final checkpoint before the merge runs.

User should confirm:

- selected object  
- merge type  
- number of selected records  
- chosen master record  
- number of losing records  
- number of mapping decisions applied

Final action:

1. Click Execute Merge.

Important warning:

- Merge is irreversible.  
- Losing records are deleted after merge processing completes successfully.

## 6\. What the App Preserves During Merge

The current implementation is designed to preserve more than just the main record.

Current behavior:

- The chosen master record is updated with the selected field values.  
- Related records are reassigned to the master where the relationship can be updated.  
- Files are preserved by creating links from the document to the master record.  
- Notes are preserved by cloning them to the master record.  
- Losing records are deleted only after these preservation and reassignment steps run.

This is important for users because merging does not only affect the record header. It can also affect related operational history and supporting content.

## 7\. What Users Should Expect by Merge Mode

## 7.1 By Duplicate Matching Rules

Best for:

- users who trust the Salesforce duplicate-detection setup  
- operational teams working from known duplicate policies

Users should expect:

- object list is smaller because only objects with active Duplicate Rules are shown  
- candidate list is driven by Salesforce duplicate detection  
- no results if matching rules are not active or no duplicates are found

## 7.2 By Name / Manual Search

Best for:

- one-off cleanup  
- business-led review  
- cases where duplicate rules are not configured or are too strict

Users should expect:

- more control over selection  
- search behavior based on configured field set when available  
- fallback to Name search when no usable field set is configured

## 8\. Monitoring and Follow-Up

Each merge writes a merge log.

Recommended follow-up:

1. Open the Merge Log tab.  
2. Confirm the merge completed successfully.  
3. Review any error message if a merge failed.

Use merge logs when:

- a user reports that a merge failed  
- a user wants confirmation of what happened  
- support needs to check async-related status payloads or error text

## 9\. Troubleshooting

## 9.1 Object Does Not Appear

Check the following:

- Object is enabled in admin settings.  
- Object is technically eligible for merge.  
- In Duplicate Matching Rules mode, the object has an active Duplicate Rule.

## 9.2 Manual Search Does Not Return Good Results

Check the following:

- A useful field set is configured for the object.  
- The selected field set contains fields users actually search by.  
- The chosen fields are accessible to the running user.  
- If needed, reset to None so the app falls back to Name search.

## 9.3 Duplicate Matching Rules Returns No Results

Possible reasons:

- No active Duplicate Rules exist for the object.  
- The selected source record does not currently match other records.  
- Salesforce duplicate detection did not return candidates.

## 9.4 User Cannot Continue to Next Step

Check the following:

- At least 2 records are selected.  
- A master record is selected.  
- Selected record count is within the configured limit.

## 9.5 Merge Failed

Check the following:

- Object is enabled and eligible.  
- User has required permissions on the target records.  
- Merge Log contains an error message with the failure reason.

## 10\. Recommended Operating Practices

- Start with a small pilot on each object before broad rollout.  
- Use Duplicate Matching Rules only when those rules are actively maintained.  
- Keep manual-search field sets simple and business-friendly.  
- Train users to review the mapping step carefully before execution.  
- Review merge logs regularly during rollout and after configuration changes.

## 11\. Important Current Product Behavior

These points reflect the current implementation and are useful for admins and support users to know:

- All workspace merges currently run through the custom merge engine.  
- Related records, files, and notes are processed before losing records are deleted.  
- Duplicate Matching Rules mode only shows objects with active Duplicate Rules.  
- The Lightning app uses the configured content asset logo.

[image1]: urm-admin-settings

[image2]: urm-object-settings

[image3]: urm-object-config

[image4]: urm-merge-type