import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Droplets,
  LocateFixed,
  Navigation,
  Phone,
  ShieldCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import {
  bloodGroupLabel,
  bloodGroupOptions,
  bloodNetworkApi,
  bloodNetworkError,
  distanceLabel,
  durationLabel,
  type BloodGroup,
  type BloodNetworkOverview,
  type BloodRequestDetail,
  type BloodRequestSummary,
  type BloodRoute,
  type NearbyBloodNetworkPerson,
} from '../../features/blood-network/blood-network-api';
import { BloodNetworkMap } from '../../features/blood-network/blood-network-map';
import type { LatLngPoint } from '../../features/blood-network/google-maps-loader';
import { cn } from '../../lib/cn';

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const AUTO_SYNC_INTERVAL_MS = 12_000;

type RequestListTab = 'nearby' | 'mine';

export function PatientBloodNetworkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get('request');
  const [overview, setOverview] = useState<BloodNetworkOverview | null>(null);
  const [request, setRequest] = useState<BloodRequestDetail | null>(null);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<BloodGroup | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [route, setRoute] = useState<BloodRoute | null>(null);
  const [routeError, setRouteError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestListTab, setRequestListTab] = useState<RequestListTab>('nearby');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const syncFromServer = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true);
      else setSyncing(true);
      try {
        const data = await bloodNetworkApi.overview(selectedBloodGroup ?? undefined);
        setOverview((current) => retainServerSnapshot(current, data));
        if (!selectedBloodGroup && data.selectedBloodGroup) setSelectedBloodGroup(data.selectedBloodGroup);

        if (requestId) {
          const detail = await bloodNetworkApi.request(requestId);
          setRequest((current) => retainServerSnapshot(current, detail));
          if (detail.owner) {
            setSelectedPersonId((currentId) => {
              const current = detail.matches.find((person) => person.userId === currentId);
              if (current?.responseStatus === 'ACCEPTED') return current.userId;
              return (
                detail.matches.find((person) => person.responseStatus === 'ACCEPTED')?.userId ??
                current?.userId ??
                detail.matches.find((person) => person.responseStatus === 'PENDING')?.userId ??
                null
              );
            });
          } else {
            setSelectedPersonId(null);
          }
        } else {
          setRequest(null);
          setRoute(null);
          setRouteError('');
          setSelectedPersonId((currentId) =>
            currentId && data.nearbyPeople.some((person) => person.userId === currentId) ? currentId : null,
          );
        }

        if (!data.currentUser.latitude && data.currentUser.address && !data.mapsConfigured) {
          setError('Add GOOGLE_MAPS_API_KEY to the backend environment so Clinora can geocode your Health Profile address.');
        } else {
          setError('');
        }
        setLastSyncedAt(new Date());
      } catch (requestError) {
        setError(bloodNetworkError(requestError, 'Blood Network could not be loaded from Clinora.'));
      } finally {
        if (initial) setLoading(false);
        else setSyncing(false);
      }
    },
    [requestId, selectedBloodGroup],
  );

  useEffect(() => {
    void syncFromServer(true);
  }, [syncFromServer]);

  useEffect(() => {
    const silentSync = () => {
      if (document.visibilityState === 'visible') void syncFromServer(false);
    };
    const timer = window.setInterval(silentSync, AUTO_SYNC_INTERVAL_MS);
    const handleFocus = () => silentSync();
    const handleVisibility = () => silentSync();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncFromServer]);

  const people = useMemo(
    () => request
      ? request.owner
        ? request.matches.filter((person) => person.responseStatus !== 'DECLINED' && person.responseStatus !== 'WITHDRAWN')
        : []
      : overview?.nearbyPeople ?? [],
    [overview?.nearbyPeople, request],
  );
  const selectedPerson = people.find((person) => person.userId === selectedPersonId) ?? null;
  const currentLatitude = overview?.currentUser.latitude;
  const currentLongitude = overview?.currentUser.longitude;
  const currentLocation = useMemo<LatLngPoint | null>(() => {
    return currentLatitude != null && currentLongitude != null
      ? { lat: currentLatitude, lng: currentLongitude }
      : null;
  }, [currentLatitude, currentLongitude]);

  const activeRequestId = request?.id ?? null;
  const requestOwner = Boolean(request?.owner);
  const requestStatus = request?.status ?? null;
  const routeMatchedUserId =
    requestStatus === 'ACTIVE'
      ? requestOwner
        ? selectedPerson?.responseStatus === 'ACCEPTED'
          ? selectedPerson.userId
          : null
        : request?.myResponseStatus === 'ACCEPTED'
          ? overview?.currentUser.userId ?? null
          : null
      : null;

  useEffect(() => {
    if (!activeRequestId || !routeMatchedUserId || requestStatus !== 'ACTIVE') {
      setRoute(null);
      setRouteError('');
      setRouteLoading(false);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    setRouteError('');
    void bloodNetworkApi
      .route(activeRequestId, requestOwner ? routeMatchedUserId : undefined)
      .then((data) => {
        if (!cancelled) setRoute(data);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setRoute(null);
          setRouteError(bloodNetworkError(requestError, 'Driving route is unavailable right now.'));
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRequestId, requestOwner, requestStatus, routeMatchedUserId]);

  const toggleAvailability = async () => {
    if (!overview) return;
    setBusy('availability');
    setError('');
    try {
      const nextAvailable = !overview.currentUser.bloodNetworkAvailable;
      await bloodNetworkApi.preferences({ enabled: true, available: nextAvailable });
      await syncFromServer(false);
    } catch (requestError) {
      setError(bloodNetworkError(requestError, 'Your Blood Network availability could not be updated.'));
    } finally {
      setBusy('');
    }
  };

  const respond = async (id: string, action: 'ACCEPT' | 'DECLINE') => {
    setBusy(`respond-${id}`);
    setError('');
    try {
      await bloodNetworkApi.respond(id, action);
      setSearchParams({ request: id });
      await syncFromServer(false);
    } catch (requestError) {
      setError(bloodNetworkError(requestError, 'Your response could not be saved.'));
    } finally {
      setBusy('');
    }
  };

  const updateRequest = async (action: 'FULFILL' | 'CANCEL') => {
    if (!request) return;
    setBusy(`request-${action}`);
    setError('');
    try {
      await bloodNetworkApi.updateStatus(request.id, action);
      await syncFromServer(false);
    } catch (requestError) {
      setError(bloodNetworkError(requestError, 'The request could not be updated.'));
    } finally {
      setBusy('');
    }
  };

  const closeRequestFocus = () => {
    setRequest(null);
    setSelectedPersonId(null);
    setRoute(null);
    setRouteError('');
    setSearchParams({});
  };

  return (
    <div className="mx-auto w-full max-w-[1520px] pb-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-200">
            <Droplets size={14} aria-hidden="true" /> Community response
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Blood Network</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--clinora-text-muted)]">
            Find nearby people available to help with urgent blood requests. Clinora uses approximate locations until
            someone accepts, then unlocks contact and driving coordination for that request.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.045] px-3 text-xs font-semibold text-emerald-100">
            <Activity size={14} className={syncing ? 'animate-pulse' : ''} aria-hidden="true" />
            <span>{syncing ? 'Syncing Clinora data…' : lastSyncedAt ? `Live · ${formatClock(lastSyncedAt)}` : 'Live from Clinora'}</span>
          </div>
          <Button variant="appPrimary" onClick={() => setRequestOpen(true)}>
            <Droplets size={16} aria-hidden="true" /> Request blood
          </Button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.065] px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="relative min-h-[700px] overflow-hidden rounded-[30px] border border-cyan-300/[0.09] bg-[#06111f] shadow-[0_34px_90px_-54px_rgba(8,145,178,0.8)]">
          <BloodNetworkMap
            apiKey={googleMapsApiKey}
            currentLocation={currentLocation}
            nearbyPeople={people}
            request={request}
            route={route}
            selectedPersonId={selectedPersonId}
            radiusMeters={overview?.radiusMeters ?? 5000}
            onSelectPerson={(person) => setSelectedPersonId(person.userId)}
          />
          <div className="pointer-events-none absolute left-4 right-4 top-4 z-30 flex flex-wrap items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/88 p-2.5 shadow-2xl backdrop-blur-xl">
              <label htmlFor="blood-map-group" className="mb-1.5 block px-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Showing blood group
              </label>
              <select
                id="blood-map-group"
                value={selectedBloodGroup ?? overview?.selectedBloodGroup ?? 'O_POSITIVE'}
                onChange={(event) => {
                  const value = event.target.value as BloodGroup;
                  setSelectedBloodGroup(value);
                  setSelectedPersonId(null);
                }}
                className="min-h-10 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/40"
              >
                {bloodGroupOptions.map((group) => (
                  <option key={group.value} value={group.value} className="bg-slate-950">
                    {group.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pointer-events-auto mr-12 rounded-2xl border border-white/10 bg-slate-950/88 px-3.5 py-2.5 text-right shadow-2xl backdrop-blur-xl">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Within 5 km</p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                {people.length} {people.length === 1 ? 'nearby match' : 'nearby matches'}
              </p>
            </div>
          </div>
        </section>

        <aside className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.03] shadow-[0_28px_80px_-62px_rgba(0,0,0,0.85)]">
          <AvailabilityPanel overview={overview} busy={busy} onToggle={() => void toggleAvailability()} />
          <div className="border-t border-white/[0.07]" />
          {request ? (
            <RequestWorkspace
              request={request}
              selectedPerson={selectedPerson}
              route={route}
              routeLoading={routeLoading}
              routeError={routeError}
              busy={busy}
              onSelectPerson={(person) => setSelectedPersonId(person.userId)}
              onRespond={respond}
              onUpdate={updateRequest}
              onClose={closeRequestFocus}
            />
          ) : selectedPerson ? (
            <PersonPreview
              person={selectedPerson}
              onClose={() => setSelectedPersonId(null)}
              onRequest={() => setRequestOpen(true)}
            />
          ) : (
            <DiscoveryPanel people={people} loading={loading} onSelect={(person) => setSelectedPersonId(person.userId)} />
          )}
        </aside>
      </div>

      <RequestActivityPanel
        className="mt-6"
        tab={requestListTab}
        onTabChange={setRequestListTab}
        nearby={overview?.nearbyRequests ?? []}
        mine={overview?.myRequests ?? []}
        onOpen={(item) => setSearchParams({ request: item.id })}
      />

      {requestOpen ? (
        <CreateRequestPanel
          selectedBloodGroup={selectedBloodGroup ?? overview?.selectedBloodGroup ?? 'O_POSITIVE'}
          busy={busy}
          onClose={() => setRequestOpen(false)}
          onCreated={async (created) => {
            setRequest(created);
            setSearchParams({ request: created.id });
            setRequestOpen(false);
            setSelectedPersonId(created.matches.find((person) => person.responseStatus === 'ACCEPTED')?.userId ?? null);
            await syncFromServer(false);
          }}
          setBusy={setBusy}
          setError={setError}
        />
      ) : null}
    </div>
  );
}

function AvailabilityPanel({
  overview,
  busy,
  onToggle,
}: {
  overview: BloodNetworkOverview | null;
  busy: string;
  onToggle: () => void;
}) {
  const current = overview?.currentUser;
  const available = Boolean(current?.bloodNetworkAvailable);
  return (
    <section className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-200">Blood Network availability</p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">{available ? 'Available for nearby requests' : 'Not currently available'}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {current?.address
              ? `Matching area: ${current.geocodedAddress ?? current.address}`
              : 'Add an address in Health Profile to join nearby matching.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={available}
          disabled={!current || busy === 'availability'}
          onClick={onToggle}
          className={cn(
            'relative mt-1 h-7 w-12 shrink-0 rounded-full border transition disabled:opacity-50',
            available ? 'border-emerald-300/30 bg-emerald-400/20' : 'border-white/10 bg-white/[0.05]',
          )}
        >
          <span className={cn('absolute top-1 h-5 w-5 rounded-full transition', available ? 'left-6 bg-emerald-300' : 'left-1 bg-slate-500')} />
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={14} className="text-cyan-300" aria-hidden="true" />
        Contact and precise coordination unlock only after acceptance.
      </div>
    </section>
  );
}

function DiscoveryPanel({
  people,
  loading,
  onSelect,
}: {
  people: NearbyBloodNetworkPerson[];
  loading: boolean;
  onSelect: (person: NearbyBloodNetworkPerson) => void;
}) {
  return (
    <section className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Nearby availability</p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">People inside your matching area</h2>
        </div>
        <UsersRound size={18} className="text-cyan-200" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-2">
        {people.slice(0, 7).map((person) => (
          <button
            key={person.userId}
            type="button"
            onClick={() => onSelect(person)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-slate-950/35 px-3 py-3 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/[0.08] text-xs font-black text-cyan-100">
              {bloodGroupLabel(person.bloodGroup)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{person.displayName}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{distanceLabel(person.distanceMeters)} away · approximate location</span>
            </span>
            <ArrowRight size={14} className="text-slate-600" aria-hidden="true" />
          </button>
        ))}
        {!people.length ? (
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/30 px-4 py-5">
            <p className="text-sm font-semibold text-slate-300">{loading ? 'Loading nearby people…' : 'No matching people are nearby right now'}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Clinora reads this from opted-in patient profiles in the current 5 km area. Try another blood group or check again later.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PersonPreview({
  person,
  onClose,
  onRequest,
}: {
  person: NearbyBloodNetworkPerson;
  onClose: () => void;
  onRequest: () => void;
}) {
  return (
    <section className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300/[0.1] text-sm font-black text-cyan-100">
            {bloodGroupLabel(person.bloodGroup)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{person.displayName}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{distanceLabel(person.distanceMeters)} away</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-slate-400 hover:text-white" aria-label="Close person preview">
          <XCircle size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-slate-950/30 px-3 py-3 text-xs leading-5 text-slate-400">
        This is an approximate matching position. Send a blood request first; the individual phone number and precise driving route unlock only if this person accepts.
      </div>
      <Button variant="appPrimary" className="mt-4 w-full" onClick={onRequest}>
        <Droplets size={15} aria-hidden="true" /> Request blood to contact
      </Button>
    </section>
  );
}

function RequestWorkspace({
  request,
  selectedPerson,
  route,
  routeLoading,
  routeError,
  busy,
  onSelectPerson,
  onRespond,
  onUpdate,
  onClose,
}: {
  request: BloodRequestDetail;
  selectedPerson: NearbyBloodNetworkPerson | null;
  route: BloodRoute | null;
  routeLoading: boolean;
  routeError: string;
  busy: string;
  onSelectPerson: (person: NearbyBloodNetworkPerson) => void;
  onRespond: (id: string, action: 'ACCEPT' | 'DECLINE') => Promise<void>;
  onUpdate: (action: 'FULFILL' | 'CANCEL') => Promise<void>;
  onClose: () => void;
}) {
  const accepted = request.matches.filter((person) => person.responseStatus === 'ACCEPTED');
  const pending = request.matches.filter((person) => person.responseStatus === 'PENDING');
  return (
    <section className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <RequestStatus status={request.status} />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Blood request</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {bloodGroupLabel(request.bloodGroup)} · {request.unitsNeeded} {request.unitsNeeded === 1 ? 'unit' : 'units'}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-300">{request.hospitalName}</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">{request.hospitalAddress}</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 hover:text-white" aria-label="Close request focus">
          <XCircle size={17} aria-hidden="true" />
        </button>
      </div>

      {request.note ? <p className="mt-4 rounded-xl border border-white/[0.06] bg-slate-950/30 px-3 py-3 text-xs leading-5 text-slate-300">{request.note}</p> : null}

      {request.owner ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Notified" value={String(request.matches.length)} />
            <Stat label="Accepted" value={String(accepted.length)} />
            <Stat label="Waiting" value={String(pending.length)} />
          </div>

          {request.matches.length ? (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Nearby responses</p>
              <div className="mt-2 space-y-2">
                {request.matches.slice(0, 6).map((person) => (
                  <button
                    key={person.userId}
                    type="button"
                    onClick={() => onSelectPerson(person)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                      selectedPerson?.userId === person.userId
                        ? 'border-cyan-300/25 bg-cyan-300/[0.055]'
                        : 'border-white/[0.07] bg-slate-950/30 hover:border-white/[0.13]',
                    )}
                  >
                    <span className={cn(
                      'grid h-9 w-9 place-items-center rounded-xl text-xs font-black',
                      person.responseStatus === 'ACCEPTED' ? 'bg-emerald-300/[0.09] text-emerald-200' : 'bg-cyan-300/[0.08] text-cyan-100',
                    )}>
                      {bloodGroupLabel(person.bloodGroup)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{person.displayName}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {distanceLabel(person.distanceMeters)} · {person.responseStatus === 'ACCEPTED' ? 'accepted' : person.responseStatus.toLowerCase()}
                      </span>
                    </span>
                    <ArrowRight size={14} className="text-slate-600" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {selectedPerson ? (
            <MatchCoordinationCard
              person={selectedPerson}
              route={route}
              routeLoading={routeLoading}
              routeError={routeError}
            />
          ) : null}

          {request.status === 'ACTIVE' ? (
            <div className="mt-5 flex gap-2 border-t border-white/[0.07] pt-5">
              <Button variant="appSecondary" className="flex-1" disabled={busy !== ''} onClick={() => void onUpdate('CANCEL')}>
                Cancel request
              </Button>
              <Button variant="appPrimary" className="flex-1" disabled={busy !== ''} onClick={() => void onUpdate('FULFILL')}>
                <CheckCircle2 size={15} /> Mark fulfilled
              </Button>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-slate-950/30 px-3 py-3 text-xs leading-5 text-slate-400">
              This request is {request.status.toLowerCase()}. Nearby coordination and route sharing are no longer active.
            </div>
          )}
        </>
      ) : (
        <DonorRequestPanel
          request={request}
          route={route}
          routeLoading={routeLoading}
          routeError={routeError}
          busy={busy}
          onRespond={onRespond}
        />
      )}
    </section>
  );
}

function MatchCoordinationCard({
  person,
  route,
  routeLoading,
  routeError,
}: {
  person: NearbyBloodNetworkPerson;
  route: BloodRoute | null;
  routeLoading: boolean;
  routeError: string;
}) {
  const accepted = person.responseStatus === 'ACCEPTED';
  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-[linear-gradient(145deg,rgba(8,145,178,0.1),rgba(15,23,42,0.46))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">Selected match</p>
          <h3 className="mt-1 text-base font-semibold text-white">{person.displayName}</h3>
          <p className="mt-1 text-xs text-slate-400">{bloodGroupLabel(person.bloodGroup)} · {distanceLabel(person.distanceMeters)} straight-line</p>
        </div>
        <span className={cn(
          'rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider',
          accepted ? 'border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-200' : 'border-amber-300/20 bg-amber-300/[0.05] text-amber-200',
        )}>
          {accepted ? 'Accepted' : person.responseStatus.toLowerCase()}
        </span>
      </div>

      {accepted ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <InfoTile label="Phone" value={person.phone ?? 'No phone saved'} />
            <InfoTile
              label="Driving route"
              value={route ? `${distanceLabel(route.distanceMeters)} · ${durationLabel(route.durationSeconds)}` : routeLoading ? 'Calculating…' : 'Unavailable'}
            />
          </div>
          {routeError ? <p className="mt-3 text-xs leading-5 text-amber-200">{routeError}</p> : null}
          {person.phone ? (
            <a
              href={`tel:${person.phone.replace(/\s/g, '')}`}
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
            >
              <Phone size={15} aria-hidden="true" /> Call {person.phone}
            </a>
          ) : null}
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            The map uses the accepted participant's precise saved location only for this active request. The route line, road distance and ETA come from Google Routes.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Contact and precise route details remain private until this person accepts the request.
        </p>
      )}
    </div>
  );
}

function DonorRequestPanel({
  request,
  route,
  routeLoading,
  routeError,
  busy,
  onRespond,
}: {
  request: BloodRequestDetail;
  route: BloodRoute | null;
  routeLoading: boolean;
  routeError: string;
  busy: string;
  onRespond: (id: string, action: 'ACCEPT' | 'DECLINE') => Promise<void>;
}) {
  const accepted = request.myResponseStatus === 'ACCEPTED';
  return (
    <>
      {request.myDistanceMeters != null ? (
        <p className="mt-3 text-xs font-semibold text-cyan-200">{distanceLabel(request.myDistanceMeters)} from your saved matching area</p>
      ) : null}

      {accepted ? (
        <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200">Coordination unlocked</p>
          {request.requesterContact ? (
            <>
              <h3 className="mt-1.5 text-base font-semibold text-white">{request.requesterContact.name}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <InfoTile label="Phone" value={request.requesterContact.phone ?? 'No phone saved'} />
                <InfoTile
                  label="Driving route"
                  value={route ? `${distanceLabel(route.distanceMeters)} · ${durationLabel(route.durationSeconds)}` : routeLoading ? 'Calculating…' : 'Unavailable'}
                />
              </div>
              {request.requesterContact.phone ? (
                <a
                  href={`tel:${request.requesterContact.phone.replace(/\s/g, '')}`}
                  className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-200"
                >
                  <Phone size={15} aria-hidden="true" /> Call requester
                </a>
              ) : null}
              {routeError ? <p className="mt-3 text-xs leading-5 text-amber-200">{routeError}</p> : null}
            </>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-400">The request is accepted. Contact details will appear when available from the requester's saved profile.</p>
          )}
        </div>
      ) : request.status === 'ACTIVE' ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="appSecondary" disabled={busy !== ''} onClick={() => void onRespond(request.id, 'DECLINE')}>
            Not available
          </Button>
          <Button variant="appPrimary" disabled={busy !== ''} onClick={() => void onRespond(request.id, 'ACCEPT')}>
            <Droplets size={15} /> I can help
          </Button>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-slate-950/30 px-3 py-3 text-xs text-slate-400">
          This request is {request.status.toLowerCase()}.
        </div>
      )}
    </>
  );
}

function RequestActivityPanel({
  className,
  tab,
  onTabChange,
  nearby,
  mine,
  onOpen,
}: {
  className?: string;
  tab: RequestListTab;
  onTabChange: (value: RequestListTab) => void;
  nearby: BloodRequestSummary[];
  mine: BloodRequestSummary[];
  onOpen: (item: BloodRequestSummary) => void;
}) {
  const items = tab === 'nearby' ? nearby : mine;
  const empty = tab === 'nearby'
    ? 'No active matching blood requests are within your 5 km area right now.'
    : 'Requests you create will appear here with their persisted status.';
  return (
    <section className={cn('rounded-[26px] border border-white/[0.075] bg-white/[0.03] p-5 sm:p-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Request activity</p>
          <h2 className="mt-1.5 text-xl font-semibold text-white">Nearby and recent requests</h2>
        </div>
        <div className="inline-flex rounded-xl border border-white/[0.08] bg-slate-950/35 p-1">
          <button
            type="button"
            onClick={() => onTabChange('nearby')}
            className={cn('min-h-9 rounded-lg px-3 text-xs font-semibold transition', tab === 'nearby' ? 'bg-cyan-300/[0.1] text-cyan-100' : 'text-slate-500 hover:text-slate-300')}
          >
            Nearby requests
          </button>
          <button
            type="button"
            onClick={() => onTabChange('mine')}
            className={cn('min-h-9 rounded-lg px-3 text-xs font-semibold transition', tab === 'mine' ? 'bg-cyan-300/[0.1] text-cyan-100' : 'text-slate-500 hover:text-slate-300')}
          >
            My requests
          </button>
        </div>
      </div>

      <div className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/[0.015]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-300/[0.08] text-xs font-black text-rose-100">
              {bloodGroupLabel(item.bloodGroup)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{item.hospitalName}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {item.distanceMeters > 0 ? <span>{distanceLabel(item.distanceMeters)} away</span> : null}
                <span>{item.unitsNeeded} {item.unitsNeeded === 1 ? 'unit' : 'units'}</span>
                <span>{formatRequestTime(item.createdAt)}</span>
              </span>
            </span>
            <RequestStatus status={item.status} />
            <ArrowRight size={15} className="text-slate-600" aria-hidden="true" />
          </button>
        ))}
        {!items.length ? <p className="py-5 text-sm leading-6 text-slate-500">{empty}</p> : null}
      </div>
    </section>
  );
}

function RequestStatus({ status }: { status: BloodRequestSummary['status'] }) {
  const style =
    status === 'ACTIVE'
      ? 'border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-200'
      : status === 'FULFILLED'
        ? 'border-cyan-300/20 bg-cyan-300/[0.055] text-cyan-200'
        : status === 'CANCELLED'
          ? 'border-slate-400/15 bg-slate-400/[0.05] text-slate-400'
          : 'border-amber-300/20 bg-amber-300/[0.05] text-amber-200';
  return <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider', style)}>{status.toLowerCase()}</span>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/30 px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function CreateRequestPanel({
  selectedBloodGroup,
  busy,
  onClose,
  onCreated,
  setBusy,
  setError,
}: {
  selectedBloodGroup: BloodGroup;
  busy: string;
  onClose: () => void;
  onCreated: (request: BloodRequestDetail) => Promise<void>;
  setBusy: (value: string) => void;
  setError: (value: string) => void;
}) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(selectedBloodGroup);
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [note, setNote] = useState('');

  const submit = async () => {
    if (!hospitalName.trim() || !hospitalAddress.trim()) {
      setError('Add the hospital or donation-centre name and address before sending the request.');
      return;
    }
    setBusy('create-request');
    setError('');
    try {
      const created = await bloodNetworkApi.createRequest({
        bloodGroup,
        unitsNeeded,
        hospitalName: hospitalName.trim(),
        hospitalAddress: hospitalAddress.trim(),
        ...(neededBy ? { neededBy: new Date(neededBy).toISOString() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      await onCreated(created);
    } catch (requestError) {
      setError(bloodNetworkError(requestError, 'The blood request could not be created.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/72 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="blood-request-title">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0a1422] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-200">Create request</p>
            <h2 id="blood-request-title" className="mt-1.5 text-2xl font-semibold text-white">Find nearby blood support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Clinora will notify opted-in patients with the selected blood group within 5 km of the request location.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 hover:text-white" aria-label="Close request form">
            <XCircle size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Blood group">
            <select value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value as BloodGroup)} className={inputClass}>
              {bloodGroupOptions.map((group) => <option key={group.value} value={group.value} className="bg-slate-950">{group.label}</option>)}
            </select>
          </Field>
          <Field label="Units needed">
            <input type="number" min={1} max={20} value={unitsNeeded} onChange={(event) => setUnitsNeeded(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} className={inputClass} />
          </Field>
          <Field label="Hospital / donation centre" className="sm:col-span-2">
            <input value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} maxLength={180} placeholder="e.g. Dhaka Medical College Hospital" className={inputClass} />
          </Field>
          <Field label="Request location address" className="sm:col-span-2">
            <textarea value={hospitalAddress} onChange={(event) => setHospitalAddress(event.target.value)} maxLength={500} rows={2} placeholder="Hospital or donation-centre address" className={inputClass} />
          </Field>
          <Field label="Needed by">
            <input type="datetime-local" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} className={inputClass} />
          </Field>
          <div className="rounded-xl border border-cyan-300/12 bg-cyan-300/[0.045] px-3 py-3 text-xs leading-5 text-cyan-100">
            <LocateFixed size={14} className="mb-2" aria-hidden="true" />
            Clinora geocodes this address on the backend, then uses that point for the real 5 km matching area.
          </div>
          <Field label="Context for nearby patients" className="sm:col-span-2">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} rows={3} placeholder="Keep this brief. Do not include unnecessary medical details." className={inputClass} />
          </Field>
        </div>

        <div className="mt-6 rounded-xl border border-white/[0.07] bg-slate-950/35 px-3.5 py-3 text-xs leading-5 text-slate-400">
          <ShieldCheck size={14} className="mr-2 inline text-cyan-300" aria-hidden="true" />
          Matching is a coordination aid, not donor medical clearance. The receiving blood bank or hospital performs final donor and transfusion suitability checks.
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="appSecondary" onClick={onClose} disabled={busy === 'create-request'}>Cancel</Button>
          <Button variant="appPrimary" onClick={() => void submit()} disabled={busy === 'create-request'}>
            {busy === 'create-request' ? 'Finding nearby people…' : <><Navigation size={15} /> Send nearby request</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={cn('grid gap-1.5 text-xs font-semibold text-slate-300', className)}><span>{label}</span>{children}</label>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-slate-950/30 px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRequestTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved request';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const inputClass = 'min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10';

function retainServerSnapshot<T>(current: T | null, incoming: T): T {
  return current != null && JSON.stringify(current) === JSON.stringify(incoming) ? current : incoming;
}
