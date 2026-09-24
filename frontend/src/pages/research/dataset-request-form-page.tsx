import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Lock,
  Save,
  Send,
  LoaderCircle,
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  Database,
  Filter,
  Eye,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  CatalogCategory,
  CohortFilterCriteria,
  CohortPreviewResponse,
  DatasetFormat,
  ObservationCondition,
  ResearchProject,
} from '../../features/research/research-types';

export function DatasetRequestFormPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ResearchProject | null>(null);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [previewResult, setPreviewResult] = useState<CohortPreviewResponse | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [selectedVariables, setSelectedVariables] = useState<string[]>(['AGE_BAND', 'HBA1C', 'FASTING_GLUCOSE']);
  const [minAge, setMinAge] = useState<number>(40);
  const [maxAge, setMaxAge] = useState<number>(65);
  const [selectedSexes, setSelectedSexes] = useState<string[]>(['MALE', 'FEMALE']);
  const [dateFrom, setDateFrom] = useState('2025-01-01');
  const [dateTo, setDateTo] = useState('2026-09-01');
  const [format, setFormat] = useState<DatasetFormat>('CSV');

  // Observation Conditions (e.g. HbA1c >= 6.5)
  const [conditions, setConditions] = useState<ObservationCondition[]>([
    { variableCode: 'HBA1C', operator: 'GTE', value: 6.5 },
  ]);

  useEffect(() => {
    async function loadData() {
      if (!projectId) return;
      setLoading(true);
      setError('');
      try {
        const [proj, catalog] = await Promise.all([researchApi.getProject(projectId), researchApi.getCatalog()]);
        setProject(proj);
        setCatalogCategories(catalog.categories || []);

        if (proj.status !== 'APPROVED' && proj.status !== 'ACTIVE') {
          setError(
            `Dataset requests can only be initiated for APPROVED or ACTIVE research projects. Current status: ${proj.status}`,
          );
        }
      } catch (err: unknown) {
        setError(apiErrorMessage(err, 'Failed to load study details or data catalog.'));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  const toggleVariable = (varCode: string) => {
    if (selectedVariables.includes(varCode)) {
      setSelectedVariables(selectedVariables.filter((v) => v !== varCode));
    } else {
      setSelectedVariables([...selectedVariables, varCode]);
    }
  };

  const toggleSex = (sex: string) => {
    if (selectedSexes.includes(sex)) {
      if (selectedSexes.length > 1) {
        setSelectedSexes(selectedSexes.filter((s) => s !== sex));
      }
    } else {
      setSelectedSexes([...selectedSexes, sex]);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { variableCode: 'FASTING_GLUCOSE', operator: 'GTE', value: 100 }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    field: keyof ObservationCondition,
    val: ObservationCondition[keyof ObservationCondition],
  ) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: val };
    setConditions(updated);
  };

  const handleCalculatePreview = async () => {
    setError('');
    if (selectedVariables.length === 0) {
      setError('At least one catalog variable must be selected to calculate cohort preview.');
      return;
    }

    setPreviewing(true);
    try {
      const criteria: CohortFilterCriteria = {
        ageMin: minAge || undefined,
        ageMax: maxAge || undefined,
        sexes: selectedSexes.length > 0 ? selectedSexes : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        conditions: conditions.filter((c) => c.variableCode && c.operator && c.value !== undefined),
        requestedVariables: selectedVariables,
      };

      const preview = await researchApi.previewCohort(criteria);
      setPreviewResult(preview);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to calculate cohort preview.'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async (submitNow: boolean) => {
    if (!projectId) return;
    setError('');

    if (!name.trim()) {
      setError('Dataset request name is required. Please scroll to the top and enter a dataset name.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => document.getElementById('name')?.focus(), 300);
      return;
    }
    if (!purpose.trim()) {
      setError('Research purpose justification is required. Please scroll to the top and provide a purpose.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => document.getElementById('purpose')?.focus(), 300);
      return;
    }
    if (selectedVariables.length === 0) {
      setError('At least one clinical observation variable must be selected.');
      return;
    }

    setSubmitting(true);
    try {
      const populationJson = JSON.stringify({
        ageMin: minAge,
        ageMax: maxAge,
        sexes: selectedSexes,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });

      const variablesJson = JSON.stringify(selectedVariables);

      const filtersJson = JSON.stringify({
        observationEligibility: 'VERIFIED_ONLY',
        subjectIsolation: 'SELF_ONLY',
        failClosedConsent: true,
        observationConditions: conditions,
      });

      const created = await researchApi.createDatasetRequest(projectId, {
        name: name.trim(),
        purpose: purpose.trim(),
        requestedPopulation: populationJson,
        requestedVariables: variablesJson,
        requestedFilters: filtersJson,
        requestedFormat: format,
      });

      if (submitNow) {
        await researchApi.submitDatasetRequest(created.id);
      }

      navigate(`/research/dataset-requests/${created.id}`);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to create dataset request.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-400 gap-3">
        <LoaderCircle className="w-6 h-6 animate-spin text-cyan-400" />
        <span>Loading study eligibility and clinical data catalog...</span>
      </div>
    );
  }

  const isEligible = project && (project.status === 'APPROVED' || project.status === 'ACTIVE');

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/research/projects/${projectId}`}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Dataset Builder &amp; Cohort Query
          </h1>
          <p className="text-xs text-slate-400">
            Approved Study: <span className="text-cyan-300 font-medium">{project?.title}</span>
          </p>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!isEligible ? (
        <div className="p-6 rounded-2xl border border-amber-800/60 bg-amber-950/20 text-amber-200 text-sm space-y-3">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <Lock className="w-4 h-4" />
            Governance Prerequisite Enforced
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Clinora AI requires that research project protocols be vetted and approved by a System Administrator before
            clinical observation datasets can be requested.
          </p>
          <Link to={`/research/projects/${projectId}`}>
            <Button variant="secondary" className="text-xs mt-2 border-amber-700 text-amber-200">
              Return to Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6 sm:p-8 space-y-6">
            {/* Request Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Dataset Request Name <span className="text-cyan-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diabetic Biomarker Cohort 2026 (HbA1c >= 6.5)"
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            {/* Research Purpose */}
            <div className="space-y-1.5">
              <label htmlFor="purpose" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Research Purpose &amp; Justification <span className="text-cyan-400">*</span>
              </label>
              <textarea
                id="purpose"
                required
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Explain the clinical hypotheses and scientific justification for requesting these specific observation variables..."
                className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            {/* Section 1: Demographics & Cohort Parameters */}
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-cyan-400" />
                  1. Population &amp; Demographics Filters
                </h2>
                <span className="text-[11px] text-slate-500">De-identified cohort boundaries</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label htmlFor="minAge" className="text-[11px] text-slate-400">
                    Min Age (Years)
                  </label>
                  <input
                    id="minAge"
                    type="number"
                    min={0}
                    max={120}
                    value={minAge}
                    onChange={(e) => setMinAge(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="maxAge" className="text-[11px] text-slate-400">
                    Max Age (Years)
                  </label>
                  <input
                    id="maxAge"
                    type="number"
                    min={0}
                    max={120}
                    value={maxAge}
                    onChange={(e) => setMaxAge(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="dateFrom" className="text-[11px] text-slate-400">
                    Date From
                  </label>
                  <input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="dateTo" className="text-[11px] text-slate-400">
                    Date To
                  </label>
                  <input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sex / Gender Filter */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-slate-400">Biological Sex:</span>
                <div className="flex items-center gap-2">
                  {['MALE', 'FEMALE', 'OTHER'].map((sex) => {
                    const checked = selectedSexes.includes(sex);
                    return (
                      <button
                        key={sex}
                        type="button"
                        onClick={() => toggleSex(sex)}
                        className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                          checked
                            ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {sex}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 2: Clinical Observation Conditions */}
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  2. Clinical Value Inclusion Conditions (Cohort Criteria)
                </h2>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCondition}
                  className="text-[11px] h-7 px-2.5 bg-slate-900 hover:bg-slate-800 border-slate-800 text-cyan-300"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Condition
                </Button>
              </div>

              {conditions.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No laboratory threshold conditions configured. All verified observations in the date range will
                  qualify.
                </div>
              ) : (
                <div className="space-y-2">
                  {conditions.map((cond, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center gap-3 text-xs"
                    >
                      {/* Test Selector */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500">Laboratory Variable</span>
                        <select
                          value={cond.variableCode}
                          onChange={(e) => updateCondition(idx, 'variableCode', e.target.value)}
                          className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                        >
                          <optgroup label="Metabolic &amp; Glucose">
                            <option value="HBA1C">HbA1c (%)</option>
                            <option value="FASTING_GLUCOSE">Fasting Glucose (mg/dL)</option>
                            <option value="RANDOM_GLUCOSE">Random Glucose (mg/dL)</option>
                          </optgroup>
                          <optgroup label="Hematology">
                            <option value="HEMOGLOBIN">Hemoglobin (g/dL)</option>
                            <option value="WBC">WBC (10^9/L)</option>
                            <option value="PLATELETS">Platelets (10^9/L)</option>
                            <option value="RBC">RBC (10^12/L)</option>
                          </optgroup>
                          <optgroup label="Renal / Kidney">
                            <option value="CREATININE">Creatinine (mg/dL)</option>
                            <option value="EGFR">eGFR (mL/min/1.73m²)</option>
                            <option value="BUN">BUN (mg/dL)</option>
                            <option value="URIC_ACID">Uric Acid (mg/dL)</option>
                          </optgroup>
                          <optgroup label="Liver &amp; Hepatic">
                            <option value="ALT">ALT (U/L)</option>
                            <option value="AST">AST (U/L)</option>
                            <option value="ALP">ALP (U/L)</option>
                            <option value="BILIRUBIN_TOTAL">Total Bilirubin (mg/dL)</option>
                            <option value="ALBUMIN">Albumin (g/dL)</option>
                          </optgroup>
                          <optgroup label="Lipids">
                            <option value="TOTAL_CHOLESTEROL">Total Cholesterol (mg/dL)</option>
                            <option value="LDL">LDL (mg/dL)</option>
                            <option value="HDL">HDL (mg/dL)</option>
                            <option value="TRIGLYCERIDES">Triglycerides (mg/dL)</option>
                          </optgroup>
                          <optgroup label="Thyroid">
                            <option value="TSH">TSH (uIU/mL)</option>
                            <option value="FREE_T4">Free T4 (ng/dL)</option>
                          </optgroup>
                          <optgroup label="Inflammation &amp; Nutrition">
                            <option value="CRP">CRP (mg/L)</option>
                            <option value="FERRITIN">Ferritin (ng/mL)</option>
                            <option value="VITAMIN_D">Vitamin D (ng/mL)</option>
                            <option value="VITAMIN_B12">Vitamin B12 (pg/mL)</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Operator */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500">Condition</span>
                        <select
                          value={cond.operator}
                          onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                          className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none font-mono"
                        >
                          <option value="GTE">&gt;= (Greater or equal)</option>
                          <option value="LTE">&lt;= (Less or equal)</option>
                          <option value="GT">&gt; (Strictly greater)</option>
                          <option value="LT">&lt; (Strictly less)</option>
                          <option value="EQ">== (Equal)</option>
                          <option value="BETWEEN">BETWEEN (Range)</option>
                        </select>
                      </div>

                      {/* Value */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500">Threshold</span>
                        <input
                          type="number"
                          step="0.01"
                          value={cond.value ?? ''}
                          onChange={(e) =>
                            updateCondition(idx, 'value', e.target.value === '' ? undefined : Number(e.target.value))
                          }
                          placeholder="e.g. 6.5"
                          className="w-24 px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                        />
                      </div>

                      {/* Max Value for BETWEEN */}
                      {cond.operator === 'BETWEEN' && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500">Upper Bound</span>
                          <input
                            type="number"
                            step="0.01"
                            value={cond.maxValue ?? ''}
                            onChange={(e) =>
                              updateCondition(
                                idx,
                                'maxValue',
                                e.target.value === '' ? undefined : Number(e.target.value),
                              )
                            }
                            placeholder="e.g. 10.0"
                            className="w-24 px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500/60 focus:outline-none"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="p-1.5 mt-3 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove condition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Controlled Variable Catalog */}
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    3. Research Data Catalog (Approved Real Schema)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Select observations to export. Strictly validated against Clinora's real clinical ontology.
                  </p>
                </div>
                <span className="text-[11px] text-cyan-400 font-mono bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                  {selectedVariables.length} selected
                </span>
              </div>

              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {catalogCategories.map((catGroup) => (
                  <div key={catGroup.category} className="space-y-2">
                    <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
                      {catGroup.category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catGroup.variables.map((v) => {
                        const isSelected = selectedVariables.includes(v.code);
                        return (
                          <button
                            key={v.code}
                            type="button"
                            onClick={() => toggleVariable(v.code)}
                            className={`flex items-start justify-between p-2.5 rounded-xl border text-xs text-left transition-all ${
                              isSelected
                                ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-200 shadow-sm shadow-cyan-950/40'
                                : 'border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                            }`}
                          >
                            <div className="space-y-0.5 pr-2">
                              <div className="font-medium text-slate-200">{v.displayName}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                <span className="font-mono text-cyan-400/80">{v.code}</span>
                                {v.preferredUnit && (
                                  <>
                                    <span>•</span>
                                    <span>{v.preferredUnit}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Desired Export Snapshot Format */}
            <div className="space-y-2 pt-4 border-t border-slate-800/80">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">4. Snapshot Data Format</h2>
              <div className="flex items-center gap-3">
                {(['CSV', 'JSON', 'PARQUET'] as DatasetFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
                      format === fmt
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Privacy Cohort Preview Section */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-cyan-400" />
                    Privacy-Preserving Cohort Aggregate Preview
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Preview qualifying observation volume without accessing any personal patient information.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleCalculatePreview}
                  disabled={previewing}
                  className="bg-slate-900 hover:bg-slate-800 border border-cyan-800/60 text-cyan-300 text-xs shrink-0"
                >
                  {previewing ? (
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5 text-cyan-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                  )}
                  Calculate Preview
                </Button>
              </div>

              {previewResult && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Eligible Records</div>
                      <div className="text-lg font-bold font-mono text-cyan-400">
                        {previewResult.eligibleRecordCount.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Matching Patients</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {previewResult.matchingPatientCount.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Filters Applied</div>
                      <div className="text-lg font-bold font-mono text-slate-200">{previewResult.filtersApplied}</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Query Latency</div>
                      <div className="text-lg font-bold font-mono text-slate-400">
                        {previewResult.queryExecutionMs} ms
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500">Variables Included in Cohort:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {previewResult.variables.map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-[10px] text-cyan-300"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Guarantee Badge */}
              <div className="p-2.5 rounded-xl border border-cyan-900/30 bg-cyan-950/10 text-[11px] text-cyan-300/80 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong>Zero PII Guarantee:</strong> Preview returns strictly aggregated counts. No patient names,
                  emails, user IDs, or report identifiers are returned or exposed.
                </span>
              </div>
            </div>

            {/* Error Banner at bottom */}
            {error && (
              <div className="p-3.5 rounded-xl border border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <Link to={`/research/projects/${projectId}`}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>

              <Button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
                variant="secondary"
                className="text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Draft
              </Button>

              <Button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20"
              >
                {submitting ? (
                  <LoaderCircle className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                Submit for Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
