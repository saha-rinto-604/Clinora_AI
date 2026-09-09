import { useMemo } from 'react';
import type { PatientReportAiClinicalCluster, PatientReportAiClusterEvidence } from './patient-report-ai-types';
import type { PatientReportObservation } from './patient-report-extraction-types';
import {
  formatObservationValue,
  formatReference,
  rangeStateLabel,
} from './patient-report-observation-presentation';
import { patientObservationRangeState } from './patient-report-range-state';

export function PatientReportClinicalClusters({
  clusters,
  observations,
}: {
  clusters: PatientReportAiClinicalCluster[];
  observations: PatientReportObservation[];
}) {
  const observationMap = useMemo(
    () => new Map(observations.map((observation) => [observation.id, observation])),
    [observations],
  );

  return (
    <div className="space-y-5">
      {clusters.map((cluster, index) => (
        <article
          key={`${(cluster.displayTitle || cluster.title)}-${index}`}
          aria-label={`Clinical finding ${index + 1}: ${(cluster.displayTitle || cluster.title)}`}
          className="overflow-hidden rounded-[22px] border border-cyan-300/20 bg-[var(--clinora-surface-raised)]"
        >
          <div className="border-b border-white/[0.07] bg-cyan-300/[0.045] p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-cyan-200">
              {cluster.candidates.length ? 'Clinical interpretation' : 'Related findings'}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">{(cluster.displayTitle || cluster.title)}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{cluster.interpretation}</p>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            {cluster.candidates.length ? cluster.candidates.map((candidate, candidateIndex) => (
              <section key={`${candidate.name}-${candidateIndex}`} aria-label={`Possible condition: ${candidate.name}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-200">Possible condition</p>
                <h4 className="mt-2 text-lg font-semibold text-white">{candidate.name}</h4>
                <h5 className="mt-4 text-sm font-semibold text-white">Why this may fit</h5>
                <p className="mt-2 text-sm leading-7 text-slate-300">{candidate.rationale}</p>
                <ClusterEvidence
                  title="Verified support"
                  evidence={cluster.evidence.filter((item) => candidate.supportingObservationIds.includes(item.observationId))}
                  observationMap={observationMap}
                />
                <ClusterEvidence
                  title="What does not fully match"
                  evidence={cluster.evidence.filter((item) => candidate.contradictoryObservationIds.includes(item.observationId))}
                  observationMap={observationMap}
                />
                <ClinicalContextList title="What information is still missing" items={candidate.missingEvidence} />
                <ClinicalContextList title="Other possibilities" items={candidate.alternatives} />
              </section>
            )) : (
              <p className="text-sm leading-6 text-slate-300">
                These findings can be considered together, but the available evidence does not justify a specific condition name.
              </p>
            )}

            <ClusterEvidence
              title={cluster.candidates.length ? 'Additional verified findings' : 'Verified support'}
              evidence={cluster.evidence.filter((item) => item.role === 'SUPPORTS' && !cluster.candidates.some(
                (candidate) => candidate.supportingObservationIds.includes(item.observationId),
              ))}
              observationMap={observationMap}
            />
            <ClusterEvidence
              title="What does not fully match"
              evidence={cluster.evidence.filter((item) => item.role === 'CONTRADICTS' && !cluster.candidates.some(
                (candidate) => candidate.contradictoryObservationIds.includes(item.observationId),
              ))}
              observationMap={observationMap}
            />
            <ClusterEvidence
              title="Other verified context"
              evidence={cluster.evidence.filter((item) => item.role === 'CONTEXT')}
              observationMap={observationMap}
            />
            <ClinicalContextList title="What information is still missing" items={cluster.missingEvidence} />
            <ClinicalContextList title="Other possibilities" items={cluster.alternatives} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ClusterEvidence({
  title,
  evidence,
  observationMap,
}: {
  title: string;
  evidence: PatientReportAiClusterEvidence[];
  observationMap: Map<string, PatientReportObservation>;
}) {
  const grounded = evidence.flatMap((item) => {
    const observation = observationMap.get(item.observationId);
    return observation ? [{ ...item, observation }] : [];
  });
  if (!grounded.length) return null;

  return (
    <div className="mt-5">
      <h5 className="text-sm font-semibold text-white">{title}</h5>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {grounded.map(({ observation, clinicalRelevance, role }) => (
          <div key={`${observation.id}-${role}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white">{observation.label}</p>
              <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] font-semibold text-cyan-100">
                {rangeStateLabel(patientObservationRangeState(observation))}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{formatObservationValue(observation)}</p>
            <p className="mt-1 text-xs text-slate-400">Reference {formatReference(observation)}</p>
            {clinicalRelevance ? <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-slate-300">{clinicalRelevance}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClinicalContextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <h5 className="text-sm font-semibold text-white">{title}</h5>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}
