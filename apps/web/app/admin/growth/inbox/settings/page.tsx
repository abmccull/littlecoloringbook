import { listDmKeywordResponses } from "@littlecolorbook/db";
import { KeywordResponsesClient } from "../../../../../components/admin/keyword-responses-client";

export const dynamic = "force-dynamic";

export default async function InboxSettingsPage() {
  const rules = await listDmKeywordResponses();

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 4px" }}>Keyword Auto-Reply Rules</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>
          Rules are evaluated in creation order. First match wins. Platform filter: null = all platforms.
        </p>
      </div>
      <KeywordResponsesClient initialRules={rules} />
    </div>
  );
}
