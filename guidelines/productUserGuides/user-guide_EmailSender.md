# Flow Email Composer — User Guide

**Version:** 1.0  
**Last updated:** March 2026  
**Applies to:** Salesforce Lightning Experience

---

## Table of Contents

1. [What Is Flow Email Composer?](#1-what-is-flow-email-composer)  
2. [Who This Guide Is For](#2-who-this-guide-is-for)  
3. [For Administrators: Setting Up the Component](#3-for-administrators-setting-up-the-component)  
   - 3.1 [Assign Permission Sets](#31-assign-permission-sets)  
   - 3.2 [Add the Component to a Flow](#32-add-the-component-to-a-flow)  
   - 3.3 [Configure the Component Properties](#33-configure-the-component-properties)  
   - 3.4 [Enable Email-to-Case Threading](#34-enable-email-to-case-threading)  
   - 3.5 [Configure Sender Options](#35-configure-sender-options)  
   - 3.6 [Connect Flow Output Variables](#36-connect-flow-output-variables)  
   - 3.7 [Use Without a UI (Invocable Action)](#37-use-without-a-ui-invocable-action)  
   - 3.8 [Translate UI Labels (Translation Workbench)](#38-translate-ui-labels-translation-workbench)  
4. [For End Users: Composing and Sending Email](#4-for-end-users-composing-and-sending-email)  
   - 4.1 [The Email Composer Screen](#41-the-email-composer-screen)  
   - 4.2 [Adding Recipients](#42-adding-recipients)  
   - 4.3 [Choosing a Sender (FROM)](#43-choosing-a-sender-from)  
   - 4.4 [Writing the Subject and Body](#44-writing-the-subject-and-body)  
   - 4.5 [Pasting Images into the Body](#45-pasting-images-into-the-body)  
   - 4.6 [Attaching Files](#46-attaching-files)  
   - 4.7 [Sending the Email](#47-sending-the-email)  
5. [Email Templates](#5-email-templates)  
6. [Email-to-Case Replies](#6-email-to-case-replies)  
7. [Viewing Send History](#7-viewing-send-history)  
8. [Troubleshooting](#8-troubleshooting)  
9. [Reference: Component Properties](#9-reference-component-properties)

---

## 1\. What Is Flow Email Composer?

Organizations often require a standardized and guided email communication process within Salesforce.

Typical Salesforce email actions provide limited customization capabilities and do not allow administrators to easily preconfigure recipients, templates, attachments, and activity tracking inside a Flow-driven process.

Flow Email Composer enables administrators to build a guided email sending experience within a Screen Flow, where key email fields are automatically pre-populated from Salesforce data, ensuring consistency, reducing manual effort, and improving data traceability.

Flow Email Composer is a Salesforce component that lets you compose and send emails directly inside a Salesforce Flow. It provides:

* A rich-text email editor with formatting tools

* Recipient search across Contacts, Leads, and Users

* Sender selection (your own address, an Org-Wide address, or an Email-to-Case address)

* File attachments and inline image paste

* Email template support

* Automatic Email-to-Case thread linking so customer replies land on the correct Case

* A full send history log for every email sent

---

## 2\. Who This Guide Is For

| Section | Audience |
| :---- | :---- |
| Section 3 | **Salesforce Administrators** setting up the component in a Flow |
| Section 4–7 | **End Users** composing and sending email through the component |
| Section 8 | **Anyone** troubleshooting errors |

---

## 3\. For Administrators: Setting Up the Component

### 3.1 Assign Permission Sets

Before users can send email, assign the correct permission set to each user profile.

| Permission Set | Assign To |
| :---- | :---- |
| **FEC\_Composer\_User** | Any user who needs to compose and send email |
| **FEC\_Admin** | Administrators managing the package and reviewing logs |
| **FEC\_Support** | Support staff who need to view send history only |

**Steps:**

1. Go to **Setup → Users → Permission Sets**.  
2. Click the permission set name.  
3. Click **Manage Assignments → Add Assignments**.  
4. Select the users and click **Assign**.

---

### 3.2 Add the Component to a Flow

1. Open **Setup → Flows** and open (or create) a Screen Flow.  
2. Add a **Screen** element.  
3. In the Screen editor, search for **Flow Email Composer** in the components panel.  
4. Drag it onto the screen canvas.  
5. Configure the properties (see Section 3.3).  
6. Save and activate the flow.

**Important:** The component must be placed on a **Screen** element. It cannot be placed on a record page directly — embed the Flow in a record page instead using a Flow component.

---

### 3.3 Configure the Component Properties

All properties are set in the Flow Builder property panel when the component is selected. Properties marked **Required** must have a value for the component to work correctly.

#### Record Context

| Property | Description | Example |
| :---- | :---- | :---- |
| **Relate To Record ID** | The Salesforce record this email will be linked to (e.g. Case Id). If blank, falls back to the Flow's built-in `{!$Record.Id}`. | `{!caseId}` |

#### Recipients

| Property | Description | Example |
| :---- | :---- | :---- |
| **Default To Emails** | Pre-populate the To field. Accepts a text collection variable. | `{!contactEmailCollection}` |
| **Default Cc Emails** | Pre-populate the Cc field. Accepts a text collection variable. | `{!contactEmailCollection}` |
| **Default Bcc Emails** | Pre-populate the Bcc field. Accepts a text collection variable. | `{!contactEmailCollection}` |

#### Subject and Body

| Property | Description |
| :---- | :---- |
| **Subject Default** | Initial text for the subject line. Once the user edits the field, this value is no longer applied. |
| **Body Default** | Initial HTML content for the body. Once the user edits the body, this value is no longer applied. |
| **Default Email Template ID** | Id, DeveloperName, or Name of an active Email Template. The template is rendered against the relate-to record and pre-fills subject and body with merged values. If set, `Subject Default` and `Body Default` are ignored. |

#### Send Button

| Property | Options | Default |
| :---- | :---- | :---- |
| **Send Button Label** | Any text | `Send` |
| **Send Button Alignment** | `left` / `center` / `right` | `left` |

If **Send Button Label** is left blank (or kept as `Send`), the component uses the translated Custom Label value from `FEC_Composer_Send`.

#### Validation

| Property | Description | Default |
| :---- | :---- | :---- |
| **Require Subject** | Block send if subject is empty | `false` |
| **Require Body** | Block send if body is empty | `false` |

#### File Attachments

| Property | Description | Default |
| :---- | :---- | :---- |
| **Enable File Attachments** | Show the file attachment section | `false` |
| **Attachment Label** | Section heading label | `Attachments` |
| **Accepted File Types** | Comma-separated extensions or MIME types | `.png,.jpg,.pdf,.doc,...` |
| **Max Attachment Count** | Maximum number of files (1–25) | `5` |
| **Default Content Document IDs** | Pre-attach files by Salesforce Content Document Id collection |  |

If **Attachment Label** is left blank (or kept as `Attachments`), the component uses the translated Custom Label value from `FEC_Composer_Attachments`.

#### Sender Options

| Property | Description | Default |
| :---- | :---- | :---- |
| **Allow Current User Sender** | Include the current user's email in the FROM dropdown | `true` |
| **Allow Org-Wide Sender** | Include Org-Wide Email Addresses in the FROM dropdown | `true` |
| **Allow Email-to-Case Sender** | Include Email-to-Case addresses in the FROM dropdown | `true` |
| **Default From Email** | Pre-select a FROM address by email address |  |
| **Default From Read Only** | Lock the FROM field so users cannot change it | `false` |

#### Email-to-Case Threading

| Property | Description | Default |
| :---- | :---- | :---- |
| **Add Email to Case Thread** | Enable threading. Requires `Relate To Record ID` to be a Case. | `false` |

---

### 3.4 Enable Email-to-Case Threading

Threading allows customer replies to an outbound email to be routed back to the same Case automatically, instead of creating a new Case.

**Requirements:**

- `Relate To Record ID` must be a **Case** record Id.  
- The **Add Email to Case Thread** property must be set to `true`.  
- The `EnableThreading` feature flag in **Custom Metadata → Feature Flags** must be enabled (it is `true` by default).

**How it works behind the scenes:** The component embeds a hidden Salesforce thread token inside the email HTML body. When the customer replies, Salesforce Email-to-Case detects this token and routes the reply to the original Case. The token is invisible to email recipients.

**Verify the flag is on:**

1. Go to **Setup → Custom Metadata Types → Feature Flag → Manage Records**.  
2. Find `Enable Threading` and confirm **Enabled** is checked.

---

### 3.5 Configure Sender Options

The FROM dropdown is populated automatically based on what is allowed and accessible:

- **Current User** — the logged-in user's email address. Always available when `Allow Current User Sender = true`.  
- **Org-Wide Email Addresses** — configured in **Setup → Org-Wide Email Addresses**. Only verified, accessible addresses appear.  
- **Email-to-Case Addresses** — addresses configured under **Setup → Email-to-Case** routing rules. If the address is also an Org-Wide Email Address, FROM override works at delivery time (the email is sent from that address, not the current user).

**Note:** For an Email-to-Case sender address to correctly appear as the FROM address in delivered email, the routing address must also be registered as a verified Org-Wide Email Address in Salesforce. If it is not, the email will still send but will be delivered from the current user's address.

---

### 3.6 Connect Flow Output Variables

After a successful send, the component writes the following values to Flow variables. Create matching Flow variables and connect them in the component property panel to use these downstream in your flow.

| Output Variable | Type | Description |
| :---- | :---- | :---- |
| **Is Success** | Boolean | `true` if the email was sent successfully |
| **Error Message** | Text | Error description if the send failed |
| **Email Message ID** | Record ID | Salesforce `EmailMessage` record created for the send |
| **Message Identifier** | Text | RFC 5322 `Message-ID` header value |
| **To Recipients Metadata JSON** | Text | JSON array of To recipient details (recordId, email, displayLabel, recipientType) |
| **Cc Recipients Metadata JSON** | Text | JSON array of Cc recipient details |
| **Bcc Recipients Metadata JSON** | Text | JSON array of Bcc recipient details |
| **Deliverability Warning** | Text | Warning about sender configuration (e.g. no Org-Wide address found) |

**Example: Branch on send result**

Add a **Decision** element after the Screen, with conditions:

- Branch `Sent Successfully`: `{!isSuccess} Equals true`  
- Branch `Send Failed`: `{!isSuccess} Equals false`

Use `{!errorMessage}` in a **Screen** element on the failure branch to display the error to the user.

---

### 3.8 Translate UI Labels (Translation Workbench)

Flow Email Composer supports localization of runtime UI labels through Salesforce **Custom Labels**.

**Where to translate:**

1. Go to **Setup \-\> Translation Workbench \-\> Translate**.  
2. Select your target **Language**.  
3. Set **Setup Component** to **Custom Labels**.  
4. Enter `FEC_Composer_` in the label filter/search.  
5. Provide translated values and save.

**Labels used by the component:**

- `FEC_Composer_CardTitle`  
- `FEC_Composer_From`  
- `FEC_Composer_SelectSender`  
- `FEC_Composer_To`  
- `FEC_Composer_Cc`  
- `FEC_Composer_Bcc`  
- `FEC_Composer_RecipientInputPlaceholder`  
- `FEC_Composer_Add`  
- `FEC_Composer_AddRecipient`  
- `FEC_Composer_AddCcRecipient`  
- `FEC_Composer_AddBccRecipient`  
- `FEC_Composer_Subject`  
- `FEC_Composer_Body`  
- `FEC_Composer_UploadFiles`  
- `FEC_Composer_Send`  
- `FEC_Composer_Attachments`  
- `FEC_Composer_Success`

**How Flow overrides interact with translations:**

- If `sendButtonLabel` is blank or `Send`, the translated `FEC_Composer_Send` value is shown.  
- If `sendButtonLabel` is set to another value, that Flow value is shown.  
- If `attachmentLabel` is blank or `Attachments`, the translated `FEC_Composer_Attachments` value is shown.  
- If `attachmentLabel` is set to another value, that Flow value is shown.

---

## 4\. For End Users: Composing and Sending Email

### 4.1 The Email Composer Screen

When you open a Flow that uses the Email Composer, you will see a form with these sections:  
![][image1]

Depending on how the administrator configured the component, some sections may not appear (for example, the Cc/Bcc fields or the attachment uploader may be hidden or pre-filled).

---

### 4.2 Adding Recipients

#### Searching for a contact

1. Click the **TO**, **CC**, or **BCC** field.  
2. Start typing a name or email address — a dropdown of matching Contacts, Leads, and Users appears after a short delay.  
3. Click a result to add it as a recipient pill.

#### Typing an email address directly

1. Type a valid email address in the recipient field.  
2. Press **Enter**, **comma (,)**, or **semicolon (;)** to confirm it as a pill.  
3. You can also paste several addresses separated by commas or semicolons.

#### Removing a recipient

Click the **×** on any recipient pill to remove it.

#### Duplicate prevention

If you add the same email address twice (or the same person from different searches), it will only appear once.

---

### 4.3 Choosing a Sender (FROM)

The FROM dropdown shows the sender addresses available to you:

| Option | When it appears |
| :---- | :---- |
| **Current User ([your@email.com](mailto:your@email.com))** | Always (unless disabled by admin) |
| **Org-Wide: Name ([address@company.com](mailto:address@company.com))** | When your org has verified Org-Wide Email Addresses |
| **Email-to-Case ([support@company.com](mailto:support@company.com))** | When the flow is linked to a Case with Email-to-Case configured |

Select the address you want the email to appear to come from. If the administrator has locked the FROM field, you will not be able to change it.

**Tip:** If you are replying to a customer case and want the reply to come from your support address (not your personal email), select the **Email-to-Case** option.

---

### 4.4 Writing the Subject and Body

- Click the **Subject** field and type your subject line.  
- Click in the **Body** editor to write your message. The toolbar provides standard formatting: bold, italic, lists, links, and more.

If the administrator pre-loaded a template, the subject and body will already be filled in. You can freely edit them — your changes will not be overwritten.

---

### 4.5 Pasting Images into the Body

You can paste images directly into the body editor:

1. Copy an image to your clipboard (e.g. a screenshot, or copy from another document).  
2. Click inside the body editor.  
3. Press **Ctrl+V** (Windows) or **Cmd+V** (Mac).

The image is automatically uploaded to Salesforce and embedded in the email. It is also saved as a file linked to the record the email is being sent from.

**Note:** Pasting images requires that a relate-to record (such as a Case) has been configured for the component. If no record is linked, image paste will show an error.

---

### 4.6 Attaching Files

If the attachment section is visible:

1. Click **Upload Files** or drag files onto the upload area.  
2. Uploaded files appear as a list with file names.  
3. To remove a file, click the **×** next to it.  
4. The component shows how many files are attached vs. the maximum allowed (e.g. `2/5 files selected`).

Files are sent as standard email attachments and are also saved as Salesforce Files linked to the related record.

---

### 4.7 Sending the Email

1. Review the recipient list, subject, and body.  
2. Click the **Send** button (or whatever label the admin configured).

**If the send succeeds:**

- The button briefly shows a loading indicator.  
- The flow advances to the next screen (or closes if it is the last step).

**If the send fails:**

- An error message appears on screen explaining what went wrong.  
- No email is delivered. You can correct the issue and try again.

**Common reasons a send can fail:**

- No To recipient added  
- Subject is empty (if required by admin)  
- Body is empty (if required by admin)  
- Invalid email address format  
- Attachment exceeds size limits  
- Selected Org-Wide sender address is no longer available

---

## 5\. Email Templates

If the administrator set a default template, the subject and body are pre-filled when the screen opens. Template merge fields (such as `{!Case.CaseNumber}`) are resolved against the linked record automatically.

**What you can do with a pre-filled template:**

- Edit the subject or body freely — your changes are preserved.  
- Delete pre-filled content and write something entirely different.  
- Send without editing if the template content is suitable as-is.

**What you cannot do:**

- Change which template was loaded (this is controlled by the administrator in Flow Builder).  
- Re-apply the template after you have edited the body — the original template content is not re-loaded after you type in the field.

---

## 6\. Email-to-Case Replies

When a flow is configured for Email-to-Case threading (typically on Case records):

**What this means for you:**

- You do not need to do anything differently — just compose and send as normal.  
- Your outbound email contains a hidden reference code that is invisible to the recipient.  
- When the customer **replies** to your email, their reply automatically appears under the **same Case** in Salesforce, rather than creating a new Case.

**Requirements for threading to work:**

- The email must be sent from the component when `Add Email to Case Thread` is enabled on that flow.  
- The relate-to record must be a **Case**.  
- The customer must reply to the original email (not send a new email).

**If a reply still creates a new Case:**

- The customer may have composed a brand-new email instead of hitting Reply.  
- The outbound email may have been sent from a component that did not have threading enabled.  
- Contact your administrator to verify the threading feature flag is active.

---

## 7\. Viewing Send History

Every email sent through Flow Email Composer is recorded in the **Email Send Log** (`Email_Send_Log__c`) object.

**To view send logs (Admin):**

1. Go to the **App Launcher** and open your app.  
2. Navigate to the **Email Send Log** tab (if added to the app), or use the **Object Manager** to view records directly.

**Fields in the log:**

| Field | Description |
| :---- | :---- |
| Status | `Success`, `Failed`, or `ValidationFailed` |
| Sent At | Date and time of the send attempt |
| Subject | Email subject |
| From Address | Address used as the sender |
| Sender Type | `User`, `OrgWide`, or `EmailToCase` |
| To / Cc / Bcc Count | Number of recipients in each field |
| Relate To ID | The Salesforce record the email was linked to |
| Email Message ID | Link to the `EmailMessage` record |
| Message Identifier | RFC 5322 Message-ID header |
| Attachment Count | Number of files attached |
| Total Attachment Size | Total size of attachments in bytes |
| Error Message | Failure or warning message |
| Error Code | Salesforce error code (for technical investigation) |
| Add Email to Case Thread | Whether threading was enabled for this send |

**Note:** Users with the `FEC_Composer_User` permission set can only **read** log records. Users with `FEC_Admin` can read and edit. Users with `FEC_Support` can read logs but have no Apex access.

---

## 8\. Troubleshooting

### "At least one To recipient is required"

You tried to send without adding anyone to the To field. Add at least one email address or select a contact.

---

### "Invalid email address: …"

One of the entered addresses is not in a valid email format. Check for:

- Missing `@` symbol  
- Spaces within the address  
- Incomplete domain (e.g. `user@` with no domain)

---

### "Subject is required" / "Body is required"

The administrator has made subject or body mandatory for this flow. Fill in the field before sending.

---

### "Selected sender type is not allowed by component configuration"

The FROM address you selected is of a type that has been disabled by the administrator. Choose a different FROM address, or contact your administrator.

---

### "OrgWide sender type requires an OrgWideEmailAddressId" / "Selected Org-Wide Email Address was not found"

The Org-Wide Email Address selected as FROM is no longer available or has been deleted. Select a different sender, or contact your administrator to restore the address in **Setup → Org-Wide Email Addresses**.

---

### "Email-to-Case threading is disabled by feature flag"

The threading feature is turned off at the system level. Contact your Salesforce administrator to enable it: **Setup → Custom Metadata Types → Feature Flag → Enable Threading → enable the Enabled checkbox**.

---

### "Email-to-Case threading can only be used when RelateToRecordId is a Case"

Threading is enabled on this flow, but the flow was launched from a record that is not a Case (e.g. an Account or Opportunity). Either disable threading for this flow or only launch the flow from Case records.

---

### "There was a problem uploading the file" (image paste)

Image paste requires a relate-to record to be set. If the flow was launched without a record context, pasted images cannot be saved. Contact your administrator to ensure the flow passes a valid record Id to the **Relate To Record ID** property.

---

### "Unable to send email. Contact your administrator if the issue persists."

This is a generic error for unexpected platform-level failures. Salesforce may be experiencing deliverability issues, or there may be a Send Email governor limit reached. Check:

1. **Setup → Deliverability** — ensure the org's email deliverability is set to **All Email**.  
2. The `Email_Send_Log__c` record for the failed send — the `Error Message` and `Error Code` fields contain technical details.  
3. Salesforce's daily single email send limits (per-user and org-wide limits apply).

---

### Warning: "No Org-Wide sender is configured…"

This is an informational warning, not an error. It appears when Org-Wide senders are included in the allowed types but no Org-Wide Email Addresses exist in your org (or are accessible to the running user). You can still send using your **Current User** address.

---

### Deliverability: Email arrives from wrong address

If the email arrives in the recipient's inbox from your personal address instead of the support address you selected:

- The selected Email-to-Case address is not registered as a verified **Org-Wide Email Address** in Salesforce.  
- Ask your administrator to add the Email-to-Case routing address to **Setup → Org-Wide Email Addresses** and verify it.

---

## 9\. Reference: Component Properties

Quick reference of all available properties for Flow Builder configuration.

| Property | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| `recordId` | Record ID | — | Flow record context (auto-set by Flow) |
| `relateToRecordId` | Record ID | — | Explicit relate-to override |
| `addEmailToCaseThread` | Boolean | `false` | Enable Email-to-Case threading |
| `defaultToEmails` | Text Collection | `[]` | Pre-populated To addresses |
| `defaultCcEmails` | Text Collection | `[]` | Pre-populated Cc addresses |
| `defaultBccEmails` | Text Collection | `[]` | Pre-populated Bcc addresses |
| `subjectDefault` | Text | `''` | Default subject text |
| `bodyDefault` | Text | `''` | Default body HTML |
| `defaultEmailTemplateId` | Text | `''` | Template Id, DeveloperName, or Name |
| `sendButtonLabel` | Text | `'Send'` | Send button label override; blank/`'Send'` uses translated `FEC_Composer_Send` |
| `sendButtonAlignment` | Text | `'left'` | `left` / `center` / `right` |
| `requireSubject` | Boolean | `false` | Require non-empty subject |
| `requireBody` | Boolean | `false` | Require non-empty body |
| `enableFileAttachments` | Boolean | `false` | Show file attachment uploader |
| `attachmentLabel` | Text | `'Attachments'` | Attachment heading override; blank/`'Attachments'` uses translated `FEC_Composer_Attachments` |
| `acceptedFileTypes` | Text | (extension list) | Accepted file formats |
| `maxAttachmentCount` | Number | `5` | Max files (1–25) |
| `defaultContentDocumentIdCollection` | ID Collection | `[]` | Pre-attached file record Ids |
| `allowCurrentUserSender` | Boolean | `true` | Show current user in FROM |
| `allowOrgWideSender` | Boolean | `true` | Show Org-Wide addresses in FROM |
| `allowEmailToCaseSender` | Boolean | `true` | Show Email-to-Case addresses in FROM |
| `defaultFromEmail` | Text | `''` | Pre-select FROM by email address |
| `defaultFromReadOnly` | Boolean | `false` | Lock the FROM field |
| **Output** |  |  |  |
| `isSuccess` | Boolean | — | `true` after successful send |
| `errorMessage` | Text | — | Error text if send fails |
| `emailMessageId` | Record ID | — | Created `EmailMessage` record Id |
| `messageIdentifier` | Text | — | RFC 5322 Message-ID |
| `toRecipientsMetadataJson` | Text | — | JSON of To recipients |
| `ccRecipientsMetadataJson` | Text | — | JSON of Cc recipients |
| `bccRecipientsMetadataJson` | Text | — | JSON of Bcc recipients |
| `deliverabilityWarning` | Text | — | Warning about sender configuration |

[image1]: <data:image/png;base64,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uyUb0gAAALoZIQ0AACBBhDQAAIAEEdIAAAASREgDAABIECENAAAgQYQ0AACABBHSAAAAEpRkSFu5cqW75pprMmvu3Lnx6AAAAL1OkiHtwoUL7tixY76GDx/ufwHYHp8/fz4eHQAAoNdJMqSFnnvuOTdo0KAez7333nvulltucddee6174IEH3KFDh3oMBwAA6HQdF9I2b97sL3u+9tprbsOGDe7uu+92t99+e/AKAACAztdxIW3ChAnu/vvvLz0+cOCAD21HjhwpPQcAANDpOi6kDRw40I0aNSoYw/mQtnr16h7PAQAAdLKOC2ljxoxxf/rTn0qPjx8/7kPa/v37S88BAAB0uo4LaStWrPChbNmyZe7EiRNu6NChrm/fvsErAAAAOl/yIW306NFu8ODBPZ6bMmWKu+6663xYu/nmm92OHTt6DAcAAOh0yYe0ci5fvuxOnToVPw0AANArdGxIAwAA6M0IaQAAAAkipAEAACSIkAYAAJAgQhoAAECCCGkAAAAJSjak7dmzx02aNMn179/fPfjggxRFURRFNal0rtU5V+depCPJkKadRDvM0qVL/e+hAQCA5tG5VudcnXuLBrXe2JmSWlhNMqRpBWlnAQAAraNzr87BeXprZ0otYbWZkgxpWjm9aaMDANAJdO7VOThPb+9MKRpWmy3JkKYuRwAA0HpFzsG9vTOlaFhtNkIaAAAoKXIOLjJOp0thGQlpAACgpMg5uMg4nS6FZSSkAQCAkiLn4CLjdLoUlpGQBgAASoqcg4uM0+lSWEZCGgAAKClyDi4yTqdLYRkJaQAAoKTIObjIOJ0uhWXsNSHt1KlTbu3atZm1fv36ePSO9vXXX7sRI0a4L774wj9+++23k9hurTJmzJiqf2Rw7969buHChW7JkiXuq6++igf3Ops2bXJHjhyJn264N954w61evTp+uiqHDx92n332Wfy0O3HihFu3bl38NIAmK3IOLjJOp0thGXtNSNu1a5f705/+5GvAgAF+GvZ48ODB8egdTSFt+PDhbvv27f7xqFGj3F//+tdorN5L23bz5s3x05n0WzejR4/2rxkyZIh75JFH/N/vvfdePGpNTp486Z5++ml36NCheFDVGjkt7feffPJJ/HTDPfHEE27BggXx01VZvHhx5nt048aNflv15t9iAlJU5BxcZJxqrNl72o1fln/sO3fxsvtv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0mgEjjtUtxbHnavacdypJNmQBqC43hguqj1pAGgtjjvNR0gDAABIECENAAAgQYQ0AACABBHSAAAAEkRIAwAASBAhDQAAIEGENAAAgAQR0gAAABJESAMAAEgQIQ0AACBBvSakHThwwJ08eTJ+uqzDhw+7lStXxk97586dc++99567cOFCPAgAAKAlkg9pF0+cdIfmvu92P/ei/zv28ccfu+uuu85dc801vvr16+e++uqreLRvWbx4sbvxxhvjp72tW7f6ae3atSseVJXJkyf78AgAAFCt5EPa+hv7uUX/4t/4+vt//Ym7dPZcadj58+fdtdde66ZNm+b/53r1pP3+nt/7/yA1T6WQJppevRT0NmzYED8NAACQK/mQduDNd0shbffzE93l4BLk3r17fRDasWNH6Tldxly3bp3/e86cOW7w4MGlYatWrXK33367/9tC2siRI33Qu/nmm/1zcuTIEXf99de706dP+8fbtm1zd911lx/v7rvvdrt37y5N84MPPnC33nqrH6aAaD1nffv29fOmXr7nn3++ND4AAEARyYe0XSPGuF0jx7ltA4a4HY+N6BHSROFKgei1115zO3fu7DFs5syZPlSZZcuWuRtuuMH/rUCmEKVet40bN/ogpce6VHrw4EH/96lTp3xQ02v+8pe/+PEGDRrk25TNmzf78aZPn+6DoYKcShQcNWz+/Pnu0KFDpXkAAAAoIvmQJqc++9wdW7oiftpTABo+fLjvyVIouu2223zPlxQJaQpi5qabbvK9b2FIW716tf9bl1L1WD1lFuYmTJjg7r333tLr1QO3aNGi0mMudwIAgFp1REgrQveQ6XKmLj3avWZ5Ic3+NupVGzNmTI+Q9uabb/q/41qxYoUbOHCgGzVqVI9phAhpAACgVh0d0rZv3+6DWGjJkiU+HF26dMm9/vrrPrQZ3T8W96SFP7OhXrjZs2f3CGkKdro/LcvYsWPdgAEDSo/1RYbwG6Gaxvr160uPAQAAiurokLZv3z4fhNTbpd82O3bsmO8N089wyPLly/1w3S92/Phx99vf/vZbIU1fHNClTF3m1GMFvzCkaZq6lDp16lR35swZt3TpUn8PnC5tqudO4+lnQE6cOOGGDh3qg55RuNPPcPB7awAAoFodHdLk3XffLd2PptJ9ZfZtT4WjBx54oDTsoYce6hHSFLYefPBBP0zTUM+b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AJor6ZC2fft2H65mzpzp7rjjjh7D9J+f9uvXz4edwYMHu9/+9relkHb58mX35JNPuuuuu8717dvXTZgwoWJIK9fOI4884qevYXp+1qxZ/m89d/311/uQpbr//vv98zfccIN7/fXXS68/deqUGzRokB+m+bBhFtI0X5qO6q233vLDDh486B/bPN90002+5+uuu+7yr9F8hL1948eP9+1q+q+88krp+V//+tfuhRdecDfeeKMfbkEzaxkOHDjgQ66e03QWLVpUmg4AAGiPpEPa888/70OOQokCxL59+/zzCj8KYI8++qjbuHGj+8tf/uKHW0ibMmWKDyJLlizx96Jp3EohrVw7+vf22293I0aMcLt37/bD9bee++KLL9ylS5fc008/7e688063adMmH/L0egUt0f8Bdtttt/lA+de//tUPU+CykKZgpPkfNWqUf6zlUpv6W/OzefPmUjh79dVX/bgKUfp/xeSNN97wy7Z8+XJ/j5uW0QKWBTf9R7FvvvlmabmylkHrUT1ruqdP7WiaFy5c8NMBAADtkWxIU2+YgoaFDoUV6ylauXKlDyQWJBQ0FCwspKm3aerUqf5vUZgpF9IqtSNFL3dqXtQrpTC0YsUK/1h/K7yZTz/91O3YsaMU0hTC5PTp0/6xQpiFtP379/thundM82cUCocOHer/Vm+ZApvCnWrYsGHu4Ycf9sP0GgVDox45exwvg8KklrvcFy8AAEDrJRvS1OOksHLfffe5hx56yP+tEvUM3XrrrT3GVzCzkKbApl40o3BULqRVakfyQpoCmS4p6jV2GVHrcOfOnf5vBbBY1j1pmmf1ellIO3v2rH9+4cKF/n45M3r0aN/zJTavYSmMiUJa+I3W8J69eBkUHBX49Hoty7x580rDAABAeyQb0oYPH+5Dw/Tp033pkqQe6xKdXcIMKZRYCNElRt17Zd59992yIa1SO6IwM3ny5NL4CjgKPEbtPvfcc74nS71yakfrUCFL09H9bkb3funnQBoV0nRP3jvvvFMaFsoLaeEyGM2P7nFT+5pXAADQPkmGNP2OmEJLfAO77v0aO3asO3r0qA9DutSnwKNLmwoWFkIUZBRSdu3a5S/h6d6srJCW147o8uEDDzzgQ5jokqFuuLcQo9drPs6dO+dmzJjh58PWob7McO+997ojR464DRs2+HlYunRpw0LauHHjfM+X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>