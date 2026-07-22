import { create } from "zustand";

interface GeoSelection {
  geoCode: string;
  geoName: string;
  geoLevel: string;
}

interface AppState {
  geo: GeoSelection;
  setGeo: (geo: GeoSelection) => void;
  milieu: "ensemble" | "urbain" | "rural";
  sexe: "ensemble" | "masculin" | "feminin";
  setMilieu: (m: AppState["milieu"]) => void;
  setSexe: (s: AppState["sexe"]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  geo: { geoCode: "NATIONAL", geoName: "Maroc", geoLevel: "National" },
  setGeo: (geo) => set({ geo }),
  milieu: "ensemble",
  sexe: "ensemble",
  setMilieu: (milieu) => set({ milieu }),
  setSexe: (sexe) => set({ sexe }),
}));
