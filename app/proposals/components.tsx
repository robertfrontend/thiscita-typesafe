import { sourceBadge } from "../components/ui";
import type { ProposalCopy } from "./content";
import type {
  FindingStatus,
  ProposalAnalysis,
  ProposalChange,
  ProposalDimensionId,
  ProposalFinding,
  ProposalResponse,
} from "./types";
import { proposalDimensionIds } from "./types";

const acceptedDocuments =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

type UploadSlotProps = {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  disabled?: boolean;
  t: ProposalCopy;
  onSelect: (file: File) => void;
  onRemove?: () => void;
};

export function UploadSlot({
  id,
  label,
  hint,
  file,
  disabled = false,
  t,
  onSelect,
  onRemove,
}: UploadSlotProps) {
  return (
    <section
      className={`grid min-h-[210px] grid-rows-[auto_1fr_auto] border-2 border-ink bg-[#f6f4ef] ${disabled ? "opacity-45" : ""}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-ink px-3 py-2.5">
        <div>
          <h2 className="text-sm font-bold">{label}</h2>
          <p className="mt-0.5 text-[11px] text-[#626a66]">{hint}</p>
        </div>
        {file && onRemove && (
          <button
            className="font-mono text-[10px] underline"
            type="button"
            onClick={onRemove}
          >
            {t.remove}
          </button>
        )}
      </header>
      <label
        className={`m-3 grid place-content-center place-items-center border-2 border-dashed border-ink p-5 text-center ${disabled ? "cursor-not-allowed bg-[#e3e1db]" : "cursor-pointer bg-[#eeece6] hover:bg-[#ffe5d0]"}`}
        htmlFor={id}
      >
        <input
          className="sr-only"
          id={id}
          type="file"
          accept={acceptedDocuments}
          disabled={disabled}
          onClick={(event) => {
            event.currentTarget.value = "";
          }}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) onSelect(selected);
          }}
        />
        <span
          className={`mb-2 grid size-10 place-items-center border-2 border-ink text-xl ${file ? "bg-[#c9d9d3]" : "bg-safety"}`}
          aria-hidden="true"
        >
          {file ? "✓" : "↥"}
        </span>
        <strong className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm">
          {file?.name ?? t.choose}
        </strong>
        <small className="mt-1.5 font-mono text-[9px] text-[#68716d]">
          {file
            ? `${Math.max(1, Math.ceil(file.size / 1024))} KB · ${t.change}`
            : t.formats}
        </small>
      </label>
      <span className="border-t border-ink px-3 py-2 font-mono text-[9px] text-[#626a66]">
        {file ? file.type || "document" : hint}
      </span>
    </section>
  );
}

function statusVisual(status: FindingStatus | "standby", t: ProposalCopy) {
  return {
    standby: {
      card: "bg-[#e8e7e2] text-[#626762]",
      dot: "bg-[#92958f]",
      label: t.standby,
    },
    clear: {
      card: "bg-[#dce9df] text-[#28543b]",
      dot: "bg-[#3f7657]",
      label: t.clear,
    },
    missing: {
      card: "bg-[#f5e6ae] text-[#694f0c]",
      dot: "bg-[#b67b00]",
      label: t.missing,
    },
    review: {
      card: "bg-[#ffe0cd] text-[#71381f]",
      dot: "bg-accent",
      label: t.needsReview,
    },
  }[status];
}

function Evidence({
  finding,
  t,
}: {
  finding: ProposalFinding;
  t: ProposalCopy;
}) {
  return (
    <details className="col-span-full mt-1 border-t border-current/30 pt-2">
      <summary className="cursor-pointer font-mono text-[10px] font-bold">
        {t.viewEvidence}
      </summary>
      <p className="mt-2 border-l-2 border-current pl-2.5 text-[11px] leading-[1.45]">
        {finding.evidence ? `“${finding.evidence.text}”` : t.noEvidence}
      </p>
    </details>
  );
}

function Summary({
  analysis,
  t,
}: {
  analysis: ProposalAnalysis;
  t: ProposalCopy;
}) {
  return (
    <details className="border border-ink bg-[#f5f2eb]">
      <summary className="cursor-pointer px-3 py-2.5 font-mono text-[10px] font-bold">
        {t.summary} · {analysis.fileName}
      </summary>
      <div className="border-t border-ink px-3 py-2.5">
        <small className="text-[10px] text-[#71817f]">{t.summaryNote}</small>
        <ul className="mt-1.5 grid list-disc gap-1.5 pl-4 text-[11px] leading-[1.4] text-[#526963]">
          {analysis.summary.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function ScoreBlock({
  response,
  t,
}: {
  response: ProposalResponse;
  t: ProposalCopy;
}) {
  if (response.mode === "single")
    return (
      <div className="grid min-w-[170px] border-2 border-ink bg-safety px-3 py-2 text-right">
        <small className="font-mono text-[9px]">{t.readiness}</small>
        <strong className="text-[32px] leading-none">
          {response.analysis.readinessScore}
          <span className="text-sm">/100</span>
        </strong>
      </div>
    );

  const deltaLabel =
    response.readinessDelta > 0
      ? `+${response.readinessDelta}`
      : String(response.readinessDelta);
  return (
    <div className="grid min-w-[250px] border-2 border-ink bg-safety px-3 py-2 text-right">
      <small className="font-mono text-[9px]">{t.improvement}</small>
      <div className="flex items-baseline justify-end gap-2 leading-none">
        <span className="text-xl">{response.baseline.readinessScore}</span>
        <span aria-hidden="true">→</span>
        <strong className="text-[32px]">
          {response.revision.readinessScore}
        </strong>
        <span className="border border-ink bg-[#fff7d8] px-1.5 py-1 font-mono text-[10px]">
          {deltaLabel}
        </span>
      </div>
    </div>
  );
}

function SingleFinding({
  id,
  analysis,
  t,
}: {
  id: ProposalDimensionId;
  analysis: ProposalAnalysis | null;
  t: ProposalCopy;
}) {
  const finding = analysis?.findings.find((item) => item.id === id);
  const visual = statusVisual(finding?.status ?? "standby", t);
  const detail = t.checks[id];
  return (
    <article
      className={`grid grid-cols-[1fr_auto] gap-2 border border-ink p-3 ${visual.card}`}
    >
      <div className="flex items-center gap-2">
        <span className={`size-2 ${visual.dot}`} aria-hidden="true" />
        <strong className="text-[13px]">{detail[0]}</strong>
      </div>
      <div className="text-right">
        <span className="block font-mono text-[10px] font-bold">
          {visual.label}
        </span>
        {finding && (
          <strong className="font-mono text-xs">{finding.score}/100</strong>
        )}
      </div>
      {finding && finding.status !== "clear" && (
        <p className="col-span-full text-xs leading-[1.4]">{detail[1]}</p>
      )}
      {finding && <Evidence finding={finding} t={t} />}
    </article>
  );
}

function changeVisual(change: ProposalChange, t: ProposalCopy) {
  return {
    unchanged: { className: "bg-[#e8e7e2]", label: t.changes.unchanged },
    added: { className: "bg-[#dce9df]", label: t.changes.added },
    removed: { className: "bg-[#f2c4b0]", label: t.changes.removed },
    modified: { className: "bg-[#f5e6ae]", label: t.changes.modified },
    unclear: { className: "bg-[#ddd8cf]", label: t.changes.unclear },
  }[change.type];
}

function FindingSnapshot({
  finding,
  label,
  t,
}: {
  finding: ProposalFinding;
  label: string;
  t: ProposalCopy;
}) {
  const visual = statusVisual(finding.status, t);
  return (
    <div className={`border border-ink p-2.5 ${visual.card}`}>
      <small className="font-mono text-[9px]">{label}</small>
      <div className="mt-1 flex items-end justify-between gap-2">
        <strong className="text-xs">{visual.label}</strong>
        <b className="font-mono text-sm">{finding.score}</b>
      </div>
      <Evidence finding={finding} t={t} />
    </div>
  );
}

function ComparisonFinding({
  id,
  baseline,
  revision,
  change,
  t,
}: {
  id: ProposalDimensionId;
  baseline: ProposalAnalysis;
  revision: ProposalAnalysis;
  change: ProposalChange;
  t: ProposalCopy;
}) {
  const before = baseline.findings.find((finding) => finding.id === id)!;
  const after = revision.findings.find((finding) => finding.id === id)!;
  const changeStyle = changeVisual(change, t);
  return (
    <article className="border-2 border-ink bg-[#f5f2eb]">
      <header className="flex items-center justify-between gap-3 border-b border-ink px-3 py-2.5">
        <div>
          <strong className="text-sm">{t.checks[id][0]}</strong>
          <p className="mt-0.5 text-[10px] text-[#626a66]">{t.checks[id][1]}</p>
        </div>
        <span
          className={`border border-ink px-2 py-1 font-mono text-[9px] font-bold ${changeStyle.className}`}
        >
          {changeStyle.label}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 p-2 max-sm:grid-cols-1">
        <FindingSnapshot finding={before} label={t.original} t={t} />
        <FindingSnapshot finding={after} label={t.revision} t={t} />
      </div>
    </article>
  );
}

export function ReviewResults({
  response,
  loading,
  t,
}: {
  response: ProposalResponse | null;
  loading: boolean;
  t: ProposalCopy;
}) {
  const activeAnalysis =
    response?.mode === "single"
      ? response.analysis
      : response?.mode === "comparison"
        ? response.revision
        : null;
  return (
    <section
      className="mx-auto mt-8 max-w-[1120px] border-2 border-ink bg-[#deddd7] p-5 shadow-safety max-md:p-4 max-md:shadow-safety-sm"
      aria-live="polite"
      aria-busy={loading}
    >
      <header className="mb-5 flex items-start justify-between gap-5 border-b-2 border-ink pb-4 max-sm:flex-col">
        <div>
          <p className="mb-1 font-mono text-[10px] font-bold">{t.result}</p>
          <h2 className="text-[28px] leading-none tracking-[-.045em]">
            {loading
              ? t.analyzing
              : activeAnalysis
                ? activeAnalysis.overallStatus === "review"
                  ? t.review
                  : t.ready
                : t.waiting}
          </h2>
          {response && (
            <span
              className={`${sourceBadge} mt-2 inline-block ${response.source === "typesafe" ? "bg-safety" : "bg-[#d6d5cf]"}`}
            >
              {response.source === "typesafe" ? t.live : t.demo} ·{" "}
              {response.responseLatencyMs} ms
            </span>
          )}
        </div>
        {response && <ScoreBlock response={response} t={t} />}
      </header>

      {response && (
        <div className="mb-4 grid gap-2 md:grid-cols-2">
          <Summary
            analysis={
              response.mode === "single" ? response.analysis : response.baseline
            }
            t={t}
          />
          {response.mode === "comparison" && (
            <Summary analysis={response.revision} t={t} />
          )}
        </div>
      )}

      {response?.mode === "comparison" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {proposalDimensionIds.map((id) => (
            <ComparisonFinding
              id={id}
              baseline={response.baseline}
              revision={response.revision}
              change={response.changes.find((change) => change.id === id)!}
              t={t}
              key={id}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {proposalDimensionIds.map((id) => (
            <SingleFinding
              id={id}
              analysis={response?.analysis ?? null}
              t={t}
              key={id}
            />
          ))}
        </div>
      )}

      <p className="mt-4 font-mono text-[10px] leading-[1.45] text-[#565d59]">
        {t.legal}
      </p>
    </section>
  );
}
