import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { PrdDocumentData } from "@repo/services/shipflow/prd-document";

// Restrained, professional palette — near-monochrome with a single brand accent.
const INK = "#1c1917";
const BODY = "#3f3f46";
const SUB = "#78716c";
const RULE = "#e7e5e4";
const ACCENT = "#c2410c"; // brand orange, used sparingly

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 52,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: BODY,
  },
  topBar: { height: 3, backgroundColor: ACCENT, marginBottom: 22 },
  eyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.6,
    color: ACCENT,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: INK,
    lineHeight: 1.2,
  },
  metaLine: { marginTop: 8, fontSize: 9, color: SUB },
  metaLineStrong: { color: BODY },
  headerRule: { borderBottomWidth: 1, borderBottomColor: RULE, marginTop: 18 },

  metaRow: { flexDirection: "row", marginTop: 18, marginBottom: 4 },
  metaCell: { flexGrow: 1, flexBasis: 0, paddingRight: 10 },
  metaLabel: {
    fontSize: 7,
    letterSpacing: 0.8,
    color: SUB,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  metaValue: { fontFamily: "Helvetica-Bold", fontSize: 10, color: INK },

  section: { marginTop: 22 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: INK },
  sectionAudience: {
    marginLeft: 8,
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: SUB,
    textTransform: "uppercase",
  },
  sectionSubtitle: { fontSize: 9, color: SUB, marginTop: -4, marginBottom: 8 },

  overview: {
    marginTop: 8,
    padding: 14,
    backgroundColor: "#fafaf9",
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    fontSize: 10.5,
    color: BODY,
  },

  row: { flexDirection: "row", marginBottom: 5, paddingRight: 4 },
  marker: { width: 16, color: SUB, fontSize: 10 },
  markerAccent: { width: 16, color: ACCENT, fontFamily: "Helvetica-Bold", fontSize: 10 },
  itemText: { flexGrow: 1, flexBasis: 0, color: BODY },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 52,
    right: 52,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: RULE,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: SUB,
  },
});

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ListSection({
  title,
  subtitle,
  audience,
  items,
  variant = "bullet",
}: {
  title: string;
  subtitle?: string;
  audience?: string;
  items: string[];
  variant?: "bullet" | "numbered";
}) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.section} wrap={false}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {audience ? <Text style={styles.sectionAudience}>For {audience}</Text> : null}
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={variant === "numbered" ? styles.markerAccent : styles.marker}>
            {variant === "numbered" ? `${i + 1}.` : "•"}
          </Text>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function PrdPdfDocument({ data }: { data: PrdDocumentData }) {
  const approved = Boolean(data.approvedAt);
  const meta: { label: string; value: string }[] = [
    { label: "Version", value: `v${data.version}` },
    { label: "Status", value: approved ? "Approved" : data.status.replace(/_/g, " ") },
    { label: "Priority", value: data.priority },
    { label: "Est. effort", value: data.estimatedTotalHours ? `~${data.estimatedTotalHours}h` : "—" },
    { label: "Target date", value: fmtDate(data.targetDeadline) },
  ];

  return (
    <Document
      title={`PRD — ${data.featureTitle}`}
      author={data.createdByName ?? "VelocityAI"}
      creator="VelocityAI"
      producer="VelocityAI"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />

        <Text style={styles.eyebrow}>Product Requirements Document</Text>
        <Text style={styles.title}>{data.featureTitle}</Text>
        <Text style={styles.metaLine}>
          {data.orgName ? `${data.orgName}  ·  ` : ""}Created by{" "}
          <Text style={styles.metaLineStrong}>{data.createdByName ?? "Unknown"}</Text> on {fmtDate(data.createdAt)}
          {approved ? `  ·  Approved ${fmtDate(data.approvedAt)}` : ""}
        </Text>
        <View style={styles.headerRule} />

        <View style={styles.metaRow}>
          {meta.map((m) => (
            <View key={m.label} style={styles.metaCell}>
              <Text style={styles.metaLabel}>{m.label}</Text>
              <Text style={styles.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section} wrap={false}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Overview &amp; Problem</Text>
          </View>
          <Text style={styles.overview}>{data.problem}</Text>
        </View>

        <ListSection title="Goals" subtitle="What this feature must achieve." audience="Managers" items={data.goals} />
        <ListSection title="Non-Goals" subtitle="Explicitly out of scope." audience="Managers" items={data.nonGoals} />
        <ListSection title="User Stories" subtitle="Who benefits and how." audience="Everyone" items={data.userStories} variant="numbered" />
        <ListSection title="Success Metrics" subtitle="How we know it worked." audience="Managers" items={data.successMetrics} />
        <ListSection title="Technical Requirements" audience="Developers" items={data.technicalRequirements} />
        <ListSection title="Acceptance Criteria" subtitle="Must all pass before shipping." audience="Developers" items={data.acceptanceCriteria} />
        <ListSection title="Dependencies" audience="Developers" items={data.dependencies} />
        <ListSection title="Edge Cases" audience="Developers" items={data.edgeCases} />
        <ListSection title="Risks & Mitigations" audience="Everyone" items={data.risks} />

        <View style={styles.footer} fixed>
          <Text>{data.featureTitle} · v{data.version}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          <Text>VelocityAI</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPrdPdf(data: PrdDocumentData): Promise<Buffer> {
  return renderToBuffer(<PrdPdfDocument data={data} />);
}
