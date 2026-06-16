// State hook: holds the comparison, persists to localStorage + the URL hash (shareable),
// manages named saved-car profiles, and exposes mutation actions.
import { useEffect, useState } from 'react';
import type { Assumptions, ComparisonState, Vehicle } from '../types';
import { DEFAULT_ASSUMPTIONS, MAX_CARS, MIN_CARS, PRESETS, newId } from '../data/presets';

const SESSION_KEY = 'carTcoSession_v2';
const PROFILE_KEY = 'carTcoProfiles_v2';
const DEFAULT_ASSUMPTIONS_KEY = 'carTcoDefaultAssumptions_v2'; // user-saved "my defaults"

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Overlay a saved assumptions blob onto the factory defaults (fills any new fields). */
function mergeAssumptions(raw: any): Assumptions {
  const fin = raw?.financing ?? {};
  return {
    ...clone(DEFAULT_ASSUMPTIONS),
    ...(raw ?? {}),
    financing: {
      enabled: !!fin.enabled,
      new: { ...DEFAULT_ASSUMPTIONS.financing.new, ...(fin.new ?? {}) },
      used: { ...DEFAULT_ASSUMPTIONS.financing.used, ...(fin.used ?? {}) },
    },
  };
}

/** The baseline assumptions: the user's saved defaults if any, else factory defaults. */
function baseAssumptions(): Assumptions {
  try {
    const raw = JSON.parse(localStorage.getItem(DEFAULT_ASSUMPTIONS_KEY) || 'null');
    if (raw) return mergeAssumptions(raw);
  } catch {
    /* ignore */
  }
  return clone(DEFAULT_ASSUMPTIONS);
}

function defaults(): ComparisonState {
  return {
    assumptions: baseAssumptions(),
    vehicles: [clone(PRESETS[0]), clone(PRESETS[1])].map((v) => ({ ...v, id: newId() })),
  };
}

/** Overlay saved data onto current defaults so older saves still get any new fields. */
function hydrate(raw: any): ComparisonState | null {
  if (!raw || !raw.assumptions || !Array.isArray(raw.vehicles)) return null;
  if (raw.vehicles.length < MIN_CARS || raw.vehicles.length > MAX_CARS) return null;
  const assumptions = mergeAssumptions(raw.assumptions);
  const shape = PRESETS[0];
  const vehicles: Vehicle[] = raw.vehicles.map((v: any) => ({ ...clone(shape), ...v, id: v.id ?? newId() }));
  return { assumptions, vehicles };
}

const encode = (s: ComparisonState): string => encodeURIComponent(JSON.stringify(s));
const decode = (h: string): ComparisonState | null => {
  try {
    return hydrate(JSON.parse(decodeURIComponent(h)));
  } catch {
    return null;
  }
};

function loadProfiles(): Record<string, Vehicle> {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') as Record<string, Vehicle>;
  } catch {
    return {};
  }
}

function initialState(): ComparisonState {
  if (typeof window !== 'undefined') {
    const h = window.location.hash.replace(/^#/, '');
    if (h) {
      const fromHash = decode(h);
      if (fromHash) return fromHash;
    }
    try {
      const s = hydrate(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'));
      if (s) return s;
    } catch {
      /* ignore */
    }
  }
  return defaults();
}

export function useComparison() {
  const [state, setState] = useState<ComparisonState>(initialState);
  const [profiles, setProfiles] = useState<Record<string, Vehicle>>(loadProfiles);

  // persist on every change: localStorage (restore next visit) + URL hash (shareable)
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    try {
      window.history.replaceState(null, '', '#' + encode(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const updateAssumptions = (fn: (a: Assumptions) => void) =>
    setState((s) => {
      const a = clone(s.assumptions);
      fn(a);
      return { ...s, assumptions: a };
    });

  const updateVehicle = (i: number, fn: (v: Vehicle) => void) =>
    setState((s) => {
      const vehicles = [...s.vehicles];
      const c = clone(vehicles[i]);
      fn(c);
      vehicles[i] = c;
      return { ...s, vehicles };
    });

  const addVehicle = () =>
    setState((s) =>
      s.vehicles.length >= MAX_CARS
        ? s
        : { ...s, vehicles: [...s.vehicles, { ...clone(PRESETS[s.vehicles.length % PRESETS.length]), id: newId() }] },
    );

  const removeVehicle = (i: number) =>
    setState((s) => (s.vehicles.length <= MIN_CARS ? s : { ...s, vehicles: s.vehicles.filter((_, idx) => idx !== i) }));

  const loadVehicle = (i: number, v: Vehicle) =>
    setState((s) => {
      const vehicles = [...s.vehicles];
      vehicles[i] = { ...clone(v), id: newId() };
      return { ...s, vehicles };
    });

  // Add a resolved vehicle (e.g. from a real listing) as a new card; if already at
  // MAX_CARS, replace the last slot so the action always lands somewhere.
  const importVehicle = (v: Vehicle) =>
    setState((s) => {
      const fresh = { ...clone(v), id: newId() };
      if (s.vehicles.length >= MAX_CARS) {
        const vehicles = [...s.vehicles];
        vehicles[vehicles.length - 1] = fresh;
        return { ...s, vehicles };
      }
      return { ...s, vehicles: [...s.vehicles, fresh] };
    });

  const reset = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setState(defaults());
  };

  const saveProfile = (v: Vehicle) => {
    const name = (v.name || '').trim() || 'Saved ' + Date.now();
    const next = { ...loadProfiles(), [name]: clone(v) };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setProfiles(next);
  };

  const deleteProfile = (name: string) => {
    const next = { ...loadProfiles() };
    delete next[name];
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setProfiles(next);
  };

  const shareUrl = () => window.location.origin + window.location.pathname + '#' + encode(state);

  // Save the current shared assumptions as the user's defaults (used for Reset + new sessions).
  const saveAssumptionDefaults = () => {
    try {
      localStorage.setItem(DEFAULT_ASSUMPTIONS_KEY, JSON.stringify(state.assumptions));
    } catch {
      /* ignore */
    }
  };
  const clearAssumptionDefaults = () => {
    try {
      localStorage.removeItem(DEFAULT_ASSUMPTIONS_KEY);
    } catch {
      /* ignore */
    }
  };

  return {
    state,
    profiles,
    updateAssumptions,
    updateVehicle,
    addVehicle,
    removeVehicle,
    loadVehicle,
    importVehicle,
    reset,
    saveProfile,
    deleteProfile,
    shareUrl,
    saveAssumptionDefaults,
    clearAssumptionDefaults,
  };
}
